# Deploying Caffio on Cloudflare

Cloudflare cannot run a Java server directly. It runs Docker images as **Containers**, which sit
behind a small **Worker** that receives every request and forwards it. This folder is that Worker.
The image is the same root `Dockerfile` Railway builds today (React frontend + Spring Boot in one).

```
browser / desktop app ──► Worker "caffio" (this folder) ──► Container: Spring Boot (root Dockerfile)
                                                                   │
                                                                   ▼
                                                   PostgreSQL (Neon / Supabase - not Cloudflare)
```

## What changes compared with Railway

| | Railway | Cloudflare |
|---|---|---|
| App server | Always-on container | Container that sleeps when idle. A cron in `wrangler.jsonc` pings it every 5 minutes so it never sleeps: a cashier must not wait ~30 s for Java to start, and the app's nightly jobs need it awake. |
| Database | Railway Postgres | **Cloudflare has no Postgres.** Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) (or keep Railway's Postgres on its own). D1 is not an option: the app speaks JDBC/Postgres. |
| Disk | Persistent volume possible | Wiped every time the container restarts. Fine for the backend (all data is in Postgres). **Not fine for the WhatsApp bridge** - see below. |
| Instances | 1 | Pinned to exactly 1 (`max_instances: 1`). Login lockouts and rate limits live in memory, and the scheduled jobs must not run twice. |
| Cost (approx.) | - | Workers Paid $5/month + about $7/month for an always-on `basic` container (1 GiB) + your Postgres host. |

## One-time setup

You need Docker running on the machine you deploy from (wrangler builds the image locally).

```bash
cd cloudflare
npm install
npx wrangler login
```

Your Cloudflare account must be on the **Workers Paid** plan - Containers are not on the free plan.

### 1. Create the database and copy the data

Create a Postgres database on Neon (pick the region closest to your cafés, e.g. Frankfurt), then
copy Railway's data into it. Take Railway's connection string from Railway → Postgres → Connect.

```bash
pg_dump --no-owner --no-acl -Fc "RAILWAY_DATABASE_URL" -f caffio.dump
pg_restore --no-owner --no-acl -d "NEON_DATABASE_URL" caffio.dump
```

Use the dump from a quiet moment (or a short maintenance window) so no sale happens on Railway
after the copy. Flyway will then add any newer migrations (V14 and later) on first start.

### 2. Secrets

Use **the same `JWT_SECRET` as on Railway** - a different one logs every user out.

```bash
npx wrangler secret put DATABASE_URL                    # postgresql://user:pass@host/db?sslmode=require
npx wrangler secret put JWT_SECRET
npx wrangler secret put APP_PLATFORM_PROVISIONING_KEY
```

If WhatsApp alerts are on, also set `WHATSAPP_GATEWAY_ENABLED`, `WHATSAPP_PROVIDER`,
`WHATSAPP_API_URL`, `WHATSAPP_INSTANCE_ID`, `WHATSAPP_API_TOKEN` the same way (copy them from
Railway's Variables tab).

Edit `CORS_ALLOWED_ORIGINS` in `wrangler.jsonc` to the address the web app is served from.

### 3. Deploy

```bash
npx wrangler deploy
```

The first deploy builds and uploads the image, which takes several minutes. It prints a
`https://caffio.<your-subdomain>.workers.dev` address. Check it:

```bash
curl https://caffio.<your-subdomain>.workers.dev/api/health
```

The first request after a deploy can take 30-60 s while Java starts. After that the cron keeps it warm.

### 4. Your own domain (recommended)

Cloudflare dashboard → Workers → caffio → Settings → Domains & Routes → add e.g. `api.yourdomain.com`.

## Switching over from Railway

1. Deploy on Cloudflare and test it on the workers.dev address while Railway keeps serving cafés.
2. **Desktop app:** installed copies call the Railway address hard-coded in `main.js`
   (`PROD_BACKEND_URL`). Change it to your own domain and ship a desktop update. Keep Railway
   running until those installs have updated, or they lose their server.
3. Do the final `pg_dump` / `pg_restore` in a quiet window, then point users to the new address.
4. Watch it for a few days (`npm run logs`), then turn Railway off.

## WhatsApp bridge

`whatsapp-bridge/` stores its linked-device login on disk. Cloudflare container disks are wiped on
restart, so it would ask for a new QR scan after every deploy. Either keep that one small service on
Railway, or switch `WHATSAPP_PROVIDER` to the hosted gateway (`GENERIC_HTTP`, e.g. UltraMsg).

## Day to day

```bash
npm run deploy     # build + deploy the current code
npm run logs       # live logs from the Worker and container
npm run check      # type-check the Worker after editing it
```
