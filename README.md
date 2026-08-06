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

The project demonstrates backend development, payment processing, authentication, database integration and deployment in a production environment.

---

# Why this project

This project was built to practice and demonstrate:

* REST API development with Express
* User authentication
* Stripe Checkout integration
* Stripe Webhooks
* Secure payment processing
* Cloud database management with Supabase
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
* ✅ Stripe Webhooks
* ✅ Automatic subscription activation
* ✅ Automatic subscription cancellation
* ✅ Supabase database integration
* ✅ Input validation
* ✅ Centralized error handling
* ✅ Production deployment
* ✅ Password recovery
* ✅ Automated tests (Jest + Supertest)
* ⏳ Admin dashboard
* ⏳ Payment history

---

# Technology Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Frontend        | HTML5, CSS3, vanilla JavaScript  |
| Backend         | Node.js, Express.js              |
| Database        | Supabase (PostgreSQL)            |
| Payments        | Stripe Checkout, Stripe Webhooks |
| Testing         | Jest, Supertest                  |
| Deployment      | Render                           |
| Version Control | Git & GitHub                     |

> **Note on frontend:** The frontend is intentionally implemented in vanilla JavaScript — no framework was used — to keep the focus on backend development, payment integration, and automated testing, which are the main goals of this project.

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
* **Input validation** — checkout requests with an invalid/missing plan are rejected
* **Stripe webhook security** — requests without a valid signature are rejected, and handler failures correctly return `500` so Stripe retries delivery
* **Data exposure** — confirms internal identifiers (e.g. `stripe_customer_id`) are never returned to the frontend

Tests run fully offline: Stripe and Supabase are replaced with manual mocks (`__mocks__/stripe.js` and `tests/mocks/supabaseClientMock.js`), so no real API keys or network access are required to run the suite.

---

# Test Cards (Stripe)

Stripe Checkout runs in **test mode** on this project, so no real payment is ever processed. Use any of the cards below to simulate a successful checkout flow — enter any future expiration date and any CVC of the required length (or leave it blank if the field is skipped by autofill).

| Brand                              | Number               | CVC             | Expiration Date  |
| ----------------------------------- | --------------------- | --------------- | ----------------- |
| Visa                                 | 4242424242424242      | Any 3 digits     | Any future date    |
| Visa (debit)                        | 4000056655665556      | Any 3 digits     | Any future date    |
| Mastercard                          | 5555555555554444      | Any 3 digits     | Any future date    |
| Mastercard (2-series)               | 2223003122003222      | Any 3 digits     | Any future date    |
| Mastercard (debit)                  | 5200828282828210      | Any 3 digits     | Any future date    |
| Mastercard (prepaid)                | 5105105105105100      | Any 3 digits     | Any future date    |
| American Express                    | 378282246310005       | Any 4 digits     | Any future date    |
| American Express                    | 371449635398431       | Any 4 digits     | Any future date    |
| Discover                            | 6011111111111117      | Any 3 digits     | Any future date    |
| Discover                            | 6011000990139424      | Any 3 digits     | Any future date    |
| Discover (debit)                    | 6011981111111113      | Any 3 digits     | Any future date    |
| Diners Club                         | 3056930009020004      | Any 3 digits     | Any future date    |
| Diners Club (14-digit card)         | 36227206271667        | Any 3 digits     | Any future date    |
| BCcard and DinaCard                 | 6555900000604105      | Any 3 digits     | Any future date    |
| JCB                                  | 3566002020360505      | Any 3 digits     | Any future date    |
| UnionPay                            | 6200000000000005      | Any 3 digits     | Any future date    |
| UnionPay (debit)                    | 6200000000000047      | Any 3 digits     | Any future date    |
| UnionPay (19-digit card)            | 6205500000000000004   | Any 3 digits     | Any future date    |

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

* Validation of environment variables
* Stripe webhook signature verification
* Idempotent webhook processing
* Server-side payment validation
* Centralized error handling
* Sensitive credentials stored as environment variables
* `.env` excluded from version control

---

# Known Limitations

* This project uses Supabase's free tier, which automatically pauses the database after a period of inactivity. If the live demo appears unresponsive, the database may need a few seconds to resume, or manual reactivation may be required via the Supabase dashboard.
* In a production environment, this would be mitigated by upgrading to a paid tier or implementing a scheduled ping to keep the instance active.

---

# Roadmap

* [x] User authentication
* [x] Stripe Checkout
* [x] Stripe Webhooks
* [x] Subscription synchronization
* [x] Production deployment
* [x] Password recovery
* [x] Automated tests
* [ ] Admin dashboard
* [ ] Payment history

---

# License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
