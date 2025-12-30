# Webshop Auth Bridge Guide (3D App ⇄ Webshop)

This guide defines the two webshop endpoints required by the 3D app auth bridge flow.

## Endpoint Paths (Final)

- Start: `GET /api/3D/three-js/auth-bridge/start`
- Exchange: `POST /api/3D/three-js/auth-bridge/exchange`

## Existing 3D Webshop Endpoints (Reference)

These existing endpoints are already used by the 3D app and show the URL naming pattern:

- `GET /api/3D/three-js/wsProducts`
- `POST /api/3D/three-js/calculate-price`
- `POST /api/3D/three-js/add-to-cart`

## Start Endpoint Spec

- Method: `GET`
- Path: `/api/3D/three-js/auth-bridge/start`
- Query params:
  - `state` (required) — signed JWT from the 3D app
  - `return_to` (required) — original 3D app path+query (for redirect convenience)
- Auth requirement: relies on existing webshop session cookies (user must be logged in)

### Behavior

1. Validate the webshop user session from cookies.
2. Validate presence of `state` (no need to verify signature on the webshop).
3. Compute `state_hash = SHA-256(state)`.
4. Generate a one-time `code` (random, short TTL 30–60s).
5. Store in Redis:
   - bound to `uid`, `email`, and `state_hash`
   - TTL 30–60 seconds
6. Redirect the user to the 3D app callback with:
   - `code`
   - `state` (the same value received)
   - callback path on 3D app: `/api/auth/bridge/callback`

### Error Behavior

- If unauthenticated: redirect to the webshop login page (or return a 401 if API-only).
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
  "uid": "<user-id>",
  "email": "user@example.com"
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

## Redis Key Format (Webshop)

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
curl -X POST "https://<WEBSHOP_HOST>/api/3D/three-js/auth-bridge/exchange" \
  -H "Authorization: Bearer <WEBSHOP_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"code":"abc123","state_hash":"<sha256-of-state>"}'
```

### Example success response

```json
{
  "success": true,
  "uid": "user_123",
  "email": "user@example.com"
}
```

## Security Notes

- `state` is signed by the 3D app and prevents tampering of the `return_to` value.
- `state_hash` binding ensures that a stolen `code` cannot be redeemed without the matching `state` value.
- Avoid logging `code` or `state` in production logs.
