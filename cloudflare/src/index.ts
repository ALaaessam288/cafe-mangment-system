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
  };
  for (const key of PASSTHROUGH) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') vars[key] = value;
  }
  return vars;
}

export class CaffioBackend extends Container {
  defaultPort = 8080;
  // The cron below calls every 5 minutes, so in practice this never sleeps. It is the safety net:
  // if the cron is ever removed, an idle container stops (and stops billing) after 30 minutes.
  sleepAfter = '30m';
  envVars = containerEnv();

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
        .fetch(new Request('http://container/api/health'))
        .then((r) => console.log('keep-alive', r.status))
        .catch((e) => console.error('keep-alive failed', e)),
    );
  },
} satisfies ExportedHandler;
