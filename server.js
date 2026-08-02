/**
 * server.js
 * ==================================================================
 * Servidor Express da aplicação Academia Toledo.
 *
 * Responsabilidades principais:
 *  - Servir os arquivos estáticos do front-end (pasta /public)
 *  - Criar sessões de pagamento (Stripe Checkout) para os planos de
 *    assinatura disponíveis
 *  - Processar webhooks do Stripe para manter o Supabase sincronizado
 *    com o estado real das assinaturas e pagamentos (ativação,
 *    renovação, cancelamento agendado/efetivo, falha de pagamento)
 *  - Expor rotas autenticadas para o usuário consultar sua própria
 *    assinatura e abrir o Portal do Cliente Stripe (autoatendimento:
 *    troca de cartão, faturas, cancelamento)
 *
 * Autenticação: todas as rotas que expõem dados de um usuário
 * específico validam o JWT emitido pelo Supabase Auth (ver
 * middleware requireAuth), nunca confiando em identificadores
 * enviados livremente pelo cliente no corpo da requisição.
 *
 * Fonte da verdade: sempre que possível, o estado gravado no Supabase
 * é obtido consultando a API do Stripe no momento do processamento
 * (em vez de confiar cegamente no payload do evento de webhook), pois
 * o Stripe não garante ordem de entrega dos eventos — ver comentário
 * detalhado em handleSubscriptionUpdated().
 * ==================================================================
 */

require("dotenv").config();

// Framework HTTP principal da aplicação.
const express = require("express");
// Utilitário nativo do Node para resolver caminhos de arquivo de forma
// segura e independente do sistema operacional.
const path = require("path");
// SDK oficial do Stripe para Node.js (Checkout, Billing Portal, webhooks).
const Stripe = require("stripe");
// Middleware de segurança: define cabeçalhos HTTP recomendados
// (CSP, HSTS, X-Frame-Options, etc.) para mitigar ataques comuns.
const helmet = require("helmet");
// Middleware de rate limiting, usado para proteger rotas sensíveis
// (checkout e portal) contra abuso/spam de requisições.
const rateLimit = require("express-rate-limit");

// Cliente único do Supabase com privilégios de administrador
// (Service Role Key) — ver supabaseClient.js.
const supabase = require("./supabaseClient");
// Funções puras reutilizáveis (validação de e-mail, aritmética de datas),
// extraídas para utils.js para permitir testes unitários simples.
const { isValidEmail, addOneMonth } = require("./utils");

const app = express();

/* ============================================================
   ⚙️ CONFIGURAÇÃO
   ============================================================ */

// Falha rápido e com erro claro no boot se faltar configuração essencial.
// Preferível a deixar o servidor subir "pela metade" e só descobrir a
// falta de uma chave quando o primeiro pagamento ou webhook chegar.
const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Variáveis de ambiente faltando: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

// Instância do SDK do Stripe, autenticada com a Secret Key do projeto.
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// URL base usada nos redirects do Checkout. Em produção, defina BASE_URL
// (ex.: https://seusite.com) — sem isso, cai no localhost (apenas dev).
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ---------------------------------------------------------------
// 🗂️ CATÁLOGO DE PLANOS
//
// Cada plano referencia um Price criado no Stripe Dashboard.
// Crie os Products/Prices no Dashboard, anote os price_id (price_xxx)
// e defina-os no .env — nunca hard-coded aqui.
//
// Exemplo de .env:
//   STRIPE_PRICE_MENSAL=price_xxx
//   STRIPE_PRICE_TRIMESTRAL=price_xxx
//   STRIPE_PRICE_SEMESTRAL=price_xxx
//   STRIPE_PRICE_ANUAL=price_xxx
//
// Enquanto os IDs não existirem, as variáveis ficam indefinidas e
// o checkout retorna 400 para o plano solicitado.
// ---------------------------------------------------------------
const PLANS = {
  mensal: {
    priceId: process.env.STRIPE_PRICE_MENSAL,
    name: "Plano Mensal"
  },
  trimestral: {
    priceId: process.env.STRIPE_PRICE_TRIMESTRAL,
    name: "Plano Trimestral"
  },
  semestral: {
    priceId: process.env.STRIPE_PRICE_SEMESTRAL,
    name: "Plano Semestral"
  },
  anual: {
    priceId: process.env.STRIPE_PRICE_ANUAL,
    name: "Plano Anual"
  }
};

