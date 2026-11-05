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

### 1. Create the Neon database and copy the data

1. Sign up at [neon.com](https://neon.com) and create a project. Pick the region closest to your
   cafés - **AWS Europe (Frankfurt)** for Egypt.
2. In the project, click **Connect** and copy the connection string with **"Connection pooling" switched OFF**
   (the host must *not* contain `-pooler`). Caffio is one long-running server with its own
   connection pool; Neon's pooler is for serverless functions and breaks Flyway's migration lock.
3. If the string ends in `&channel_binding=require`, delete that part. Keep `?sslmode=require`.

   ```
   postgresql://neondb_owner:PASSWORD@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Copy Railway's data across. Take Railway's string from Railway → Postgres → Connect
   (the *public* one). You need the PostgreSQL client tools (`pg_dump`, `pg_restore`) on your PC.

   ```bash
   pg_dump --no-owner --no-acl -Fc "RAILWAY_DATABASE_URL" -f caffio.dump
   pg_restore --no-owner --no-acl -d "NEON_DATABASE_URL" caffio.dump
   ```

   Do it at a quiet moment so no sale lands on Railway after the copy. The app adds any newer
   migrations (V14 and later) itself on first start.

#### Is Neon free enough?

The Free plan gives **100 compute-hours a month and 0.5 GB of storage**. The database runs at
0.25 compute units, so that is about **400 hours with the database awake** - and it pauses itself
after 5 idle minutes. This setup is built to let it pause: the keep-alive calls `/api/ping`, which
never touches the database, and the app lets go of idle connections after a minute.

Roughly: one café open about 12 hours a day uses ~90-100 of the 100 hours. **That is tight.** If
the free hours run out, Neon stops the database until the next month - for a till, that is an
outage. So:

- Free is fine for setting up, testing and the first café.
- Watch **Neon → Billing → Usage** for the first weeks.
- Before more cafés depend on it, switch the Neon project to the **Launch** plan (pay for what you
  use, about $0.11 per compute-hour - a single busy café is roughly $10-15/month).

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

### 4. Address

Without a domain, the app lives at `https://caffio.<your-subdomain>.workers.dev` - it works, with
HTTPS, at no extra cost. When you buy a domain later, add it under Cloudflare dashboard → Workers →
caffio → Settings → Domains & Routes; nothing in this folder changes.

## Switching over from Railway

1. Deploy on Cloudflare and test it on the workers.dev address while Railway keeps serving cafés.
2. **Desktop app:** installed copies call the Railway address hard-coded in `main.js`
   (`PROD_BACKEND_URL`). Change it to the new address and ship a desktop update. Keep Railway
   running until those installs have updated, or they lose their server. If you plan to buy a
   domain soon, wait and point the desktop app at the domain instead - otherwise you ship this
   update twice.
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
