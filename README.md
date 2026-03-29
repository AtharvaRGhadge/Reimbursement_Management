# Lumen Ledger — Reimbursement Management (MERN)

A full-stack reimbursement app with company provisioning on signup (country → currency via [REST Countries](https://restcountries.com)), FX normalization via [ExchangeRate API](https://www.exchangerate-api.com/), multi-step and conditional approval rules, manager chains, admin overrides, and client-side receipt OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)).

## Prerequisites

- Node.js 18+
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/reimbursement`)

## Setup

1. **Server**

   ```bash
   cd server
   copy .env.example .env
   npm install
   npm run dev
   ```

   API listens on port `5000` by default.

2. **Client**

   ```bash
   cd client
   npm install
   npm run dev
   ```

   Open `http://127.0.0.1:5173`. The Vite dev server proxies `/api` to the backend.

3. **First run**

   Use **Sign up** to create a company (admin user + default “manager first” workflow). Add managers and employees under **People & roles**, assign a manager to each employee, then submit expenses and approve from **Approvals**.

## Project layout

- `server/` — Express, JWT auth, Mongoose models, approval engine, currency helpers.
- `client/` — Vite + React + Tailwind; role-based routes; OCR on the new-expense screen.

## Production build

```bash
cd client && npm run build
```

Serve `client/dist` behind a static host and point API calls to your deployed server (configure `VITE_*` or reverse-proxy `/api`).
