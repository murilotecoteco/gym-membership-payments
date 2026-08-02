/**
 * conta.js
 * ------------------------------------------------------------------
 * Lógica da página "Minha Conta" (minha-conta.html):
 *  - Confirma que há um usuário logado (redireciona para login.html
 *    caso contrário)
 *  - Busca os dados da assinatura em GET /minha-assinatura
 *  - Abre o Portal do Cliente Stripe via POST /create-portal-session
 *    (troca de cartão, faturas, dados cadastrais, cancelamento agendado
 *    para o fim do período — tudo configurado do lado do Stripe)
 * ------------------------------------------------------------------
 */

import { supabase } from "./supabase.js";

// Referências aos elementos da UI (minha-conta.html). Todo acesso usa
// optional chaining (?.) para o script não quebrar caso algum elemento
// tenha sido removido/renomeado no HTML.
const userEmailEl = document.getElementById("user-email");
const cardLoadingEl = document.getElementById("card-loading");
const cardEmptyEl = document.getElementById("card-empty");
const cardSubEl = document.getElementById("card-subscription");

const planNameEl = document.getElementById("sub-plan");
const statusBadgeEl = document.getElementById("sub-status");
const periodLabelEl = document.getElementById("sub-period-label");
const periodEndEl = document.getElementById("sub-period-end");
const cancelNoticeEl = document.getElementById("sub-cancel-notice");

const btnPortal = document.getElementById("btn-portal");
const btnLogout = document.getElementById("btn-logout");
const portalStatusEl = document.getElementById("portal-status");

// Nomes amigáveis dos planos para exibição (o backend trabalha com os
// identificadores brutos: mensal, trimestral, semestral, anual).
const PLAN_LABELS = {
  mensal: "Plano Mensal",
  trimestral: "Plano Trimestral",
  semestral: "Plano Semestral",
  anual: "Plano Anual"
};

// Mapeia cada status possível de uma Subscription do Stripe para um
// rótulo em português e uma classe CSS de badge correspondente.
const STATUS_LABELS = {
  active: { label: "Ativa", className: "badge-active" },
  trialing: { label: "Período de teste", className: "badge-active" },
  past_due: { label: "Pagamento pendente", className: "badge-warning" },
  canceled: { label: "Cancelada", className: "badge-canceled" },
  unpaid: { label: "Não paga", className: "badge-warning" },
  incomplete: { label: "Incompleta", className: "badge-warning" },
  incomplete_expired: { label: "Expirada", className: "badge-canceled" }
};

/**
 * Formata uma data ISO (ex.: "2026-12-31T00:00:00.000Z") para o padrão
 * brasileiro por extenso (ex.: "31 de dezembro de 2026").
 *
 * @param {string|null} isoString - data em formato ISO 8601, ou null/undefined
 * @returns {string} data formatada, ou "—" se não houver valor
 */
function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Exibe uma mensagem de feedback abaixo do botão do Portal do Cliente
 * (ex.: erros de rede ao abrir o portal). Não faz nada se o elemento
 * #portal-status não existir no DOM.
 *
 * @param {string} message
 * @param {string} [type] - classe CSS aplicada ao elemento (ex.: "error")
 */
function setPortalStatus(message, type = "") {
  if (!portalStatusEl) return;
  portalStatusEl.textContent = message;
  portalStatusEl.className = type;
}

/**
 * Alterna a UI para o estado "sem assinatura": esconde o loading e o
 * card de detalhes, exibindo a mensagem de estado vazio no lugar.
 * Usado quando GET /minha-assinatura retorna 404 (usuário nunca
 * assinou) ou quando a requisição falha por qualquer motivo.
 */
function showEmptyState() {
  cardLoadingEl?.classList.add("hidden");
  cardSubEl?.classList.add("hidden");
  cardEmptyEl?.classList.remove("hidden");
}

/**
 * Renderiza o card de detalhes da assinatura com os dados retornados
 * pelo backend (GET /minha-assinatura).
 *
 * Trata três estados possíveis, priorizados nesta ordem:
 *  1) Cancelada de fato (status === "canceled") — mostra a data em que
 *     o cancelamento se efetivou.
 *  2) Cancelamento agendado (cancel_at_period_end === true, mas ainda
 *     ativa) — o usuário cancelou pelo Portal, mas o acesso continua
 *     valendo até o fim do período já pago. Mostra "Acesso até" em vez
 *     de "Próxima cobrança", com um aviso explicando que não haverá
 *     nova cobrança.
 *  3) Assinatura normal, ativa e recorrente — mostra a data da próxima
 *     cobrança.
 *
 * @param {object} sub - objeto retornado por GET /minha-assinatura
 * @param {string} sub.plan - identificador do plano (mensal, trimestral, etc.)
 * @param {string} sub.status - status bruto da assinatura no Stripe
 * @param {string|null} sub.current_period_end - fim do período de cobrança vigente (ISO)
 * @param {string|null} sub.canceled_at - data em que a assinatura foi efetivamente cancelada (ISO)
 * @param {boolean} sub.cancel_at_period_end - true se há um cancelamento agendado para o fim do período
 */
