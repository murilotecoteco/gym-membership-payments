# Academia com Pagamentos

<p align="center">
  Web application for managing gym memberships with recurring payments using Stripe and Supabase.
</p>

<p align="center">

![Status](https://img.shields.io/badge/status-in%20production-blue)
[![CI](https://github.com/murilotecoteco/gym-membership-payments/actions/workflows/ci.yml/badge.svg)](https://github.com/murilotecoteco/gym-membership-payments/actions/workflows/ci.yml)

</p>

<p align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

</p>

<p align="center">
  <b>Demo video:</b>
</p>

https://github.com/user-attachments/assets/4ce10eb5-1856-4c1f-9277-5679358940be

<p align="center">
  <b>Click the buttons below to open the project:</b>
</p>

<p align="center">

<a href="https://academia-com-pagamentos.onrender.com">
<img src="https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge">
</a>

<a href="https://github.com/murilotecoteco/gym-membership-payments">
  <img src="https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge">
</a>
</p>

---

# Table of Contents

* About
* Why this project
* Screenshots
* Features
* Technology Stack
* Architecture
* Project Structure
* Getting Started
* Environment Variables
* Testing
* Test Cards (Stripe)
* Deployment
* Security
* Known Limitations
* Roadmap
* License

---

# About

Academia com Pagamentos is a full-stack web application that simulates a gym membership platform with recurring subscriptions.

Users can create an account, subscribe to a monthly plan through Stripe Checkout, and have their membership status automatically synchronized using Stripe Webhooks and Supabase.

The project demonstrates backend development, payment processing, authentication, security middleware, structured logging, input validation, and deployment in a production environment.

---

# Why this project

This project was built to practice and demonstrate:

* REST API development with Express
* User authentication with JWT validation
* Stripe Checkout integration
* Stripe Webhooks with signature verification and idempotent processing
* Secure payment processing
* Cloud database management with Supabase
* Input validation with Zod
* Structured logging with Pino
* Security middleware with Helmet and rate limiting
* Environment variable management
* Production deployment
* Automated testing with Jest and Supertest

---

# Screenshots

## Home

<p align="center">
  <img src="https://github.com/user-attachments/assets/04f53cd0-359e-4431-a6d5-3d3d1c62b14f" alt="Academia com Pagamentos">
</p>
<p align="center">
<img width="1117" height="907" alt="image" src="https://github.com/user-attachments/assets/8c356aaa-414e-43ad-93e1-413af0abd0c4" />
</p>

---

# Features

* ✅ User registration and authentication
* ✅ User account management
* ✅ Stripe Checkout integration
* ✅ Stripe Webhooks (activation, renewal, cancellation, payment failure)
* ✅ Automatic subscription activation and cancellation
* ✅ Stripe Billing Portal (card management, invoices, self-service cancellation)
* ✅ Supabase database integration
* ✅ Input validation with Zod
* ✅ Centralized error handling
* ✅ Rate limiting on sensitive routes
* ✅ Structured logging with Pino
* ✅ Security headers with Helmet
* ✅ Production deployment
* ✅ Password recovery
* ✅ Automated tests (Jest + Supertest)
* ⏳ Admin dashboard
* ⏳ Payment history

---

# Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend | Node.js, Express.js |
| Validation | Zod |
| Logging | Pino |
| Security | Helmet, express-rate-limit |
| Database | Supabase (PostgreSQL) |
| Payments | Stripe Checkout, Stripe Webhooks, Stripe Billing Portal |
| Testing | Jest, Supertest |
| Deployment | Render |
| Version Control | Git & GitHub |

> **Note on frontend:** The frontend is intentionally implemented in vanilla JavaScript — no framework was used — to keep the focus on backend development, payment integration, security, and automated testing, which are the main goals of this project.

---

# Architecture

```text
Client Browser
      │
      ▼
Frontend
(HTML, CSS, JavaScript)
      │
      ▼
Express API
      │
 ┌────┴───────────────┐
 │                    │
 ▼                    ▼
Stripe Checkout   Supabase Database
      │                    ▲
      ▼                    │
Payment Processing          │
      │                    │
      ▼                    │
Stripe Webhooks─────────────┘
```

The application follows a client-server architecture. The frontend communicates with an Express API responsible for authentication, payment processing and communication with Stripe. Subscription data is stored and synchronized in Supabase after successful webhook validation.

---

# Payment Flow and Test Environment

## How the webhook works

1. The user selects a plan and the backend creates a Stripe Checkout Session using a server-side price allowlist.
2. Stripe completes the checkout and sends an event to the Express webhook endpoint.
3. The backend validates the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET`.
4. Only after signature validation does the application process the event and synchronize the membership in Supabase.
5. Webhook processing is idempotent, so repeated deliveries do not create duplicate subscription state.
6. Events such as subscription updates, cancellations and payment failures keep the local membership status consistent with Stripe.

The application treats Stripe webhooks as the source of truth for subscription state. A browser redirect after checkout is not considered proof of payment.

## How payments are protected

- Stripe secret keys, price IDs and the webhook secret exist only in server environment variables.
- The frontend sends a logical `plan_id`; the backend maps it to an approved Stripe Price ID.
- Webhook signatures are verified before the request body is trusted.
- Authenticated routes derive the user identity from the verified Supabase JWT, never from a client-provided `user_id`.
- Checkout and billing portal routes use rate limiting.
- Sensitive fields such as `stripe_customer_id` are not returned to the browser.
- Automated tests use mocks and do not call real Stripe or Supabase services.

## Test environment

The repository is configured for Stripe **test mode**. Test cards simulate payments without charging a real card; see [Stripe's testing documentation](https://docs.stripe.com/testing?locale=pt-BR). Local tests run offline with Jest, Supertest, a mocked Stripe client and a mocked Supabase client.

For local webhook testing, configure a test-mode `STRIPE_WEBHOOK_SECRET` supplied by Stripe CLI or the selected test integration. Never use a live-mode secret in development or automated tests.

## Data and production limitations

- The users, memberships, plans and transactions used in the demo are fictitious or test data; do not use the project as a source of real financial or personal records.
- The live demo is not a production payment service. A real deployment requires operational monitoring, secret rotation, backups, fraud controls, webhook alerting and a documented incident process.
- The Supabase free tier may pause the database after inactivity, causing the first request after a pause to be slow or temporarily unavailable.
- The free tier also has quotas and limits that are not suitable for guaranteed production availability or high transaction volume.

---

# Project Structure

```text
Academia-com-Pagamentos/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── public/
│   ├── auth.js
│   ├── conta.js
│   ├── pagamento.js
│   ├── script.js
│   ├── supabase.js
│   ├── index.html
│   ├── login.html
│   ├── redefinir-senha.html
│   ├── redefinir-senha.js
│   ├── minha-conta.html
│   ├── sucesso.html
│   ├── cancelado.html
│   └── styles/
│
├── tests/
│   ├── setupEnv.js
│   ├── mocks/
│   │   └── supabaseClientMock.js
│   ├── unit/
│   │   └── utils.test.js
│   └── integration/
│       ├── checkout.test.js
│       ├── webhook.test.js
│       └── minhaAssinatura.test.js
│
├── __mocks__/
│   └── stripe.js
│
├── server.js
├── supabaseClient.js
├── utils.js
├── jest.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

# Getting Started

## Prerequisites

* Node.js 18+
* Supabase project
* Stripe account

## Installation

```bash
git clone https://github.com/murilotecoteco/gym-membership-payments.git
cd gym-membership-payments
npm install
npm start
```

The application will be available at:

```text
http://localhost:3000
```

---

# Environment Variables

Create a `.env` file in the project root.

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

---

# Testing

The project includes an automated test suite built with **Jest** and **Supertest**, covering both pure utility functions and the Express API routes.

```bash
npm test
```

What is covered:

* **Unit tests** — pure functions such as e-mail validation and date arithmetic (`utils.js`)
* **Authentication** — protected routes correctly reject requests with a missing or invalid Supabase JWT
* **Input validation** — checkout requests with an invalid or missing `plan_id` are rejected with 400
* **Stripe webhook security** — requests without a valid signature are rejected with 400; handler failures return 500 so Stripe retries delivery
* **Data exposure** — confirms internal identifiers (e.g. `stripe_customer_id`) are never returned to the frontend

Tests run fully offline: Stripe and Supabase are replaced with manual mocks (`__mocks__/stripe.js` and `tests/mocks/supabaseClientMock.js`), so no real API keys or network access are required to run the suite.

---

# Test Cards (Stripe)

Stripe Checkout runs in **test mode** on this project, so no real payment is ever processed. Use any of the cards below to simulate a successful checkout flow — enter any future expiration date and any CVC of the required length.

| Brand | Number | CVC | Expiration Date |
| --- | --- | --- | --- |
| Visa | 4242424242424242 | Any 3 digits | Any future date |
| Mastercard | 5555555555554444 | Any 3 digits | Any future date |
| American Express | 378282246310005 | Any 4 digits | Any future date |

> Full reference, including cards for testing declines and specific error codes: [Stripe Testing Docs](https://docs.stripe.com/testing?locale=pt-BR)

---

# Deployment

The application is deployed on Render.

Every deployment uses the configured environment variables for Stripe and Supabase.

Production URL:

```text
https://academia-com-pagamentos.onrender.com
```

---

# Security

The project includes several security practices:

* Validation of environment variables at startup (fails fast if any are missing)
* JWT validation on all authenticated routes — `user_id` is always read from the verified token, never from the request body
* `plan_id` validated against a server-side allowlist — the Stripe `price_id` is never exposed to or accepted from the client
* Stripe webhook signature verification via `stripe.webhooks.constructEvent`
* Idempotent webhook processing with `upsert` and `ignoreDuplicates`
* Fetch-from-Stripe strategy on `subscription.updated` to avoid out-of-order event processing
* Rate limiting on checkout and portal routes (10 req/min per IP)
* Security headers via Helmet with a custom Content Security Policy
* Structured logging with Pino (JSON in production, formatted in development)
* Sensitive credentials stored as environment variables, excluded from version control

---

# Known Limitations

* This project uses Supabase's free tier, which automatically pauses the database after a period of inactivity. If the live demo appears unresponsive, the database may need a few seconds to resume, or manual reactivation may be required via the Supabase dashboard.
* In a production environment, this would be mitigated by upgrading to a paid tier or implementing a scheduled ping to keep the instance active.

---

# Roadmap

* [x] User authentication
* [x] Stripe Checkout
* [x] Stripe Webhooks
* [x] Stripe Billing Portal
* [x] Subscription synchronization
* [x] Rate limiting
* [x] Structured logging
* [x] Security headers
* [x] Input validation with Zod
* [x] Production deployment
* [x] Password recovery
* [x] Automated tests
* [ ] Admin dashboard
* [ ] Payment history

---

# License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
