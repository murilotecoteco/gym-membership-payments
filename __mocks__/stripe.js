/**
 * __mocks__/stripe.js
 * ------------------------------------------------------------------
 * Mock manual do pacote "stripe" (SDK oficial do Stripe para Node.js).
 * Ativado nos testes com `jest.mock("stripe")` — o Jest automaticamente
 * usa este arquivo em vez do pacote real do node_modules.
 *
 * server.js faz `const stripe = Stripe(process.env.STRIPE_SECRET_KEY)`
 * uma única vez, no carregamento do módulo. Para os testes conseguirem
 * controlar o comportamento de cada método (ex.: fazer
 * stripe.webhooks.constructEvent lançar erro em um teste específico),
 * a factory abaixo sempre devolve a MESMA instância (singleton) — os
 * arquivos de teste importam essa instância assim:
 *
 *   jest.mock("stripe");
 *   const Stripe = require("stripe");
 *   const stripeMock = Stripe(); // sempre a mesma instância mockada
 *
 *   stripeMock.webhooks.constructEvent.mockImplementation(() => {
 *     throw new Error("assinatura inválida");
 *   });
 * ------------------------------------------------------------------
 */

const stripeMockInstance = {
  webhooks: {
    constructEvent: jest.fn()
  },
  checkout: {
    sessions: {
      create: jest.fn()
    }
  },
  subscriptions: {
    retrieve: jest.fn()
  },
  billingPortal: {
    sessions: {
      create: jest.fn()
    }
  }
};

function Stripe() {
  return stripeMockInstance;
}

module.exports = Stripe;
