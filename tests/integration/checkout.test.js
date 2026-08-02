/**
 * tests/integration/checkout.test.js
 * ------------------------------------------------------------------
 * Testes de integração da rota POST /create-checkout-session.
 *
 * Usa Supertest para simular requisições HTTP reais contra o `app`
 * exportado por server.js — sem precisar subir um servidor escutando
 * uma porta de verdade.
 *
 * Supabase e Stripe são mockados (ver tests/mocks/ e __mocks__/stripe.js),
 * então nenhuma chamada de rede real é feita.
 * ------------------------------------------------------------------
 */

jest.mock("stripe");
jest.mock("../../supabaseClient", () => require("../mocks/supabaseClientMock"));

const request = require("supertest");
const app = require("../../server");
const supabaseMock = require("../../supabaseClient");

describe("POST /create-checkout-session", () => {
  test("retorna 401 quando nenhum token é enviado", async () => {
    const res = await request(app)
      .post("/create-checkout-session")
      .send({ plan_id: "mensal" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/não autenticado/i);
  });

  test("retorna 401 quando o token é inválido/expirado", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid JWT" }
    });

    const res = await request(app)
      .post("/create-checkout-session")
      .set("Authorization", "Bearer token-invalido")
      .send({ plan_id: "mensal" });

    expect(res.status).toBe(401);
  });

  test("retorna 400 quando plan_id não existe na allowlist de planos", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "aluno@exemplo.com" } },
      error: null
    });

    const res = await request(app)
      .post("/create-checkout-session")
      .set("Authorization", "Bearer token-valido")
      .send({ plan_id: "plano-que-nao-existe" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/plano inválido/i);
  });

  test("retorna 400 quando plan_id não é enviado", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "aluno@exemplo.com" } },
      error: null
    });

    const res = await request(app)
      .post("/create-checkout-session")
      .set("Authorization", "Bearer token-valido")
      .send({});

    expect(res.status).toBe(400);
  });
});
