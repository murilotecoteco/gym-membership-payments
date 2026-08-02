/**
 * tests/integration/minhaAssinatura.test.js
 * ------------------------------------------------------------------
 * Testes de integração da rota GET /minha-assinatura, incluindo o
 * middleware requireAuth (reaproveitado também por /create-portal-session).
 * ------------------------------------------------------------------
 */

jest.mock("stripe");
jest.mock("../../supabaseClient", () => require("../mocks/supabaseClientMock"));

const request = require("supertest");
const app = require("../../server");
const supabaseMock = require("../../supabaseClient");

describe("GET /minha-assinatura", () => {
  test("retorna 401 quando nenhum token é enviado", async () => {
    const res = await request(app).get("/minha-assinatura");

    expect(res.status).toBe(401);
  });

  test("retorna 401 quando o token é inválido", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid JWT" }
    });

    const res = await request(app)
      .get("/minha-assinatura")
      .set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  test("retorna 404 quando o usuário autenticado não possui assinatura", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-sem-assinatura", email: "novo@exemplo.com" } },
      error: null
    });

    const builderSemAssinatura = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
    };
    supabaseMock.from.mockReturnValueOnce(builderSemAssinatura);

    const res = await request(app)
      .get("/minha-assinatura")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(404);
  });

  test("retorna 200 com os dados da assinatura, sem expor stripe_customer_id", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-com-assinatura", email: "aluno@exemplo.com" } },
      error: null
    });

    const builderComAssinatura = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() =>
        Promise.resolve({
          data: {
            plan: "mensal",
            status: "active",
            current_period_end: "2026-09-01T00:00:00.000Z",
            canceled_at: null,
            cancel_at_period_end: false,
            stripe_customer_id: "cus_deveria_ser_removido"
          },
          error: null
        })
      )
    };
    supabaseMock.from.mockReturnValueOnce(builderComAssinatura);

    const res = await request(app)
      .get("/minha-assinatura")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("mensal");
    expect(res.body.status).toBe("active");
    // Garantia de segurança: o identificador interno do Stripe nunca
    // deve chegar ao front-end.
    expect(res.body).not.toHaveProperty("stripe_customer_id");
  });

  test("retorna 500 quando o Supabase falha ao consultar a assinatura", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "aluno@exemplo.com" } },
      error: null
    });

    const builderComErro = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() =>
        Promise.resolve({ data: null, error: { message: "Erro simulado de conexão" } })
      )
    };
    supabaseMock.from.mockReturnValueOnce(builderComErro);

    const res = await request(app)
      .get("/minha-assinatura")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(500);
  });
});
