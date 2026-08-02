/**
 * redefinir-senha.js
 * ------------------------------------------------------------------
 * Lógica da página de destino do link de recuperação de senha.
 *
 * Fluxo:
 *  1. Usuário clica em "Esqueceu sua senha?" em login.html e informa
 *     o e-mail (auth.js -> supabase.auth.resetPasswordForEmail).
 *  2. Supabase envia um e-mail com um link apontando para esta página
 *     (redirectTo configurado em auth.js).
 *  3. Ao abrir o link, o supabase-js detecta o token na URL e cria uma
 *     sessão TEMPORÁRIA de recuperação, disparando o evento
 *     "PASSWORD_RECOVERY" via onAuthStateChange.
 *  4. Com essa sessão ativa, chamamos supabase.auth.updateUser({ password })
 *     para definir a nova senha — sem precisar da senha antiga.
 *
 * Se o usuário abrir esta página sem vir de um link válido (ou o link
 * já expirou/foi usado), nenhuma sessão de recuperação é criada e o
 * formulário é bloqueado com uma mensagem de erro.
 * ------------------------------------------------------------------
 */

import { supabase } from "./supabase.js";

const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const btnUpdatePassword = document.getElementById("btn-update-password");
const statusEl = document.getElementById("status");

const MIN_PASSWORD_LENGTH = 6;

// Só permite tentar salvar a senha depois que uma sessão de recuperação
// válida for confirmada (evento PASSWORD_RECOVERY ou sessão já existente).
let recoveryReady = false;

/**
 * Exibe uma mensagem de status para o usuário.
 * Mesmo padrão usado em auth.js, com fallback seguro caso #status não exista.
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
 * Habilita/desabilita o formulário conforme a existência de uma
 * sessão de recuperação válida.
 */
function setFormEnabled(enabled) {
  if (newPasswordInput) newPasswordInput.disabled = !enabled;
  if (confirmPasswordInput) confirmPasswordInput.disabled = !enabled;
  if (btnUpdatePassword) btnUpdatePassword.disabled = !enabled;
}

// Formulário começa desabilitado até confirmarmos a sessão de recuperação.
setFormEnabled(false);
setStatus("Validando link de recuperação...");

/**
 * Escuta mudanças de estado de autenticação do Supabase.
 * O evento "PASSWORD_RECOVERY" é disparado assim que o supabase-js
 * processa o token de recuperação presente na URL do link do e-mail.
 */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session) {
    recoveryReady = true;
    setFormEnabled(true);
    setStatus("Digite e confirme sua nova senha abaixo.");
  }
});

/**
 * Fallback: caso o evento PASSWORD_RECOVERY já tenha disparado antes do
 * listener acima ser registrado (ex.: recarregamento rápido), verifica
 * diretamente se já existe uma sessão ativa ao carregar a página.
 */
(async () => {
  // Pequeno atraso para dar tempo do supabase-js processar o token da URL
  // antes de checarmos a sessão (evita falso negativo em conexões lentas).
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (recoveryReady) return; // já confirmado pelo evento acima

  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    setStatus(
      "Link inválido ou expirado. Volte para o login e solicite um novo link de recuperação de senha.",
      "error"
    );
    return;
  }

  recoveryReady = true;
  setFormEnabled(true);
  setStatus("Digite e confirme sua nova senha abaixo.");
})();

/**
 * Valida e salva a nova senha do usuário via Supabase Auth.
 *
 * @returns {Promise<void>}
 */
async function updatePassword() {
  if (!recoveryReady) {
    setStatus("Link de recuperação inválido ou expirado.", "error");
    return;
  }

  const newPassword = newPasswordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;

  if (!newPassword || !confirmPassword) {
    setStatus("Preencha os dois campos de senha.", "error");
    return;
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    setStatus(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus("As senhas não coincidem.", "error");
    return;
  }

  setFormEnabled(false);
  setStatus("Atualizando senha...");

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    setFormEnabled(true);
    setStatus("Erro ao atualizar senha: " + error.message, "error");
    return;
  }

  setStatus("Senha atualizada com sucesso! Redirecionando para o login...", "success");

  setTimeout(() => {
    window.location.href = "/login.html";
  }, 2000);
}

btnUpdatePassword?.addEventListener("click", updatePassword);
