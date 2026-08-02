/**
 * auth.js
 * ------------------------------------------------------------------
 * Camada de autenticação e pagamento do frontend.
 *
 * Responsabilidades:
 *  - Cadastro e login de usuários via Supabase Auth
 *  - Logout e obtenção do usuário autenticado (ponto único: getCurrentUser)
 *  - Início do fluxo de pagamento via Stripe Checkout, chamando o backend
 *    em POST /create-checkout-session com JWT de autenticação
 *  - Feedback de status para o usuário, com fallback seguro caso o
 *    elemento de status não exista no DOM
 *
 * Seções: INTERFACE → USUÁRIO → AUTENTICAÇÃO → PAGAMENTO → EVENTOS
 * ------------------------------------------------------------------
 */

import { supabase } from "./supabase.js";

/* ============================================================
   INTERFACE — referências de DOM, status e validação de formulário
   ============================================================ */

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("status");

const btnRegister = document.getElementById("btn-register");
const btnLogin = document.getElementById("btn-login");
const btnGetUser = document.getElementById("btn-getuser");
const btnLogout = document.getElementById("btn-logout");

// Recuperação de senha
const authBox = document.querySelector(".auth-box");
const recoveryBox = document.getElementById("recovery-box");
const recoveryEmailInput = document.getElementById("recovery-email");
const linkForgotPassword = document.getElementById("link-forgot-password");
const btnSendRecovery = document.getElementById("btn-send-recovery");
const btnBackToLogin = document.getElementById("btn-back-to-login");

// URL para onde o Supabase redireciona o usuário após clicar no link do
// e-mail de recuperação. Essa URL precisa estar cadastrada em Supabase >
// Authentication > URL Configuration > Redirect URLs, senão o Supabase
// recusa o redirecionamento.
const REDIRECT_RESET_PASSWORD = `${window.location.origin}/redefinir-senha.html`;

// Tamanho mínimo de senha — deve ser igual ou maior que o mínimo
// configurado em Supabase > Authentication > Policies (padrão: 6).
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================
   RETOMADA DE COMPRA — login.html?redirect=planos&plan=mensal
   ============================================================ */

// Nomes amigáveis dos planos, usados só para exibição de mensagens.
const PLAN_LABELS = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual"
};

/**
 * Lê os parâmetros ?redirect=planos&plan=X da URL atual.
 * Retorna o planId pendente (ex: "mensal") se o usuário veio do clique
 * em um plano e ainda não estava logado, ou null caso contrário.
 */
function getPendingPlan() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("redirect") !== "planos") return null;

  const plan = params.get("plan");
  return plan && PLAN_LABELS[plan] ? plan : null;
}

/**
 * Exibe uma mensagem de status para o usuário.
 * Se #status não existir no DOM, usa console.log/alert como fallback
 * seguro (nunca lança erro por elemento ausente).
 */
function setStatus(message, type = "") {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
    return;
  }

  if (type === "error") {
    console.error(message);
    alert(message);
  } else {
    console.log(message);
  }
}

/**
 * Lê e valida e-mail/senha dos campos do formulário:
 *  - presença dos dois campos
 *  - formato de e-mail
 *  - tamanho mínimo de senha
 * Retorna null (já exibindo o status de erro) se algo for inválido.
 */
function getCredentials() {
  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    setStatus("Preencha e-mail e senha.", "error");
    return null;
  }

  if (!EMAIL_REGEX.test(email)) {
    setStatus("Informe um e-mail válido.", "error");
    return null;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    setStatus(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, "error");
    return null;
  }

  return { email, password };
}

/* ============================================================
   USUÁRIO — ponto único de acesso ao usuário autenticado
   ============================================================ */

/**
 * Única função do arquivo que chama supabase.auth.getUser().
 * Usada por todas as rotinas que precisam saber quem está logado
 * (verificação de usuário, logout e pagamento), evitando chamadas
 * duplicadas e lógica de validação repetida.
 *
 * @param {boolean} silent - se true, não exibe status de erro (quem chamou decide a mensagem)
 * @returns {Promise<object|null>} usuário autenticado ou null
 */
async function getCurrentUser(silent = false) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    if (!silent) setStatus("Nenhum usuário logado.", "error");
    return null;
  }

  return data.user;
}

/* ============================================================
   AUTENTICAÇÃO — cadastro, login, logout e verificação
   ============================================================ */

