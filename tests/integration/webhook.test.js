/**
 * tests/integration/webhook.test.js
 * ------------------------------------------------------------------
 * Testes de integração da rota POST /webhook (eventos do Stripe).
 *
 * Foco nos casos de SEGURANÇA da rota — a parte mais crítica, já que é
 * um endpoint público que precisa rejeitar qualquer requisição que não
 * seja genuinamente assinada pelo Stripe:
 *   - sem header stripe-signature → 400
 *   - com assinatura inválida (simulado via mock) → 400
 *   - com assinatura válida e evento reconhecido → 200
 *
 * Não testamos aqui a lógica interna de cada handler (activateSubscription,
 * handleSubscriptionDeleted, etc.) em detalhe — isso exigiria mockar
 * toda a cadeia de consultas do Supabase por handler. Esses testes cobrem
 * o contrato da rota em si (o que o Stripe espera receber de volta).
 * ------------------------------------------------------------------
 */

jest.mock("stripe");
jest.mock("../../supabaseClient", () => require("../mocks/supabaseClientMock"));

const request = require("supertest");
const app = require("../../server");
const Stripe = require("stripe");
const stripeMock = Stripe(); // mesma instância usada dentro de server.js

describe("POST /webhook", () => {
  test("retorna 400 quando o header stripe-signature está ausente", async () => {
    const res = await request(app)
      .post("/webhook")
      .send(Buffer.from(JSON.stringify({ type: "checkout.session.completed" })));

    expect(res.status).toBe(400);
  });

  test("retorna 400 quando a assinatura é inválida", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Assinatura do webhook inválida");
    });

    const res = await request(app)
      .post("/webhook")
      .set("stripe-signature", "assinatura-forjada")
      .send(Buffer.from(JSON.stringify({ type: "checkout.session.completed" })));

    expect(res.status).toBe(400);
    expect(res.text).toMatch(/webhook error/i);
  });

  test("retorna 200 para um tipo de evento não tratado (ignorado deliberadamente)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_teste_123",
      type: "customer.created", // tipo que a aplicação não trata
      created: Math.floor(Date.now() / 1000),
      data: { object: {} }
    });

    const res = await request(app)
      .post("/webhook")
      .set("stripe-signature", "assinatura-valida-simulada")
      .send(Buffer.from(JSON.stringify({ type: "customer.created" })));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  test("retorna 500 quando o handler do evento lança erro (sinaliza ao Stripe para reentregar)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_teste_456",
      type: "customer.subscription.deleted",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          metadata: {} // sem user_id
        }
      }
    });

    // Simula falha do Supabase ao tentar cancelar a assinatura.
    const supabaseMock = require("../../supabaseClient");
    const failingBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn(() =>
        Promise.resolve({ data: null, error: { message: "Falha simulada no Supabase" } })
      )
    };
    supabaseMock.from.mockReturnValueOnce(failingBuilder);

    const res = await request(app)
      .post("/webhook")
      .set("stripe-signature", "assinatura-valida-simulada")
      .send(Buffer.from(JSON.stringify({ type: "customer.subscription.deleted" })));

    expect(res.status).toBe(500);
  });
});
