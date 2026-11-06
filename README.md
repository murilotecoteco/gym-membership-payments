# Academia com Pagamentos

Projeto prático full stack para estudar planos de academia e assinaturas recorrentes com Stripe, Express e Supabase.

[![Status](https://img.shields.io/badge/status-demo-blue)](https://github.com/murilotecoteco/gym-membership-payments)
[![CI](https://github.com/murilotecoteco/gym-membership-payments/actions/workflows/ci.yml/badge.svg)](https://github.com/murilotecoteco/gym-membership-payments/actions/workflows/ci.yml)

[Live Demo](https://academia-com-pagamentos.onrender.com) · [Código-fonte](https://github.com/murilotecoteco/gym-membership-payments)

## O que foi praticado

- Cadastro, autenticação e gerenciamento de conta
- Stripe Checkout e Billing Portal
- Webhooks com validação de assinatura e idempotência
- Sincronização de assinaturas no Supabase
- Validação de entrada com Zod
- Rate limiting, Helmet e logs estruturados
- Testes automatizados com Jest e Supertest

## Fluxo de pagamento

1. O usuário escolhe um plano.
2. O backend valida o `plan_id` em uma allowlist server-side.
3. O servidor cria uma Checkout Session no Stripe.
4. O Stripe envia o evento ao webhook.
5. O backend valida `Stripe-Signature` com `STRIPE_WEBHOOK_SECRET`.
6. O evento validado atualiza a assinatura no Supabase de forma idempotente.

O redirecionamento do navegador após o checkout não é considerado prova de pagamento; o webhook é a fonte de verdade.

## Como os pagamentos são protegidos

- Chaves Stripe, Price IDs e segredo do webhook ficam somente no ambiente do servidor.
- O cliente envia `plan_id`, nunca um `price_id` arbitrário.
- A identidade vem do JWT validado, não de um `user_id` enviado pelo cliente.
- Checkout e Billing Portal possuem rate limiting.
- Identificadores internos, como `stripe_customer_id`, não são enviados ao frontend.
- Testes usam mocks e não cobram cartões reais.

## Resultado e aprendizados

- **Resultado:** fluxo demonstrável de assinatura com Checkout, Billing Portal, webhook validado e sincronização no Supabase.
- **Aprendizado:** pagamentos assíncronos, idempotência, validação server-side e testes offline com mocks.

## Ambiente de testes

O projeto usa Stripe em **test mode**.

Para testar localmente:

```bash
git clone https://github.com/murilotecoteco/gym-membership-payments.git
cd gym-membership-payments
npm install
npm test
npm start
```

Os testes executam offline com Jest, Supertest e mocks de Stripe/Supabase. Para testar webhooks localmente, use um `STRIPE_WEBHOOK_SECRET` de test mode fornecido pelo Stripe CLI.

Nunca use chaves live em desenvolvimento ou nos testes.

### Cartões de teste

Use qualquer data futura e um CVC válido:

| Cenário | Número |
| --- | --- |
| Pagamento aprovado | `4242 4242 4242 4242` |
| Mastercard aprovada | `5555 5555 5555 4444` |
| American Express aprovada | `3782 822463 10005` |

Consulte a [documentação oficial de testes do Stripe](https://docs.stripe.com/testing?locale=pt-BR) para recusas e cenários específicos.

## Dados fictícios e limitações

- Usuários, planos, assinaturas e transações do demo são fictícios ou de teste.
- A aplicação não deve ser usada para armazenar registros financeiros ou pessoais reais.
- O deploy público é uma demonstração, não um serviço de pagamentos pronto para produção.
- Uma operação real exigiria monitoramento, backups, rotação de segredos, controles antifraude, alertas de webhook e processo de incidentes.
- O plano gratuito do Supabase pode pausar o banco por inatividade e possui limites de quota.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML5, CSS3 e JavaScript vanilla |
| Backend | Node.js e Express |
| Validação | Zod |
| Segurança | Helmet e express-rate-limit |
| Banco | Supabase/PostgreSQL |
| Pagamentos | Stripe Checkout, Webhooks e Billing Portal |
| Testes | Jest e Supertest |
| Deploy | Render |

## Variáveis de ambiente

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MENSAL=
STRIPE_PRICE_TRIMESTRAL=
STRIPE_PRICE_SEMESTRAL=
STRIPE_PRICE_ANUAL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
BASE_URL=http://localhost:3000
```

## Estrutura

```text
├── public/                 # Frontend
├── tests/                  # Unitários e integração
├── server.js               # API Express
├── supabaseClient.js       # Cliente Supabase
├── utils.js                # Regras compartilhadas
├── .env.example
└── .github/workflows/ci.yml
```

## Roadmap

- [x] Autenticação
- [x] Stripe Checkout
- [x] Webhooks
- [x] Billing Portal
- [x] Sincronização de assinaturas
- [x] Rate limiting
- [x] Testes automatizados
- [ ] Painel administrativo
- [ ] Histórico de pagamentos

## Licença

Projeto educacional e de portfólio. Consulte o arquivo `LICENSE`.