/**
 * Logger com formato consistente para facilitar leitura e busca em
 * ferramentas de log de produção (ex.: painel do Render).
 * Cada linha inclui timestamp ISO, um ícone indicando o nível e,
 * quando fornecido, um objeto de metadados serializado em JSON.
 *
 * @param {"info"|"warn"|"error"|"success"} level
 * @param {string} message - descrição curta do evento logado
 * @param {object} [meta] - dados estruturados adicionais (ids, valores, etc.)
 */
function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const icon = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅" }[level] || "";
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
  console.log(`[${ts}] ${icon} ${message} ${metaStr}`.trim());
}

/* ============================================================
   💾 LÓGICA DE NEGÓCIO
   ============================================================ */

/**
 * Busca o período de cobrança atual direto na Subscription do Stripe
 * (fonte da verdade real). Se a busca falhar por qualquer motivo (rede,
 * id ausente/inválido), cai para uma aproximação de 1 mês a partir do
 * timestamp do evento, em vez de travar a ativação por completo.
 *
 * @param {string} subscriptionId - ID da Subscription no Stripe (sub_xxx)
 * @param {number} eventTimestampSec - timestamp Unix (segundos) do evento webhook, usado como base do fallback
 * @returns {Promise<{periodStart: Date, periodEnd: Date}>}
 */
async function getBillingPeriod(subscriptionId, eventTimestampSec) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // A partir das API versions mais recentes do Stripe, current_period_start
    // e current_period_end saíram do objeto Subscription e passaram a viver
    // dentro de cada item da assinatura (subscription.items.data[]).
    // Buscamos primeiro no item (formato novo) e caímos para o campo antigo
    // no Subscription (formato legado) só por segurança/retrocompatibilidade.
    const item = subscription.items?.data?.[0];
    const rawStart = item?.current_period_start ?? subscription.current_period_start;
    const rawEnd = item?.current_period_end ?? subscription.current_period_end;

    if (!rawStart || !rawEnd) {
      throw new Error("current_period_start/end ausentes na Subscription retornada pelo Stripe");
    }

    return {
      periodStart: new Date(rawStart * 1000),
      periodEnd: new Date(rawEnd * 1000)
    };
  } catch (err) {
    log("warn", "Falha ao buscar período real da assinatura no Stripe, usando aproximação de 1 mês", {
      subscription_id: subscriptionId,
      error: err.message
    });
    const periodStart = new Date(eventTimestampSec * 1000);
    return { periodStart, periodEnd: addOneMonth(periodStart) };
  }
}

/**
 * Ativa (ou renova) a assinatura do usuário na tabela subscriptions.
 *
 * Idempotente: o período vem da própria Subscription do Stripe (ou, em
 * fallback, do timestamp do EVENTO), nunca do horário em que o webhook
 * é processado.
 *
 * Requer constraint UNIQUE em subscriptions.user_id (uma linha por usuário).
 */
/**
 * Ativa (ou renova) a assinatura do usuário na tabela subscriptions.
 *
 * Idempotente: o período vem da própria Subscription do Stripe (ou, em
 * fallback, do timestamp do EVENTO), nunca do horário em que o webhook
 * é processado.
 *
 * Requer constraint UNIQUE em subscriptions.user_id (uma linha por usuário).
 *
 * @param {object} params
 * @param {string} params.user_id - ID do usuário no Supabase Auth
 * @param {string|null} params.plan - identificador do plano (mensal, trimestral, etc.)
 * @param {string} params.sessionId - ID da Checkout Session que originou a assinatura
 * @param {string|null} params.subscriptionId - ID da Subscription no Stripe
 * @param {string|null} params.customerId - ID do Customer no Stripe
 * @param {number} params.eventTimestampSec - timestamp Unix do evento webhook (usado no fallback do período)
 * @returns {Promise<void>}
 * @throws Repassa o erro do Supabase para que o webhook responda 500 e o Stripe reentregue o evento.
 */