/**
 * Cria uma nova conta de usuário via Supabase Auth (e-mail + senha).
 *
 * Se o projeto Supabase estiver configurado sem confirmação de e-mail
 * obrigatória, o cadastro já retorna com sessão ativa — nesse caso, se
 * o usuário veio do clique em um plano (ver getPendingPlan), o fluxo de
 * pagamento é retomado automaticamente, sem exigir um novo clique.
 *
 * @returns {Promise<void>}
 */
async function registerUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Criando conta...");

  const { data, error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    setStatus("Erro ao criar conta: " + error.message, "error");
    return;
  }

  console.log("Cadastro:", data.user);

  // Se o cadastro já vem com sessão ativa (confirmação de e-mail desativada
  // no projeto Supabase) e o usuário veio de um clique em um plano,
  // retoma a compra automaticamente em vez de só mostrar status.
  if (data.session) {
    const pendingPlan = getPendingPlan();
    if (pendingPlan) {
      setStatus(`Conta criada! Redirecionando para o pagamento do plano ${PLAN_LABELS[pendingPlan]}...`, "success");
      await pagar(pendingPlan);
      return;
    }
  }

  setStatus("Conta criada com sucesso!", "success");
}

/**
 * Autentica um usuário existente via Supabase Auth (e-mail + senha).
 *
 * Assim como em registerUser, se o login foi originado por um clique
 * em um plano (usuário não estava logado e foi redirecionado para cá),
 * a compra pendente é retomada automaticamente após o login bem-sucedido.
 *
 * @returns {Promise<void>}
 */
async function loginUser() {
  const creds = getCredentials();
  if (!creds) return;

  setStatus("Fazendo login...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password
  });

  if (error) {
    setStatus("Erro ao fazer login: " + error.message, "error");
    return;
  }

  console.log("Login:", data.user);

  // Se o usuário veio do clique em um plano (redirecionado pra cá por
  // pagar(), em auth.js), retoma a compra automaticamente assim que o
  // login é confirmado — sem precisar voltar pro site e clicar de novo.
  const pendingPlan = getPendingPlan();
  if (pendingPlan) {
    setStatus(`Login realizado! Redirecionando para o pagamento do plano ${PLAN_LABELS[pendingPlan]}...`, "success");
    await pagar(pendingPlan);
    return;
  }

  setStatus("Login realizado!", "success");
}

/**
 * Encerra a sessão do usuário atual (Supabase Auth signOut).
 *
 * @returns {Promise<void>}
 */
async function logoutUser() {
  // Usa getCurrentUser para confirmar que existe sessão antes de sair,
  // evitando uma chamada de signOut desnecessária quando já não há usuário.
  const user = await getCurrentUser(true);

  if (!user) {
    setStatus("Nenhum usuário logado para sair.", "error");
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus("Erro ao sair: " + error.message, "error");
    return;
  }

  setStatus("Logout realizado.", "success");
}

/**
 * Handler de UI para mostrar o usuário atual.
 * Toda a lógica de obtenção/validação vive em getCurrentUser();
 * aqui só cuidamos da mensagem específica deste botão.
 */
async function showCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return; // getCurrentUser já exibiu o status de erro

  setStatus(`Logado: ${user.email}`, "success");
}

/* ============================================================
   RECUPERAÇÃO DE SENHA — envio do e-mail de redefinição
   ============================================================ */

/**
 * Alterna a exibição entre o formulário de login/cadastro e o
 * formulário de recuperação de senha, dentro do mesmo cartão (.auth-box).
 *
 * @param {boolean} showRecovery - true para mostrar o bloco de recuperação
 */
function toggleRecoveryView(showRecovery) {
  if (!authBox || !recoveryBox) return;

  authBox.classList.toggle("recovery-active", showRecovery);
  recoveryBox.classList.toggle("active", showRecovery);

  // Limpa o status ao trocar de tela, para não misturar mensagens
  // de um formulário com o outro.
  setStatus("");

  if (showRecovery && recoveryEmailInput && emailInput) {
    // Pré-preenche o e-mail de recuperação com o que já foi digitado
    // no formulário de login, se houver, poupando o usuário de digitar de novo.
    recoveryEmailInput.value = emailInput.value.trim();
    recoveryEmailInput.focus();
  }
}

