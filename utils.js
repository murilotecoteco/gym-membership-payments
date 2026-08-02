/**
 * utils.js
 * ------------------------------------------------------------------
 * Funções puras e reutilizáveis, extraídas de server.js para permitir
 * testes unitários simples (sem precisar subir o servidor Express nem
 * mockar Supabase/Stripe).
 * ------------------------------------------------------------------
 */

/**
 * Valida o formato básico de um e-mail (presença de usuário, @ e domínio
 * com pelo menos um ponto). Validação sintática apenas — não confirma
 * que o endereço realmente existe ou recebe e-mails.
 *
 * @param {*} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Soma 1 mês a uma data. Usado apenas como FALLBACK do período de
 * cobrança, para o caso (raro) de falharmos ao buscar o período real
 * direto no Stripe — ver getBillingPeriod() em server.js.
 *
 * @param {Date} date
 * @returns {Date} nova data, um mês após a informada
 */
function addOneMonth(date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

module.exports = { isValidEmail, addOneMonth };
