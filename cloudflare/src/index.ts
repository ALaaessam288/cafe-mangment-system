import { Container, getContainer } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

/*
 * Settings the Spring Boot app reads from its environment. Values come from `wrangler secret put`
 * (secrets) or `vars` in wrangler.jsonc. Anything unset is left out, so the app's own defaults in
 * application.properties apply - the same behaviour as an unset variable on Railway.
 */
const PASSTHROUGH = [
  'DATABASE_URL',
  'DATABASE_USERNAME',
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'APP_PLATFORM_PROVISIONING_KEY',
  'CORS_ALLOWED_ORIGINS',
  'WHATSAPP_GATEWAY_ENABLED',
  'WHATSAPP_PROVIDER',
  'WHATSAPP_API_URL',
  'WHATSAPP_INSTANCE_ID',
  'WHATSAPP_API_TOKEN',
] as const;

function containerEnv(): Record<string, string> {
  const source = env as unknown as Record<string, unknown>;
  const vars: Record<string, string> = {
    // The app listens on PORT, falling back to 8081; pin it to what defaultPort below expects.
    PORT: '8080',
    // Production settings that docker-compose.yml sets for a Postgres deployment.
    FLYWAY_ENABLED: 'true',
    JPA_DDL_AUTO: 'validate',
    SHOW_SQL: 'false',
    /*
     * Neon pauses the database after 5 idle minutes; on the free plan that is what keeps it inside
     * 100 compute-hours a month. Spring's connection pool would otherwise hold 10 connections open
     * for ever. Idle connections do not wake Neon by themselves, but the pool's keep-alive pings
     * would, every 2 minutes. So: no idle minimum, close a connection after a minute unused, no
     * keep-alive. When a cashier does something the pool reconnects, and Neon wakes in well
     * under a second.
     */
    SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE: '0',
    SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT: '60000',
    SPRING_DATASOURCE_HIKARI_KEEPALIVE_TIME: '0',
    // The subscription-expiry pass wakes the database each time it runs. Expiry is enforced live on
    // every request anyway; this pass only records the change and sends warnings days in advance,
    // so every 6 hours instead of hourly loses nothing and saves ~20 database wake-ups a day.
    BILLING_SCHEDULER_INTERVAL_MS: '21600000',
  };
  for (const key of PASSTHROUGH) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') vars[key] = value;
  }
  return vars;
}

export class CaffioBackend extends Container {
  defaultPort = 8080;
  // Startup check and keep-alive both use the endpoint that never touches the database.
  pingEndpoint = 'container/api/ping'; // host + path: GET http://container/api/ping
  // The cron below calls every 5 minutes, so in practice this never sleeps. It is the safety net:
  // if the cron is ever removed, an idle container stops (and stops billing) after 30 minutes.
  sleepAfter = '30m';
  envVars = containerEnv();

  /*
   * Start the app ourselves, with a startup allowance Java actually needs.
   *
   * The library waits 20 s for the port to answer and then fails the request. Spring Boot needs
   * ~12 s on a fast machine and noticeably longer on this instance's 1/4 vCPU, so the first request
   * after every restart or deploy would fail. Two minutes is generous; once the app is up this
   * check is one state read and the request passes straight through.
   */
  override async fetch(request: Request): Promise<Response> {
    const state = await this.getState();
    if (state.status !== 'healthy') {
      try {
        await this.startAndWaitForPorts({ cancellationOptions: { portReadyTimeoutMS: 120_000 } });
      } catch (error) {
        console.error('Caffio backend failed to start', error);
        return new Response('السيستم بيبدأ التشغيل - حاول تاني بعد دقيقة.\nThe system is starting, please retry in a minute.', {
          status: 503,
          headers: { 'Retry-After': '30', 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
    return super.fetch(request);
  }

  override onStart(): void {
    console.log('Caffio backend started');
  }

  override onError(error: unknown): never {
    console.error('Caffio backend error', error);
    throw error;
  }
}

/** The one and only backend instance. Every request and the cron go to the same container. */
function backend() {
  return getContainer(env.BACKEND as DurableObjectNamespace<CaffioBackend>);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);

    /*
     * The container only ever sees the Worker as its caller, so every visitor would share one
     * address and one sign-up rate limit. Pass the real visitor address along - and overwrite,
     * never append to, whatever X-Forwarded-For the visitor sent, or anyone could pick their own
     * address and walk around the limit.
     */
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Forwarded-For', clientIp);
    else headers.delete('X-Forwarded-For');
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
    headers.set('X-Forwarded-Host', url.host);

    return backend().fetch(new Request(request, { headers }));
  },

  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      backend()
        // /api/ping, not /api/health: health opens a database connection, which would stop Neon
        // from ever pausing and spend the free plan's compute in about two weeks.
        .fetch(new Request('http://container/api/ping'))
        .then((r) => console.log('keep-alive', r.status))
        .catch((e) => console.error('keep-alive failed', e)),
    );
  },
} satisfies ExportedHandler;