async function activateSubscription({ user_id, plan, sessionId, subscriptionId, customerId, eventTimestampSec }) {
  const { periodStart, periodEnd } = await getBillingPeriod(subscriptionId, eventTimestampSec);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id,
      status: "active",
      plan: plan || "mensal", // fallback caso metadata não chegue
      stripe_session_id: sessionId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      canceled_at: null, // limpa um cancelamento anterior, em caso de reassinatura
      cancel_at_period_end: false, // nova assinatura/reassinatura nunca começa já agendada pra cancelar
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    log("error", "Falha ao ativar assinatura no Supabase", {
      user_id,
      session_id: sessionId,
      error: error.message
    });
    throw error; // propaga para o webhook responder 500 e o Stripe reentregar
  }

  log("success", "Assinatura ativada/renovada", {
    user_id,
    plan,
    subscription_id: subscriptionId,
    current_period_end: periodEnd.toISOString()
  });
}

/**
 * Processa um evento checkout.session.completed: salva o pagamento (de
 * forma idempotente) e, se houver user_id, ativa a assinatura do usuário.
 *
 * @param {object} session - objeto Checkout Session (event.data.object)
 * @param {string} eventId - ID do evento Stripe, usado apenas para correlação em logs
 * @param {number} eventTimestampSec - timestamp Unix do evento, repassado a activateSubscription()
 * @returns {Promise<void>}
 * @throws Repassa erros do Supabase para que o webhook responda 500 e o Stripe reentregue o evento.
 */
async function handleCheckoutCompleted(session, eventId, eventTimestampSec) {
  const sessionId = session.id;
  const email = session.customer_details?.email ?? null;
  const amount = session.amount_total;
  const paymentStatus = session.payment_status;
  const subscriptionId = session.subscription ?? null;
  const customerId = session.customer ?? null;

  // user_id pode vir em metadata (preferencial) ou em client_reference_id
  // (fallback), gravados na criação da sessão de checkout.
  const user_id = session.metadata?.user_id || session.client_reference_id || null;

  // plan gravado em metadata na criação da sessão
  const plan = session.metadata?.plan || null;

  log("info", "checkout.session.completed recebido", {
    event_id: eventId,
    session_id: sessionId,
    subscription_id: subscriptionId,
    user_id,
    plan,
    email,
    amount,
    payment_status: paymentStatus
  });

  if (!user_id) {
    log("warn", "Sessão sem user_id em metadata/client_reference_id", { session_id: sessionId });
  }

  if (paymentStatus !== "paid") {
    log("warn", "payment_status diferente de 'paid', ignorando", {
      session_id: sessionId,
      payment_status: paymentStatus
    });
    return;
  }

  // Upsert idempotente do pagamento.
  // IMPORTANTE: exige constraint UNIQUE na coluna session_id.
  //   ALTER TABLE payments ADD CONSTRAINT payments_session_id_key UNIQUE (session_id);
  const { data: inserted, error: paymentError } = await supabase
    .from("payments")
    .upsert(
      { session_id: sessionId, email, amount, user_id, status: "paid" },
      { onConflict: "session_id", ignoreDuplicates: true }
    )
    .select();

  if (paymentError) {
    log("error", "Falha ao salvar pagamento no Supabase", {
      session_id: sessionId,
      error: paymentError.message
    });
    throw paymentError;
  }

  if (!inserted || inserted.length === 0) {
    log("warn", "Pagamento já existia — ignorado por idempotência", { session_id: sessionId });
  } else {
    log("success", "Pagamento salvo com sucesso", { session_id: sessionId });
  }

  // A ativação da assinatura roda SEMPRE, mesmo quando o pagamento já
  // existia (reentrega do Stripe).
  if (user_id) {
    await activateSubscription({ user_id, plan, sessionId, subscriptionId, customerId, eventTimestampSec });
  } else {
    log("warn", "Assinatura não ativada: pagamento sem user_id vinculado", {
      session_id: sessionId
    });
  }
}

/**
 * Processa um evento customer.subscription.deleted: marca a assinatura
 * como cancelada na tabela subscriptions.
 *
 * Identificação do usuário, em ordem de preferência:
 *   1) metadata.user_id da própria Subscription
 *   2) stripe_subscription_id salvo no Supabase
 *   3) stripe_customer_id salvo no Supabase
 */
