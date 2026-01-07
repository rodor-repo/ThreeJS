# ControlPanel Auth Bridge Guide (3D App ⇄ ControlPanel)

This guide defines the two ControlPanel endpoints required by the 3D app admin auth bridge flow.

## Reference Implementations (Webshop)

Before implementing, review the existing webshop versions for structure and error handling:

- `C:\Programming\joiner-shop-next\src\app\api\3D\three-js\auth-bridge\start\route.ts`
- `C:\Programming\joiner-shop-next\src\app\api\3D\three-js\auth-bridge\exchange\route.ts`

## Endpoint Paths (Final)

- Start: `GET /api/3D/three-js/auth-bridge/start`
- Exchange: `POST /api/3D/three-js/auth-bridge/exchange`

## ControlPanel Auth Notes

- Use `src/server/utils/getUserAuth.ts` to validate the `__session` cookie and return `uid`, `email`, etc.
- Use `src/server/redis.ts` for Redis access.

## Start Endpoint Spec

- Method: `GET`
- Path: `/api/3D/three-js/auth-bridge/start`
- Query params:
  - `state` (required) — signed JWT from the 3D app
  - `return_to` (required) — original 3D app path+query (relative URL)
  - `origin` (required) — the origin of the 3D app (e.g., `https://3d-app.com`)
- Auth requirement: relies on the ControlPanel `__session` cookie (admin must be logged in)

### Behavior

1. Validate the ControlPanel admin session via `getUserAuth()`.
2. Validate presence of `state` (no need to verify signature on ControlPanel).
3. Determine the preferred redirect origin:
   - Use the `origin` query parameter if provided.
   - Fall back to the standard `Referer` or `Origin` request headers if `origin` is missing.
   - Match against allowed origins (`NEXT_PUBLIC_THREEJS_APP_URLS`).
4. Compute `state_hash = SHA-256(state)`.
5. Generate a one-time `code` (random, short TTL 30–60s).
6. Store in Redis (via `src/server/redis.ts`):
   - bound to `uid`, `email`, and `state_hash`
   - TTL 30–60 seconds
7. Redirect the user to the 3D app callback with:
   - `code`
   - `state` (the same value received)
   - callback path on 3D app: `/api/auth/bridge/callback`

### Error Behavior

- If unauthenticated: redirect to ControlPanel login (or return 401 if API-only).
- If missing/invalid params: return `400` with error JSON (see format below).

## Exchange Endpoint Spec (S2S)

- Method: `POST`
- Path: `/api/3D/three-js/auth-bridge/exchange`
- Headers:
  - `Authorization: Bearer <WEBSHOP_SECRET_KEY>`
  - `Content-Type: application/json`
- Body JSON schema:
  ```json
  {
    "code": "string",
    "state_hash": "string"
  }
  ```

### Response JSON (success)

```json
{
  "success": true,
  "uid": "<admin-id>",
  "email": "admin@example.com"
}
```

### One-Time Semantics

- On successful redemption, delete the Redis key immediately.
- Reject reused or expired codes.

### Failure Status Codes

- `400` — invalid request (missing params)
- `401` — invalid/missing Authorization header
- `404` — code not found or expired
- `409` — code already redeemed
- `422` — `state_hash` mismatch

### Error JSON Format

```json
{ "success": false, "error": "<error_code>", "message": "<human_readable>" }
```

## Redis Key Format (ControlPanel)

- Key prefix: `auth_bridge_code:`
- Example key: `auth_bridge_code:<code>`
- Value fields:
  - `uid`
  - `email`
  - `state_hash`
  - `created_at`
- TTL: 30–60 seconds
- Deletion: delete immediately on successful exchange

## Copy-Paste Examples

### Exchange request (from 3D app backend)

```bash
curl -X POST "https://<CONTROL_PANEL_HOST>/api/3D/three-js/auth-bridge/exchange" \
  -H "Authorization: Bearer <WEBSHOP_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"code":"abc123","state_hash":"<sha256-of-state>"}'
```

### Example success response

```json
{
  "success": true,
  "uid": "admin_123",
  "email": "admin@example.com"
}
```

## Security Notes

- `state` is signed by the 3D app and prevents tampering of the `return_to` value.
- `state_hash` binding ensures that a stolen `code` cannot be redeemed without the matching `state` value.
- Avoid logging `code` or `state` in production logs.
