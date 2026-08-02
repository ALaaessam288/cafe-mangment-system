# Frontend Integration Guide — Multi-Tenant API Changes

This backend is now multi-tenant: one deployment serves many independent cafes/restaurants
("tenants"), each with fully isolated data. This doc covers what changed and what's new. Every
other endpoint (menu, orders, payments, discounts, expenses, printing, cafe tables, stations,
users) is **unchanged** at the request/response level — see the live reference at
`/swagger-ui.html` (or the raw spec at `/v3/api-docs`) for those.

## The one breaking change: login needs a tenant

Every login request must now say which tenant it's logging into. There is no global username —
the same username can exist in multiple tenants (e.g. two different cafes can both have an
`admin`), so the tenant has to be specified up front.

### `POST /api/auth/login`

```json
{
  "tenantSlug": "blue-bottle",
  "username": "admin",
  "password": "••••••••"
}
```

`tenantSlug` is required (`400` if blank). If you had a login form/request hardcoded to just
`{ username, password }`, it will now fail validation — add the field.

**How the UI should collect `tenantSlug`** is a product decision, not just a technical one. Common
patterns: a "workspace" field on the login screen (Slack-style), a subdomain per tenant
(`blue-bottle.yourapp.com`), or a fixed value baked into config if a build is deployed per
customer. Whichever you pick, the value must exactly match the `slug` the tenant was provisioned
with (lowercase, hyphenated).

Response shape is unchanged:

```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "tokenType": "Bearer",
  "refreshToken": "wkEgRuGn5-y6iKkcQAdGQAX5xLdn-lxw8a03EsHsk7pBv0WfvNlzt2qSIsbBNBkW",
  "userId": 1,
  "username": "admin",
  "fullName": "Admin A",
  "role": "ADMIN"
}
```

`role` is one of `CASHIER`, `SUPERVISOR`, `ADMIN`.

A wrong tenant, wrong username, or wrong password all return the **same** generic error — this is
deliberate (doesn't reveal which part was wrong):

```json
{ "status": 401, "error": "Unauthorized", "message": "Invalid username or password" }
```

### `POST /api/auth/refresh` and `POST /api/auth/logout`

Unchanged: `{ "refreshToken": "..." }` in, same `LoginResponse` shape back out for refresh, `204`
for logout. You don't need to know or resend the tenant — it's carried inside the refresh token
server-side.

### The access token now carries a tenant claim

If anything in the frontend decodes the JWT locally (e.g. to read the role for UI gating without a
round trip), note the payload now includes `tenantId`:

```json
{
  "sub": "admin",
  "userId": 1,
  "tenantId": 1,
  "role": "ROLE_ADMIN",
  "iat": 1785669487,
  "exp": 1785670387
}
```

Access tokens are short-lived (15 min) by design — use the refresh token to get a new one rather
than treating expiry as an error state.

## New: `GET /api/tenant/me`

Any authenticated user (any role) can call this to find out which tenant/business they're in —
useful for branding the UI or toggling cafe-vs-restaurant-specific screens later.

```json
{
  "id": 1,
  "name": "Blue Bottle Downtown",
  "slug": "blue-bottle",
  "businessType": "CAFE",
  "status": "TRIAL",
  "timezone": "UTC",
  "currency": "USD"
}
```

- `businessType`: `CAFE` or `RESTAURANT` — nothing in the API branches on this yet, but it's there
  for upcoming feature differences (reservations, delivery, etc.).
- `status`: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`. Not currently enforced against non-auth
  endpoints — a suspended tenant's users just won't be able to log in.

## New: registers, and shifts now require one

Cafes/restaurants with more than one till now model each physical register as its own entity.
**This changes the shift-opening request** — every other shift endpoint is unchanged.

### `GET` / `POST /api/registers`

```json
// POST /api/registers  (ADMIN only)
{ "name": "Front Counter" }
```
```json
// response
{ "id": 1, "name": "Front Counter", "active": true }
```

Also: `GET /api/registers/{id}`, `PUT /api/registers/{id}` (rename, ADMIN), and
`PUT /api/registers/{id}/activate` / `.../deactivate` (ADMIN) — same soft-delete pattern as cafe
tables and stations. Reads are open to any authenticated role, so you can populate a register
picker without an admin session.

### `POST /api/shifts` now requires `registerId`

```json
{
  "openingFloat": 100.00,
  "registerId": 1
}
```

The shift-open screen needs a register picker before it needs an opening-float input. New failure
cases on top of the existing "user already has an open shift":

| Status | Meaning |
|---|---|
| `404` | `registerId` doesn't exist |
| `400` | Register exists but is deactivated |
| `409` | That register already has an open shift (someone else is on it) |

`ShiftResponse` (returned from open/close/current/list) gained two fields:

```json
{
  "id": 1,
  "userId": 1,
  "username": "admin",
  "registerId": 1,
  "registerName": "Front Counter",
  "openedAt": "2026-08-02T11:18:30.394572600Z",
  "closedAt": null,
  "openingFloat": 100.00,
  "expectedCash": null,
  "countedCash": null,
  "variance": null
}
```

## Tenant onboarding isn't self-service yet

There's no "sign up" flow in the app. Tenants (and their first admin login) are created by an
ops-only endpoint gated by a static key, not something the frontend calls. If you're building an
onboarding screen, hold off — this is on the roadmap but not built.

## Error shape reference

Two shapes exist depending on where the error is raised — both are stable and safe to pattern-match on:

```json
// business-logic errors (404 not found, 409 conflict, 400 bad request, etc.)
{ "timestamp": "2026-08-02T11:18:30Z", "status": 404, "error": "Not Found", "message": "Register not found: 5" }

// auth failures (401 / 403)
{ "status": 401, "error": "Unauthorized", "message": "Invalid username or password" }
```

`message` is always safe to show directly to a user for 4xx responses in this API — none of them
leak internal details.

## Roles, unchanged

Three roles, flat (no per-tenant customization yet): `CASHIER` < `SUPERVISOR` < `ADMIN`. Most
mutating endpoints require `ADMIN`; a few (discounts, shift force-close) accept `ADMIN` or
`SUPERVISOR`. Reads are generally open to any authenticated role. Check `/swagger-ui.html` for the
per-endpoint requirement if unsure.
