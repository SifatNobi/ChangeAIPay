# ChangeAIPay

Production-ready starter for **zero-fee, near-instant Nano payments** with:
- **Express** backend
- **MongoDB (Mongoose)** persistence
- **JWT auth** (register/login)
- **Real Nano RPC** integration (wallet creation, balances, sends)
- **Vanilla frontend** (responsive landing + dashboard)

## Folder structure

```
ChangeAIPay/
  frontend/
    index.html
    script.js
    styles.css

  backend/
    server.js
    package.json
    .env
    routes/
    controllers/
    models/
    middleware/
    services/

  .gitignore
  README.md
```

## Environment variables

Create / edit `backend/.env` (placeholders are already present):

```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
RPC_URL=your_nano_rpc
PORT=3000
```

## Running locally

### 1) Backend

From `backend/`:

```bash
npm install
npm start
```

The backend serves the frontend automatically. Open:
- `http://localhost:3000`

### 2) Nano node requirement

This app uses **real Nano RPC calls** (no mock logic). You must point `RPC_URL` at a running Nano node with RPC enabled.

Used RPC actions:
- `wallet_create`
- `account_create`
- `account_balance`
- `send`

## API

### Auth
- `POST /auth/register` { name, email, password }
- `POST /auth/login` { email, password }

### Wallet & payments (JWT required)
- `GET /me`
- `GET /dashboard`
- `POST /create-wallet`
- `GET /balance`
- `POST /send-payment` { to: "<email or walletAddress>", amount: "<NANO>" }

### Transactions (JWT required)
- `GET /transactions`

## Security notes

- Passwords are hashed with **bcrypt**
- JWT is required for private endpoints
- Sensitive data (password, walletId) is never returned to the frontend
- Do not commit secrets (`backend/.env` is gitignored)