async function handleSubscriptionDeleted(subscription, eventId) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer ?? null;
  const user_id = subscription.metadata?.user_id || null;

  log("info", "customer.subscription.deleted recebido", {
    event_id: eventId,
    subscription_id: subscriptionId,
    customer_id: customerId,
    user_id
  });

  let query = supabase.from("subscriptions").update({
    status: "canceled",
    canceled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (user_id) {
    query = query.eq("user_id", user_id);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "Evento subscription.deleted sem identificadores utilizáveis, ignorado", {
      event_id: eventId
    });
    return;
  }

  const { data, error } = await query.select();

  if (error) {
    log("error", "Falha ao cancelar assinatura no Supabase", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  if (!data || data.length === 0) {
    log("warn", "Nenhuma assinatura correspondente encontrada para cancelar", {
      subscription_id: subscriptionId,
      customer_id: customerId,
      user_id
    });
    return;
  }

  log("success", "Assinatura marcada como cancelada", {
    user_id: data[0]?.user_id,
    subscription_id: subscriptionId
  });
}

/**
 * Processa customer.subscription.updated: sincroniza status e período
 * da assinatura quando ela é alterada (ex.: trial → active, downgrade/upgrade).
 */
async function handleSubscriptionUpdated(subscriptionFromEvent, eventId) {
  const subscriptionId = subscriptionFromEvent.id;

  // IMPORTANTE: o Stripe NÃO garante que os webhooks cheguem na mesma ordem
  // em que os eventos aconteceram. Quando o cliente cancela pelo Portal, o
  // Stripe às vezes dispara mais de um customer.subscription.updated em
  // sequência rápida (ex.: uma atualização interna + o cancelamento em si).
  // Se confiássemos no snapshot que vem dentro do evento, um evento "antigo"
  // entregue fora de ordem poderia sobrescrever um estado mais novo (ex.:
  // reverter cancel_at_period_end de true para false).
  //
  // Por isso, em vez de usar subscriptionFromEvent diretamente, buscamos o
  // estado ATUAL e real da assinatura direto na API do Stripe. Isso resolve
  // o problema de ordem: não importa qual evento chegou primeiro, sempre
  // gravamos o dado mais atualizado que existe.
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    log("error", "Falha ao rebuscar assinatura atual no Stripe (customer.subscription.updated)", {
      subscription_id: subscriptionId,
      error: err.message
    });
    throw err;
  }

  const customerId = subscription.customer ?? null;
  const user_id = subscription.metadata?.user_id || null;
  const status = subscription.status; // active, past_due, canceled, etc.

  log("info", "customer.subscription.updated recebido", {
    event_id: eventId,
    subscription_id: subscriptionId,
    status,
    user_id,
    cancel_at_period_end_raw: subscription.cancel_at_period_end,
    cancel_at_raw: subscription.cancel_at
  });

  const item = subscription.items?.data?.[0];
  const rawPeriodStart = item?.current_period_start ?? subscription.current_period_start;
  const rawPeriodEnd = item?.current_period_end ?? subscription.current_period_end;

  const periodStart = rawPeriodStart ? new Date(rawPeriodStart * 1000).toISOString() : undefined;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : undefined;

  // Quando o cliente cancela pelo Portal, o Stripe agenda o fim para o
  // término do período já pago: status continua "active" até lá.
  //
  // IMPORTANTE: em assinaturas com billing_mode "flexible" (o padrão mais
  // recente), o Stripe pode indicar esse agendamento através do campo
  // cancel_at (timestamp futuro) em vez do booleano cancel_at_period_end —
  // então checamos os dois. Guardamos essa flag pra avisar o usuário no
  // site sem esperar o cancelamento efetivo (subscription.deleted).
  const cancelAtTimestamp = subscription.cancel_at;
  const hasFutureCancelAt = typeof cancelAtTimestamp === "number" && cancelAtTimestamp * 1000 > Date.now();
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end) || hasFutureCancelAt;

  const updatePayload = {
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
    ...(periodStart && { current_period_start: periodStart }),
    ...(periodEnd && { current_period_end: periodEnd })
  };

  let query = supabase.from("subscriptions").update(updatePayload);

  if (user_id) {
    query = query.eq("user_id", user_id);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "Evento subscription.updated sem identificadores utilizáveis, ignorado", {
      event_id: eventId
    });
    return;
  }

  const { data, error } = await query.select();

  if (error) {
    log("error", "Falha ao atualizar assinatura no Supabase", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  if (!data || data.length === 0) {
    log("warn", "customer.subscription.updated: nenhuma linha correspondente encontrada — nada foi atualizado", {
      subscription_id: subscriptionId,
      customer_id: customerId,
      user_id
    });
    return;
  }

  log("success", "Assinatura atualizada", {
    subscription_id: subscriptionId,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    matched_rows: data.length
  });
}

/**
 * Processa invoice.payment_failed: marca a assinatura como past_due
 * e registra na tabela payments (status: "failed").
 */
async function handlePaymentFailed(invoice, eventId) {
  const customerId = invoice.customer ?? null;
  const subscriptionId = invoice.subscription ?? null;
  const sessionId = invoice.id; // usa invoice.id como chave de idempotência
  const email = invoice.customer_email ?? null;
  const amount = invoice.amount_due ?? 0;

  log("info", "invoice.payment_failed recebido", {
    event_id: eventId,
    invoice_id: sessionId,
    subscription_id: subscriptionId,
    customer_id: customerId
  });

  // Salva o pagamento falho no histórico
  const { error: paymentError } = await supabase
    .from("payments")
    .upsert(
      { session_id: sessionId, email, amount, user_id: null, status: "failed" },
      { onConflict: "session_id", ignoreDuplicates: true }
    );

  if (paymentError) {
    log("warn", "Falha ao salvar pagamento falho no Supabase", {
      invoice_id: sessionId,
      error: paymentError.message
    });
  }

  // Marca assinatura como past_due
  let query = supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() });

  if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    log("warn", "invoice.payment_failed sem identificadores utilizáveis", { event_id: eventId });
    return;
  }

  const { error } = await query;
  if (error) {
    log("error", "Falha ao marcar assinatura como past_due", {
      subscription_id: subscriptionId,
      error: error.message
    });
    throw error;
  }

  log("success", "Assinatura marcada como past_due após falha de pagamento", {
    subscription_id: subscriptionId
  });
}