function showSubscription(sub) {
  cardLoadingEl?.classList.add("hidden");
  cardEmptyEl?.classList.add("hidden");
  cardSubEl?.classList.remove("hidden");

  if (planNameEl) planNameEl.textContent = PLAN_LABELS[sub.plan] || sub.plan || "—";

  const statusInfo = STATUS_LABELS[sub.status] || { label: sub.status, className: "badge-warning" };
  if (statusBadgeEl) {
    statusBadgeEl.textContent = statusInfo.label;
    statusBadgeEl.className = `sub-badge ${statusInfo.className}`;
  }

  const isCanceled = sub.status === "canceled";
  // Cancelamento agendado pelo Portal: ainda ativo, mas não vai renovar.
  const isScheduledToCancel = !isCanceled && sub.cancel_at_period_end === true;

  if (periodEndEl) {
    periodEndEl.textContent = isCanceled
      ? formatDate(sub.canceled_at)
      : formatDate(sub.current_period_end);
  }

  if (periodLabelEl) {
    if (isCanceled) {
      periodLabelEl.textContent = "Cancelada em";
    } else if (isScheduledToCancel) {
      periodLabelEl.textContent = "Acesso até";
    } else {
      periodLabelEl.textContent = "Próxima cobrança";
    }
  }

  if (cancelNoticeEl) {
    cancelNoticeEl.classList.toggle("hidden", !isCanceled && !isScheduledToCancel);
    if (isScheduledToCancel) {
      cancelNoticeEl.textContent = "Cancelamento agendado — sem novas cobranças, acesso liberado até a data acima.";
    }
  }
}

/**
 * Redireciona o usuário para o Portal do Cliente Stripe, onde ele pode
 * trocar o cartão, ver/baixar faturas, atualizar dados cadastrais e
 * cancelar a assinatura (efetivado apenas no fim do período pago).
 *
 * @param {HTMLElement|null} btnEl - botão que disparou a ação, desabilitado durante a requisição
 * @returns {Promise<void>}
 */
async function abrirPortal(btnEl) {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.access_token) {
    window.location.href = "/login.html";
    return;
  }

  const originalText = btnEl?.textContent;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Abrindo portal...";
  }
  setPortalStatus("");

  try {
    const response = await fetch("/create-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      }
    });

    let result;
    try {
      result = await response.json();
    } catch (_) {
      result = null;
    }

    if (!response.ok) {
      setPortalStatus(result?.error || `Erro ao abrir o portal (HTTP ${response.status}).`, "error");
      return;
    }

    if (!result?.url) {
      setPortalStatus("Erro ao abrir o portal: URL não recebida.", "error");
      return;
    }

    window.location.href = result.url;
  } catch (err) {
    console.error(err);
    setPortalStatus("Erro de conexão. Verifique sua internet e tente novamente.", "error");
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }
}

/**
 * Busca os dados da assinatura do usuário logado em GET /minha-assinatura
 * e atualiza a UI de acordo com o resultado.
 *
 * Trata explicitamente o caso 404 (usuário sem assinatura) como um
 * estado válido de "vazio", não como erro — apenas falhas inesperadas
 * (rede, 500, etc.) caem no catch e também resultam no estado vazio,
 * para nunca deixar a tela travada em "carregando".
 *
 * @param {string} accessToken - JWT do Supabase do usuário autenticado
 * @returns {Promise<void>}
 */
async function carregarAssinatura(accessToken) {
  try {
    const response = await fetch("/minha-assinatura", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.status === 404) {
      showEmptyState();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const sub = await response.json();
    showSubscription(sub);
  } catch (err) {
    console.error(err);
    showEmptyState();
  }
}

/**
 * Ponto de entrada da página. Garante que só usuários autenticados
 * vejam a página "Minha Conta" (redireciona para login.html caso
 * contrário) e dispara o carregamento dos dados da assinatura.
 *
 * @returns {Promise<void>}
 */
async function init() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    window.location.href = "/login.html";
    return;
  }

  if (userEmailEl) userEmailEl.textContent = session.user.email;

  await carregarAssinatura(session.access_token);
}

btnPortal?.addEventListener("click", () => abrirPortal(btnPortal));

btnLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

// Inicializa a página assim que o script é carregado.
init();