/**
 * Envia o e-mail de recuperação de senha via Supabase Auth.
 *
 * O Supabase envia um link para o e-mail informado; ao clicar, o usuário
 * é levado para REDIRECT_RESET_PASSWORD (redefinir-senha.html) já com uma
 * sessão temporária de recuperação, usada para definir a nova senha.
 *
 * Por segurança, o Supabase não informa se o e-mail existe ou não na
 * base — por isso a mensagem de sucesso é sempre genérica.
 *
 * @returns {Promise<void>}
 */
async function requestPasswordReset() {
  const email = recoveryEmailInput?.value?.trim();

  if (!email) {
    setStatus("Informe seu e-mail para recuperar a senha.", "error");
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    setStatus("Informe um e-mail válido.", "error");
    return;
  }

  setStatus("Enviando link de recuperação...");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_RESET_PASSWORD
  });

  if (error) {
    setStatus("Erro ao enviar link de recuperação: " + error.message, "error");
    return;
  }

  setStatus(
    "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também a caixa de spam.",
    "success"
  );
}

/* ============================================================
   PAGAMENTO — Stripe Checkout
   ============================================================ */

// Evita que cliques duplicados no botão de pagamento criem mais de
// uma sessão de checkout ao mesmo tempo.
let isProcessingPayment = false;

/**
 * Inicia o fluxo de pagamento para o plano informado.
 *
 * @param {string} planId - identificador do plano: "mensal" | "trimestral" | "semestral" | "anual"
 * @param {HTMLElement|null} btnEl - botão que disparou o clique (para desabilitar durante o processo)
 * @returns {Promise<void>}
 */
export async function pagar(planId, btnEl = null) {
  if (isProcessingPayment) return;

  // Obtém a sessão (token JWT) do Supabase — mais confiável que getUser()
  // pois retorna o token mesmo offline (cached), que é o que precisamos enviar.
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session?.access_token) {
    // Usuário não logado — redireciona para a página de login, levando o
    // plano escolhido na URL. Ao logar/cadastrar com sucesso, login.html
    // (via getPendingPlan() em auth.js) retoma esta compra automaticamente.
    window.location.href = `/login.html?redirect=planos&plan=${encodeURIComponent(planId)}`;
    return;
  }

  isProcessingPayment = true;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.dataset.originalText = btnEl.textContent;
    btnEl.textContent = "Aguarde...";
  }

  try {
    let response;
    try {
      response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // TAREFA 5: Envia o JWT validado pelo servidor — nunca user_id no body.
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ plan_id: planId })
      });
    } catch (networkError) {
      console.error(networkError);
      alert("Erro de conexão ao iniciar o pagamento. Verifique sua internet e tente novamente.");
      return;
    }

    if (!response.ok) {
      let msg = `Erro ao criar checkout (HTTP ${response.status}).`;
      try {
        const errData = await response.json();
        if (errData?.error) msg = errData.error;
      } catch (_) { /* ignora erro de parse */ }
      alert(msg);
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error(parseError);
      alert("Resposta inválida do servidor de pagamento.");
      return;
    }

    if (!result?.url) {
      alert("Erro ao criar checkout: URL não recebida.");
      return;
    }

    window.location.href = result.url;
  } finally {
    isProcessingPayment = false;
    if (btnEl) {
      btnEl.disabled = false;
      if (btnEl.dataset.originalText) {
        btnEl.textContent = btnEl.dataset.originalText;
      }
    }
  }
}

/* ============================================================
   EVENTOS — ligação das funções com a interface (login.html)
   ============================================================ */

btnRegister?.addEventListener("click", registerUser);
btnLogin?.addEventListener("click", loginUser);
btnGetUser?.addEventListener("click", showCurrentUser);
btnLogout?.addEventListener("click", logoutUser);

linkForgotPassword?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleRecoveryView(true);
});
btnBackToLogin?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleRecoveryView(false);
});
btnSendRecovery?.addEventListener("click", requestPasswordReset);

// Avisa o usuário, já ao carregar a página, por que ele caiu na tela de
// login — caso tenha vindo de um clique em um plano (ver getPendingPlan).
const pendingPlanOnLoad = getPendingPlan();
if (pendingPlanOnLoad) {
  setStatus(`Faça login ou crie uma conta para continuar a assinatura do plano ${PLAN_LABELS[pendingPlanOnLoad]}.`);
}