/* ============================================================
   🔥 WEBHOOK (PRECISA VIR ANTES DE express.json())
   ============================================================ */

/**
 * POST /webhook
 *
 * Endpoint de recebimento de eventos assíncronos do Stripe. É o
 * mecanismo pelo qual o Supabase fica sincronizado com o que realmente
 * acontece do lado do Stripe (pagamentos confirmados, cancelamentos,
 * falhas de cobrança), independente de o usuário estar com o site
 * aberto no navegador no momento em que o evento ocorre.
 *
 * IMPORTANTE — ordem dos middlewares: esta rota usa express.raw() em
 * vez de express.json() e precisa ser registrada ANTES de
 * app.use(express.json()) (ver seção MIDDLEWARE abaixo). A verificação
 * de assinatura do Stripe (stripe.webhooks.constructEvent) exige o
 * corpo da requisição em formato bruto (Buffer), byte a byte — se o
 * Express já tivesse parseado o JSON antes, a assinatura não bateria
 * e todo webhook seria rejeitado como inválido.
 *
 * Segurança: a validade do evento é garantida verificando a assinatura
 * enviada no header "stripe-signature" contra o STRIPE_WEBHOOK_SECRET
 * — sem isso, qualquer pessoa poderia forjar requisições simulando
 * pagamentos ou cancelamentos falsos.
 *
 * Contrato de resposta com o Stripe: retornar status 500 faz o Stripe
 * reentregar o mesmo evento automaticamente (com backoff), por isso
 * os handlers abaixo propagam (throw) os erros de gravação no Supabase
 * em vez de engoli-los — silenciar um erro aqui faria o evento ser
 * dado como processado quando na verdade falhou.
 *
 * No Dashboard/CLI do Stripe, este endpoint precisa estar inscrito em:
 *   - checkout.session.completed
 *   - customer.subscription.deleted
 *   - customer.subscription.updated
 *   - invoice.payment_failed
 */
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      log("error", "Requisição ao webhook sem header stripe-signature");
      return res.status(400).send("Webhook Error: missing signature");
    }

    // Verifica a assinatura e decodifica o payload em um evento Stripe
    // confiável. Qualquer falha aqui (assinatura inválida, secret
    // errado, corpo alterado) é tratada como requisição malformada/não
    // autêntica — nunca processada.
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      log("error", "Assinatura do webhook inválida", { error: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      log("info", "Evento Stripe recebido", { event_id: event.id, type: event.type });

      // Roteamento por tipo de evento — cada handler é responsável por
      // sua própria lógica de idempotência e persistência no Supabase.
      // Tipos não listados aqui são deliberadamente ignorados (apenas
      // logados), pois o endpoint está inscrito apenas nos eventos que
      // a aplicação realmente precisa tratar.
      if (event.type === "checkout.session.completed") {
        await handleCheckoutCompleted(event.data.object, event.id, event.created);
      } else if (event.type === "customer.subscription.deleted") {
        await handleSubscriptionDeleted(event.data.object, event.id);
      } else if (event.type === "customer.subscription.updated") {
        await handleSubscriptionUpdated(event.data.object, event.id);
      } else if (event.type === "invoice.payment_failed") {
        await handlePaymentFailed(event.data.object, event.id);
      } else {
        log("info", "Evento Stripe ignorado (tipo não tratado)", {
          event_id: event.id,
          type: event.type
        });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      log("error", "Erro ao processar evento do webhook", {
        event_id: event.id,
        error: err.message
      });
      // 500 faz o Stripe reentregar o evento automaticamente.
      return res.status(500).json({ error: "Erro ao processar evento." });
    }
  }
);

