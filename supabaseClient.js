/**
 * supabaseClient.js
 *
 * Instancia e exporta um cliente único do Supabase, configurado com a
 * Service Role Key (chave de administrador do projeto).
 *
 * IMPORTANTE: este cliente possui privilégios elevados e ignora as
 * políticas de Row Level Security (RLS) configuradas nas tabelas.
 * Por isso, ele deve ser usado APENAS no back-end (server.js), nunca
 * exposto ou importado em código que rode no navegador do usuário.
 *
 * Todo o restante da aplicação (rotas, webhooks, funções de negócio)
 * importa esta mesma instância, evitando a criação de múltiplas
 * conexões/clientes redundantes.
 */

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

// Credenciais carregadas exclusivamente de variáveis de ambiente —
// nunca hard-coded no código-fonte, por questões de segurança.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
