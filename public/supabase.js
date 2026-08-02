/**
 * public/supabase.js
 *
 * Instancia o cliente do Supabase para uso no NAVEGADOR (front-end).
 *
 * Diferente de supabaseClient.js (back-end), este cliente usa a chave
 * pública "anon" — projetada para ser exposta no código do cliente e
 * respeitar as políticas de Row Level Security (RLS) configuradas no
 * banco. Ela não concede acesso irrestrito aos dados: cada operação é
 * validada pelo Supabase de acordo com o usuário autenticado (ou a
 * ausência de autenticação).
 *
 * Importado por auth.js, conta.js, pagamento.js e sucesso.js para
 * login, cadastro, obtenção do token JWT (usado nas chamadas ao
 * back-end) e consultas diretas ao banco permitidas por RLS.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

export const supabase = createClient(
  "https://dzrqqakdvvdskbihbsin.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnFxYWtkdnZkc2tiaWhic2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTM2NjUsImV4cCI6MjA5NzQ4OTY2NX0.y5RbiDWI2jfhQNsFYLBdzUWDYl3zZ6p5skg3b02_Tj0"
)