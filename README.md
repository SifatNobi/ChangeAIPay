# ChangeAIPay

ChangeAIPay is a split-deploy fintech prototype:

- `frontend/`: React + Vite SPA intended for Netlify
- `backend/`: Express + MongoDB API intended for Render
- Nano wallet creation, balance, and send flows are implemented through a real Nano RPC endpoint

## Architecture

- Frontend calls `https://changeaipay.onrender.com` by default through `VITE_API_BASE_URL`
- Backend persists users and transactions in MongoDB
- Backend signs JWTs for login/register and protects private endpoints with bearer auth
- Nano transfers are recorded with `pending`, `submitted`, `confirmed`, or `failed` status

## API contract

Public:

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`

Authenticated:

- `GET /user/profile`
- `POST /transaction/send`
- `GET /transaction/history`

## Required environment variables

Copy `backend/.env.example` to `backend/.env` and fill in real values:

```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/changeaipay
JWT_SECRET=replace-with-a-long-random-secret
RPC_URL=https://your-nano-rpc.example.com
RPC_AUTH_TOKEN=
RPC_BASIC_USER=
RPC_BASIC_PASS=
RPC_TIMEOUT_MS=15000
RPC_CONFIRM_ATTEMPTS=8
RPC_CONFIRM_DELAY_MS=1500
PORT=3000
CORS_ORIGINS=https://your-netlify-site.netlify.app
```

Frontend:

```bash
VITE_API_BASE_URL=https://changeaipay.onrender.com
```

## Local development

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Nano RPC expectations

The backend now uses real RPC calls and will return operator-facing errors if `RPC_URL` is not configured.

Expected RPC actions:

- `wallet_create`
- `account_create`
- `account_balance`
- `send`
- `block_info`

## Nano RPC Configuration (Required for Render)

To enable Nano transactions, set the following environment variable in Render:

```bash
RPC_URL=https://nano.to/rpc
```

This is required for:
- transaction sending
- account validation
- wallet operations

Do NOT hardcode `RPC_URL` inside the codebase. It must be configured in Render environment variables.

## Deployment

### Netlify

- Config is committed in `netlify.toml`
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback is also committed in `frontend/public/_redirects`

### Render

- Config scaffold is committed in `render.yaml`
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Set the backend env vars in Render before deploying

## Notes

- The app no longer depends on the old static Stitch export for the active frontend flow
- The supplied logo URL is used consistently in the rebuilt SPA and remaining static HTML references
- If the supplied Imgur URL does not behave like a direct image asset in production, replace it with the actual direct CDN image URL while keeping the same single-source constant

