# Caffio WhatsApp bridge

A ~150-line Node service that speaks WhatsApp on one side and plain HTTP on the other. Caffio's
Spring backend posts JSON to it; it sends the message.

**This is an unofficial client.** It links a real WhatsApp account the way WhatsApp Web does, and
WhatsApp can restrict or ban that account at any time. Link a number you are prepared to lose —
never the café's main line, never a customer's. For messages that go to paying customers, use the
official Cloud API instead; this bridge exists so the feature can be built and tried without one.

## Why Baileys and not open-wa / whatsapp-web.js

Those drive a headless Chrome, which costs roughly 450 MB of RAM beside the JVM. Baileys implements
WhatsApp's WebSocket protocol directly and runs in about 80 MB. On a small Railway instance that is
the difference between working and being OOM-killed. The ban risk is identical — all three are
unofficial clients.

## Environment

| Variable | Required | Default | |
|---|---|---|---|
| `BRIDGE_API_KEY` | **yes** | — | The service refuses to start without it. A public `/send` with no key is an open relay. |
| `AUTH_DIR` | no | `/data/auth` | Where the linked-device credentials live. **Must be a mounted volume.** |
| `PORT` | no | `8080` | Railway injects this. |
| `SEND_GAP_MS` | no | `4000` | Minimum gap between two outgoing messages. |
| `LOG_LEVEL` | no | `warn` | Baileys' own logger. `debug` is extremely loud. |

## Endpoints

| | | |
|---|---|---|
| `GET /status` | no auth | Connection state. Unauthenticated on purpose — it is the healthcheck. Reports only the last 4 digits of the linked number. |
| `GET /qr` | `x-api-key` | QR page for linking. 404 once linked. |
| `POST /send` | `x-api-key` | `{"to": "01061967618", "text": "..."}` → `202 Accepted`. |

`202`, not `200`: the message is queued, not delivered. The queue sends one message at a time with
`SEND_GAP_MS` between them, because burst rate is what WhatsApp's abuse detection keys on. Every
caller in Caffio is fire-and-forget, so nothing waits on delivery.

Numbers may be sent in any shape a human would type — `01061967618`, `+20 106 196 7618`,
`00201061967618`. Digits are extracted, a leading trunk `0` is replaced with `20`, and a bare
10-digit number is assumed Egyptian.

## Deploying on Railway

1. **New service → same repo → set the root directory to `whatsapp-bridge`.** Railway builds the
   Dockerfile in that folder.
2. **Attach a volume mounted at `/data`.** Skip this and the credentials are wiped on every deploy,
   and you re-scan the QR every time.
3. Set `BRIDGE_API_KEY` to something from `openssl rand -hex 24`.
4. Deploy, then open `https://<bridge>.up.railway.app/qr` with the `x-api-key` header — or add
   `?key=` only if you have changed the code to accept it, which you should not: URLs end up in
   access logs.
5. On the phone: **WhatsApp → Linked devices → Link a device**, scan.
6. `GET /status` should now report `"connection": "open"`.

Then point the Caffio backend at it:

```
WHATSAPP_GATEWAY_ENABLED=true
WHATSAPP_PROVIDER=BAILEYS
WHATSAPP_API_URL=http://<bridge-service>.railway.internal:8080
WHATSAPP_API_TOKEN=<the same BRIDGE_API_KEY>
```

Use Railway's **private** network address (`.railway.internal`) rather than the public URL. The
bridge then has no reason to be reachable from the internet at all, which removes a whole class of
problem.

## Running locally

```bash
cd whatsapp-bridge
npm install
BRIDGE_API_KEY=dev AUTH_DIR=./.auth PORT=8099 npm start
# open http://localhost:8099/qr  (send the x-api-key header)
```

## When it stops working

`GET /status` answers first:

| `connection` | |
|---|---|
| `open` | Linked and sending. |
| `connecting` | Normal for a few seconds after boot; if it persists, the auth state is probably empty — check `/qr`. |
| `logged_out` | The link was removed from the phone, or WhatsApp revoked it. The stored credentials are dead: clear the volume's `auth` directory and re-link. The bridge does **not** retry this state, because retrying with dead credentials loops forever. |
| `failed` | The socket could not be opened at all. The log line says why. Retries every 15s. |
