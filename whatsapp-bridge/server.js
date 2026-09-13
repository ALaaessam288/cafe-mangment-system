/**
 * Caffio WhatsApp bridge.
 *
 * Baileys speaks WhatsApp's WebSocket protocol directly - no headless Chrome, which is why this
 * runs in ~80MB instead of the ~450MB a Puppeteer-based gateway (open-wa, whatsapp-web.js) needs
 * beside the JVM. It exposes the smallest HTTP surface the Spring backend needs and nothing else.
 *
 * This is an UNOFFICIAL client. WhatsApp can restrict or ban the linked number at any time. Link a
 * number you are prepared to lose, never the cafe's main line and never a customer's.
 *
 *   GET  /status  -> connection state (no auth: it is the healthcheck)
 *   GET  /qr      -> QR page to link the number, first run only          [x-api-key]
 *   POST /send    -> { "to": "201234567890", "text": "..." }             [x-api-key]
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  Browsers,
} from 'baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import QRCode from 'qrcode';
import pino from 'pino';

const PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.BRIDGE_API_KEY || '';
const AUTH_DIR = process.env.AUTH_DIR || '/data/auth';

// WhatsApp's abuse detection keys on burst rate, so messages leave one at a time with a gap
// between them. The backend's callers are all fire-and-forget notifications; none of them needs
// to be instant, and a queue that paces itself is the cheapest ban mitigation available.
const SEND_GAP_MS = Number(process.env.SEND_GAP_MS || 4000);

if (!API_KEY) {
  console.error('BRIDGE_API_KEY is not set. Refusing to start: an open /send endpoint on a public '
    + 'URL is an open relay that would get the linked number banned within hours.');
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

let sock = null;
let connection = 'connecting';
let lastQr = null;
let linkedJid = null;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // fetchLatestBaileysVersion reaches out over the network. A blip there must not take the bridge
  // down on boot - Baileys carries a bundled fallback version that works until the next protocol
  // bump, and a slightly stale version is a far better failure mode than a crash loop.
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (error) {
    console.warn(`[bridge] could not fetch latest WA version (${error.message}) - using bundled default`);
  }

  sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    browser: Browsers.ubuntu('Caffio'),
    // The bridge sends; it has no reason to announce that a human read anything.
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection: next, lastDisconnect, qr } = update;

    if (qr) {
      lastQr = qr;
      console.log('[bridge] QR ready - open /qr to link the number');
    }

    if (next) connection = next;

    if (next === 'open') {
      lastQr = null;
      linkedJid = sock?.user?.id ?? null;
      console.log(`[bridge] connected as ${linkedJid}`);
    }

    if (next === 'close') {
      const status = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = status === DisconnectReason.loggedOut;
      console.log(`[bridge] disconnected (status ${status}) - ${loggedOut ? 'logged out' : 'reconnecting'}`);

      if (loggedOut) {
        // The stored credentials are dead. Reconnecting with them loops forever; the number has to
        // be linked again, so surface that state instead of hiding it in a retry.
        linkedJid = null;
        connection = 'logged_out';
        return;
      }
      setTimeout(start, 3000);
    }
  });
}

/* ── outbound queue ─────────────────────────────────────────────────────── */

const queue = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await sock.sendMessage(job.jid, { text: job.text });
      console.log(`[bridge] sent to ${mask(job.jid)}`);
    } catch (error) {
      console.error(`[bridge] send failed for ${mask(job.jid)}: ${error.message}`);
    }
    if (queue.length) await sleep(SEND_GAP_MS);
  }
  draining = false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// A JID carries a device suffix - 201061967618:21@s.whatsapp.net - and stripping non-digits
// blindly folded that suffix into the number, so /status reported "***1821" for a number
// ending 7618 and made it look like a different line had been linked. Cut at ':' and '@'
// first, then mask.
const mask = (jid) => `***${String(jid).split('@')[0].split(':')[0].replace(/\D/g, '').slice(-4)}`;

/**
 * Egyptian numbers arrive in every shape a human might type. Reduce to digits, drop the trunk 0,
 * assume Egypt when no country code is present.
 */
function toJid(raw) {
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  if (digits.length === 10) digits = `20${digits}`;
  return `${digits}@s.whatsapp.net`;
}

/* ── http ───────────────────────────────────────────────────────────────── */

const app = express();
app.use(express.json({ limit: '64kb' }));

function requireKey(req, res, next) {
  const provided = req.get('x-api-key') || '';
  // Length-insensitive compare is fine here only because both sides are compared as whole strings;
  // the key never appears in a URL, so it stays out of access logs and browser history.
  if (provided !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/status', (_req, res) => {
  res.json({
    connection,
    linked: Boolean(linkedJid),
    jid: linkedJid ? mask(linkedJid) : null,
    qrPending: Boolean(lastQr),
    queued: queue.length,
  });
});

app.get('/qr', requireKey, async (_req, res) => {
  if (!lastQr) {
    return res
      .status(404)
      .send(linkedJid ? 'Already linked. Nothing to scan.' : 'No QR yet - wait a few seconds and reload.');
  }
  const dataUrl = await QRCode.toDataURL(lastQr, { margin: 2, width: 320 });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(
    `<body style="display:grid;place-items:center;height:100vh;margin:0;font:14px system-ui;background:#111;color:#eee">
       <div style="text-align:center">
         <img src="${dataUrl}" alt="QR" style="border-radius:12px">
         <p>WhatsApp &rarr; Linked devices &rarr; Link a device</p>
       </div>
     </body>`
  );
});

app.post('/send', requireKey, (req, res) => {
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
  if (connection !== 'open') return res.status(503).json({ error: 'not connected', connection });

  queue.push({ jid: toJid(to), text: String(text) });
  drain();

  // Accepted, not delivered. The queue paces itself, so a caller that waited for delivery would be
  // holding a request open for seconds; every caller in Caffio is fire-and-forget anyway.
  res.status(202).json({ queued: queue.length });
});

app.listen(PORT, () => console.log(`[bridge] listening on ${PORT}, auth state in ${AUTH_DIR}`));

start().catch((error) => {
  // Deliberately not exiting: the HTTP server stays up so /status can report the failure instead
  // of Railway showing a bare crash loop with no explanation.
  connection = 'failed';
  console.error('[bridge] failed to start WhatsApp socket:', error.message);
  setTimeout(() => start().catch(() => {}), 15000);
});
