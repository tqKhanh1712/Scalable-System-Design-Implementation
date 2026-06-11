# Stage 2 API

Minimal Express API for the assignment.

## Environment

Copy `.env.example` to `.env` and adjust the values for your machine.

## Run locally

```bash
cd app
npm install
npm start
```

## Endpoints

- `GET /health` checks both database pools.
- `POST /products` writes to the master database.
- `GET /products` reads from the slave database.