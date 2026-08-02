/**
 * tests/setupEnv.js
 * ------------------------------------------------------------------
 * Executado pelo Jest ANTES de qualquer arquivo de teste (ver
 * "setupFiles" em jest.config.js).
 *
 * server.js recusa subir (process.exit(1)) se faltarem variáveis de
 * ambiente essenciais (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET), e
 * supabaseClient.js chama createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
 * assim que é importado. Para os testes não dependerem de um arquivo
 * .env real (nem de credenciais verdadeiras) definimos aqui valores
 * "dummy" — nenhuma chamada de rede de verdade é feita nos testes,
 * pois Supabase e Stripe são mockados (ver tests/mocks/).
 *
 * `process.env.X = process.env.X || "..."` preserva um valor real, caso
 * exista um .env carregado no ambiente de CI/local — mas nunca falha
 * por ausência dele.
 * ------------------------------------------------------------------
 */

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key_for_tests";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_dummy_secret_for_tests";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy-project.supabase.co";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "dummy-service-role-key";
process.env.BASE_URL = process.env.BASE_URL || "http://localhost:3000";
