/**
 * jest.config.js
 * ------------------------------------------------------------------
 * Configuração do Jest para os testes automatizados do projeto.
 *
 * - testEnvironment "node": os testes rodam em ambiente Node puro
 *   (sem DOM), já que este é um projeto de backend/API.
 * - setupFiles: carrega variáveis de ambiente FALSAS/dummy ANTES de
 *   qualquer arquivo de teste rodar, para que server.js não derrube o
 *   processo (process.exit) por falta de STRIPE_SECRET_KEY, etc. — ver
 *   tests/setupEnv.js.
 * - testMatch: só arquivos dentro de tests/**, terminados em .test.js,
 *   são tratados como suíte de teste.
 * ------------------------------------------------------------------
 */
module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  clearMocks: true
};