/* ============================================================
   🌐 MIDDLEWARE (sempre depois da rota /webhook)
   ============================================================ */

// Segurança: cabeçalhos HTTP seguros (CSP, HSTS, X-Frame-Options, etc.)
// via Helmet, com a Content Security Policy customizada para permitir
// exatamente os domínios externos que o front-end realmente usa
// (fontes do Google Fonts, SDK do Supabase via CDN, imagens de bancos
// de imagem e do Google Maps) — evitando tanto bloquear recursos
// legítimos quanto deixar a política liberal demais.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://media.istockphoto.com",
          "https://maps.google.com",
          "https://maps.gstatic.com",
          "https://*.googleapis.com",
          "https://*.gstatic.com"
        ],
        frameSrc: ["https://maps.google.com", "https://www.google.com"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "https://maps.google.com",
          "https://www.google.com"
        ]
      }
    }
  })
);

// Parser de JSON para todas as rotas registradas a partir daqui —
// deliberadamente após a rota /webhook, que precisa do corpo bruto
// (ver comentário na definição do webhook acima).
app.use(express.json());
// Serve os arquivos estáticos do front-end (HTML, CSS, JS, imagens)
// diretamente da pasta /public.
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   🌍 ROTAS
   ============================================================ */

// Rota raiz: serve a landing page estática. As demais páginas .html
// (login, minha-conta, sucesso, cancelado) já são entregues diretamente
// pelo middleware express.static configurado acima.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rate limit: máximo 10 tentativas por minuto por IP na rota de checkout,
// para evitar abuso (criação de dezenas de sessões por segundo).
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde um momento e tente novamente." }
});

/**
 * POST /create-checkout-session
 *
 * Cria uma Stripe Checkout Session para o plano solicitado e devolve
 * a URL de redirecionamento para o front-end (auth.js chama esta rota
 * e navega o navegador até session.url).
 *
 * Segurança:
 *  - Exige um JWT válido do Supabase Auth no header Authorization
 *    (Bearer token); user_id e e-mail são extraídos do token
 *    verificado no servidor, nunca aceitos do corpo da requisição.
 *  - O price_id do Stripe nunca é recebido do cliente — apenas um
 *    identificador de plano (plan_id), validado contra a allowlist
 *    PLANS definida no servidor. Isso impede que alguém manipule a
 *    requisição para pagar um valor diferente do configurado.
 *
 * Body esperado: { plan_id: "mensal" | "trimestral" | "semestral" | "anual" }
 *
 * Respostas:
 *  - 200 { url } — sessão criada com sucesso
 *  - 400 — plan_id ausente ou inválido
 *  - 401 — token ausente/inválido
 *  - 503 — plano válido mas sem price_id configurado no .env
 *  - 500 — erro inesperado ao criar a sessão no Stripe
 */
app.post("/create-checkout-session", checkoutLimiter, async (req, res) => {
  try {
    // ---------------------------------------------------------------
    // TAREFA 5: Validar JWT antes de qualquer outra coisa.
    // O user_id e email vêm do token, nunca do body — assim um cliente
    // malicioso não pode se passar por outro usuário.
    // ---------------------------------------------------------------
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ error: "Não autenticado. Token ausente." });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      log("warn", "Token JWT inválido na rota de checkout", {
        error: authError?.message
      });
      return res.status(401).json({ error: "Não autenticado. Token inválido ou expirado." });
    }

    const user_id = authData.user.id;
    const email = authData.user.email;

    // ---------------------------------------------------------------
    // TAREFA 3: Validar o plano contra a allowlist do servidor.
    // O price_id nunca vem do body — apenas o nome do plano,
    // e o servidor resolve o price_id correspondente.
    // ---------------------------------------------------------------
    const { plan_id } = req.body ?? {};

    if (!plan_id || !PLANS[plan_id]) {
      return res.status(400).json({
        error: `Plano inválido. Escolha um de: ${Object.keys(PLANS).join(", ")}.`
      });
    }

    const plan = PLANS[plan_id];

    if (!plan.priceId) {
      log("warn", "Price ID não configurado para o plano", { plan_id });
      return res.status(503).json({
        error: `O plano "${plan_id}" ainda não está disponível. Tente novamente em breve.`
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      // price referencia o Price criado no Stripe Dashboard — o valor
      // e o intervalo de cobrança estão definidos lá, não aqui.
      line_items: [
        {
          price: plan.priceId,
          quantity: 1
        }
      ],

      success_url: `${BASE_URL}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancelado.html`,

      // Liga o usuário à sessão de duas formas redundantes.
      client_reference_id: String(user_id),
      metadata: {
        user_id: String(user_id),
        email: String(email),
        plan: plan_id // gravado no Supabase pelo webhook
      },

      // Grava user_id e plan na própria Subscription (não só na Session).
      // Essencial para o evento customer.subscription.deleted, que entrega
      // o objeto Subscription sem referência à Session original.
      subscription_data: {
        metadata: {
          user_id: String(user_id),
          plan: plan_id
        }
      },

      // Pré-preenche o e-mail no checkout para melhor UX
      customer_email: email
    });

    log("info", "Sessão de checkout criada", {
      session_id: session.id,
      user_id,
      plan: plan_id
    });
    res.json({ url: session.url });
  } catch (error) {
    log("error", "Erro ao criar sessão de checkout no Stripe", { error: error.message });
    res.status(500).json({ error: "Não foi possível iniciar o pagamento." });
  }
});

// ---------------------------------------------------------------
// PORTAL DO CLIENTE (Stripe Billing Portal)
//
// Permite que o usuário logado gerencie a própria assinatura:
// trocar cartão, ver faturas, atualizar dados e cancelar
// (cancelamento fica agendado para o fim do período vigente,
// conforme configurado no Dashboard do Stripe > Portal do cliente).
// ---------------------------------------------------------------

/**
 * Middleware de autenticação por JWT do Supabase, reaproveitado pelas
 * rotas de conta/assinatura abaixo (GET /minha-assinatura e
 * POST /create-portal-session).
 *
 * Extrai o token do header "Authorization: Bearer <token>", valida
 * junto ao Supabase Auth e, em caso de sucesso, injeta o usuário
 * autenticado em req.user para uso pelo handler da rota. Responde
 * 401 diretamente e interrompe a cadeia caso o token esteja ausente
 * ou seja inválido/expirado.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(401).json({ error: "Não autenticado. Token ausente." });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    log("warn", "Token JWT inválido em rota autenticada", { error: authError?.message });
    return res.status(401).json({ error: "Não autenticado. Token inválido ou expirado." });
  }

  req.user = authData.user;
  next();
}

// Rate limit: máximo 10 tentativas por minuto por IP nas rotas de
// conta/portal — mesmo raciocínio do checkoutLimiter, mas aplicado
// apenas à criação de sessões do Portal do Cliente (POST, mais sensível
// por criar uma sessão autenticada no Stripe a cada chamada).
const portalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde um momento e tente novamente." }
});

/**
 * GET /minha-assinatura
 *
 * Retorna os dados da assinatura do usuário autenticado (plano, status,
 * data da próxima cobrança ou de cancelamento, e se há um cancelamento
 * agendado), para exibição na tela "Minha Conta" (conta.js).
 *
 * Requer autenticação (middleware requireAuth). O stripe_customer_id é
 * deliberadamente removido da resposta antes de enviá-la ao front-end —
 * é um identificador interno do Stripe sem utilidade para o usuário e
 * que não deve ser exposto desnecessariamente no cliente.
 *
 * Respostas:
 *  - 200 { plan, status, current_period_end, canceled_at, cancel_at_period_end }
 *  - 404 — usuário autenticado, porém sem nenhuma assinatura registrada
 *  - 500 — erro ao consultar o Supabase
 */
app.get("/minha-assinatura", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, canceled_at, cancel_at_period_end, stripe_customer_id")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      log("error", "Falha ao buscar assinatura no Supabase", { user_id: req.user.id, error: error.message });
      return res.status(500).json({ error: "Não foi possível carregar sua assinatura." });
    }

    if (!data) {
      return res.status(404).json({ error: "Nenhuma assinatura encontrada para este usuário." });
    }

    // Nunca expõe o stripe_customer_id ao frontend.
    const { stripe_customer_id, ...safeData } = data;
    res.json(safeData);
  } catch (error) {
    log("error", "Erro ao buscar assinatura", { user_id: req.user.id, error: error.message });
    res.status(500).json({ error: "Não foi possível carregar sua assinatura." });
  }
});

/**
 * POST /create-portal-session
 *
 * Cria uma sessão do Stripe Billing Portal para o usuário autenticado
 * e devolve a URL de redirecionamento (conta.js navega o navegador até
 * essa URL). Dentro do Portal, o usuário pode trocar cartão, ver/baixar
 * faturas, atualizar dados cadastrais e cancelar a assinatura — o
 * comportamento exato do cancelamento (imediato ou no fim do período)
 * é configurado no Dashboard do Stripe, não neste código.
 *
 * Requer autenticação (middleware requireAuth) e que o usuário já
 * possua um stripe_customer_id salvo (ou seja, já tenha assinado ao
 * menos uma vez).
 *
 * Respostas:
 *  - 200 { url }
 *  - 404 — usuário sem assinatura/stripe_customer_id registrado
 *  - 500 — erro ao consultar o Supabase ou criar a sessão no Stripe
 */
app.post("/create-portal-session", portalLimiter, requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      log("error", "Falha ao buscar stripe_customer_id no Supabase", {
        user_id: req.user.id,
        error: error.message
      });
      return res.status(500).json({ error: "Não foi possível abrir o portal de assinatura." });
    }

    if (!data?.stripe_customer_id) {
      return res.status(404).json({
        error: "Nenhuma assinatura encontrada. Assine um plano antes de acessar o portal."
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${BASE_URL}/minha-conta.html`
    });

    log("info", "Sessão do portal do cliente criada", {
      user_id: req.user.id,
      customer_id: data.stripe_customer_id
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    log("error", "Erro ao criar sessão do portal do cliente", {
      user_id: req.user.id,
      error: error.message
    });
    res.status(500).json({ error: "Não foi possível abrir o portal de assinatura." });
  }
});

/* ============================================================
   🛑 INICIALIZAÇÃO
   ============================================================ */

// Rede de segurança global contra promises rejeitadas sem .catch —
// apenas loga o erro, sem derrubar o processo, pois um unhandledRejection
// isolado normalmente não compromete a integridade do restante da
// aplicação (diferente de uncaughtException, abaixo).
process.on("unhandledRejection", (reason) => {
  log("error", "unhandledRejection", { reason: reason?.message || String(reason) });
});

// Erros síncronos não capturados deixam o processo em estado
// potencialmente inconsistente — por isso, diferente do handler acima,
// aqui se opta por encerrar o processo (process.exit) após logar,
// confiando que a plataforma de hospedagem (ex.: Render) reinicie o
// serviço automaticamente, em vez de manter um processo comprometido no ar.
process.on("uncaughtException", (err) => {
  log("error", "uncaughtException — encerrando processo", { error: err.message });
  process.exit(1);
});

// Porta configurável via variável de ambiente PORT — necessário em
// plataformas de hospedagem (Render, Heroku, etc.) que atribuem a
// porta dinamicamente; localmente cai no padrão 3000.
const PORT = process.env.PORT || 3000;

// Só sobe o servidor de verdade (ocupando uma porta) quando este arquivo
// é executado diretamente (`node server.js` / `npm start`). Quando é
// importado por outro módulo — como os testes de integração em
// tests/integration/*.test.js, via Supertest — apenas o `app` exportado
// abaixo é usado, sem escutar nenhuma porta.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

// Exportado para os testes de integração (Supertest usa isso para simular
// requisições HTTP sem precisar de um servidor real escutando uma porta).
module.exports = app;