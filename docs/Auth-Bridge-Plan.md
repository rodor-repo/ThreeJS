# Auth Bridge Plan (3D App ⇄ Webshop)

## Goal

Implement a “bridge auth” flow so a user who is logged-in on the webshop can be recognized in the 3D app without a separate login UI.

- If the 3D app has a valid 3D-session cookie, proceed normally.
- If missing/expired, automatically redirect the user to the webshop bridge start endpoint.
- Webshop redirects back with a one-time code.
- 3D app redeems that code server-to-server (S2S) using existing `Authorization: Bearer ${process.env.WEBSHOP_SECRET_KEY}`.
- 3D app sets its own HttpOnly session cookie and redirects the user back to their original URL.

This plan covers **3D app changes** and requires **2 new webshop APIs** (defined later in a separate guide file the agent must generate).

---

## Non-Goals

- No Firebase client auth changes.
- No cross-domain cookie sharing tricks.
- No long-lived tokens in URLs.

---

## Assumptions / Constraints

- Webshop is process.env.WEBSHOP_URL (`https://example.com`) (root domain).
- 3D app is a separate Next.js app (may run on preview URLs in dev).
- For S2S communication, 3D app backend already calls webshop with:

  ```js
  headers: {
    Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
    ...
  }
  ```

* Webshop has Redis available (ideal place to store bridge one-time codes).

---

## Definitions

### 3D session cookie

A cookie set on the 3D app domain that represents an authenticated user (uid/email). Prefer JWT signed by a 3D-app secret.

- Name: choose a clear name (e.g. `threejs_session`).
- HttpOnly, Secure (in prod), SameSite=Lax, Path=/.
- TTL recommendation: **1–2 hours** for the access session.

### Bridge code

A one-time code created by the webshop (stored in Redis with TTL 30–60s), redeemable exactly once via S2S exchange.

### State (tamper-proof)

A signed value created by the 3D app and sent to the webshop during redirect. It must not be modifiable by the client.

Implement it as:

- a compact JWT signed with `BRIDGE_STATE_SECRET`

State must include:

- `return_to` (original 3D URL or at least path+query)
- `nonce` (random)
- `iat` and `exp` (short, e.g. 5 minutes)

To prevent replay, the 3D app should also store the nonce in an HttpOnly cookie (short TTL) and require it to match at callback.

---

## Implementation Tasks (Copilot Agent Instructions)

### 0) Scan the codebase first

Find existing patterns and routes to integrate cleanly:

- Search for:

  - `middleware.ts` - hint: doesn't exit yet! trust me.
  - existing cookie helpers - hint: doesn't exit yet!
  - any existing `auth` folder / routes - hint: doesn't exit yet!
  - existing webshop S2S call code (the place that already uses `WEBSHOP_SECRET_KEY`) - suggestion: src\server\addToCart.ts
  - existing “add to cart” flow in the 3D app - suggestion: src\server\addToCart.ts
    Note: The existing S2S call in `addToCart.ts` also uses `VERCEL_AUTOMATION_BYPASS_SECRET` header - this should continue to be used.

Record conventions:

- Are API routes in `app/api/.../route.ts`? - hint: NO! No api route created yet.
- Is middleware already present? - No.
- Do we have a shared `lib/` for auth and cookies? - Not yet.
- Note that the codebase currently always used server-actions instead of API routes, BUT I would suggest all the auth related client-server communication be done with API route.ts files, and NO server-actions. (easier integration with middleware, and so on.)

### 1) Add 3D app session token utilities

Create a small auth module (location depends on repo conventions), e.g.:

- `src/lib/auth/session.ts`

  - `createRoomSessionToken({ uid, email })`
  - `verifyRoomSessionToken(token)`

- `src/lib/auth/cookies.ts`

  - `setRoomSessionCookie(response, token, maxAgeSeconds)`
  - `clearRoomSessionCookie(response)`

Rules:

- Session token is **JWT**, signed with `process.env.THREEJS_AUTH_SECRET`.
- Token includes `uid`, `email`, `iat`, `exp`.
- Default expiry: **2 hours** (configurable via env).

Add env vars:

- `THREEJS_AUTH_SECRET` - for signing session JWTs
- `THREEJS_SESSION_TTL_SECONDS` (default 7200)
- `BRIDGE_STATE_SECRET` - for signing bridge state JWTs (can be same as THREEJS_AUTH_SECRET, but separate is cleaner)
- `WEBSHOP_URL` (already used)
- `WEBSHOP_SECRET_KEY` (already used)

Library recommendation: Use `jose` for JWT operations (Edge-runtime compatible, modern API).

Cookie name: Use `threejs_session` (as defined in Definitions section).

### 2) Implement bridge redirect in middleware

Create `middleware.ts` at the src folder (Next.js convention).

In the 3D app middleware:

- If request path is public (assets, favicon, `/_next`, bridge callback endpoint, etc.), allow.
- For protected pages (at minimum: room builder UI routes), check for a valid 3D session cookie.
- If missing/invalid:

  1. generate a random `nonce`
  2. create signed `state` containing:

     - `nonce`
     - `return_to` = full current URL (path + query at minimum)
     - short expiry (5 min)

  3. set `bridge_nonce` cookie (HttpOnly, short TTL like 5–10 min)
  4. redirect to webshop bridge start endpoint:

     `GET ${WEBSHOP_URL}<START_ENDPOINT>?state=<STATE>&return_to=<ENCODED_RETURN_TO>`

Notes:

- Use a **307** redirect (preserves request method, recommended over 302).
- `bridge_nonce` cookie attributes: `HttpOnly`, `Secure` (in prod), `SameSite=Lax`, `Path=/`.
- The middleware must avoid infinite loops by excluding:

  - the callback route
  - any internal API paths used by callback

- `return_to` should not accept arbitrary third-party hosts. Store only path+query in `state`, and reconstruct the final URL on 3D origin at callback time.
- Note: The `return_to` query param in the redirect URL is for the webshop to pass back; the authoritative `return_to` is inside the signed `state`.

Add a matcher config for performance:

```ts
export const config = {
  matcher: [
    // Match all paths except static files and internal Next.js routes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### 3) Implement bridge callback route (3D app)

Create a callback endpoint in the 3D app (path depends on routing conventions), e.g.:

- `GET /api/auth/bridge/callback` (recommended as an API route so it can set cookies and redirect)

Behavior:

1. Read query params:

   - `code`
   - `state`

2. Verify `state` signature + expiry.

3. Read `bridge_nonce` cookie and require it matches `state.nonce`.

   - If missing/mismatch: restart bridge (redirect to start again).

4. Redeem the `code` via S2S request to webshop exchange endpoint:

   - `POST ${WEBSHOP_URL}<EXCHANGE_ENDPOINT>`
   - headers include:

     - `Authorization: Bearer ${process.env.WEBSHOP_SECRET_KEY}`
     - `Content-Type: application/json`

   - body:

     - at minimum `{ code }`
     - ideally also include `state` or `state_hash` so webshop can bind code to state

5. If exchange succeeds:

   - create 3D session JWT (`threejs_session`)
   - set HttpOnly cookie with TTL 1–2h
   - clear `bridge_nonce` cookie
   - redirect user to `return_to` (sanitize: must remain on the 3D app origin)

6. If exchange fails (expired/redeemed/invalid):

   - clear `bridge_nonce`
   - restart bridge flow (redirect to start again)

### 4) Ensure “Add to cart” uses the 3D session

We're talking about `src\server\addToCart.ts`. Ensure server-side logic reads the 3D session cookie (uid/email) and uses it when calling webshop cart endpoints. (note that it used to just accept an email blindly, used for testing before.)

- The addToCart server-action should:

  - Use `cookies()` from `next/headers` to read the `threejs_session` cookie
  - Call `verifyRoomSessionToken()` to extract uid/email
  - Call webshop cart API using the same exact logic as before (S2S Authorization header + `VERCEL_AUTOMATION_BYPASS_SECRET`), only now using the email from the verified token
  - Remove or deprecate the `userEmail` parameter (no longer accept it from client)
  - On auth failure: return a specific error type (e.g. `{ success: false, error: 'AUTH_REQUIRED' }`) so the client can detect it and trigger a page reload/navigation to restart the bridge flow

### 5) Tighten security defaults

- `state` expiry: 5 minutes.
- `bridge_nonce` cookie TTL: 5–10 minutes.
- Webshop code TTL: 30–60 seconds (webshop responsibility).
- Session cookie TTL: 1–2 hours (configurable through process.env.THREEJS_SESSION_TTL_SECONDS).
- Never log `code` or `state` in plaintext in production logs.

### 6) Testing checklist

- Fresh user with valid webshop session, no 3D cookie:

  - gets redirected to webshop and comes back authenticated
  - returns to exact original 3D URL

- Callback with tampered `state` fails.
- Callback with missing nonce cookie fails (restarts).
- Reusing the same `code` fails (one-time).
- Expired `code` fails gracefully.
- No redirect loops.
- Expired 3D session cookie triggers redirect to bridge.
- `return_to` validation rejects external URLs (e.g. `return_to=https://evil.com`).
- Static assets and `/_next` paths are not blocked by middleware.
- addToCart with invalid/missing session returns `AUTH_REQUIRED` error.

---

## Webshop Requirements (2 new APIs)

The 3D app implementation will require exactly **two** new webshop endpoints:

1. **Bridge Start**: creates one-time code (Redis) for the currently authenticated webshop user and redirects back to the 3D callback.
2. **Bridge Exchange (S2S)**: redeems one-time code and returns minimal identity (uid/email) to the 3D app.

**Important**: the exact URL paths + query/body params must match the 3D app code you implement.

---

## Deliverable: Create a webshop guide markdown file (MUST DO)

After implementing and confirming the 3D app works end-to-end, create a second markdown file in this repo:

- `docs/webshop-auth-bridge-guide.md`

This guide is for another AI assistant working inside the webshop codebase. It must include:

### A) Final endpoint paths (no placeholders)

- Full webshop endpoint paths used by 3D app:

  - START endpoint path
  - EXCHANGE endpoint path

### B) Start endpoint spec

- Method (GET)
- Query params (exact names)

  - `state` (required)
  - `return_to` (if used, required/optional)

- Auth requirement: relies on existing webshop user session cookies
- Behavior:

  - validates user session
  - creates one-time `code` (TTL 30–60s) in Redis bound to uid/email and (preferably) `state_hash`
  - redirects to 3D callback with `code` and `state`

- Error behavior (unauthenticated, invalid params)

### C) Exchange endpoint spec (S2S)

- Method (POST)
- Headers required:

  - `Authorization: Bearer <WEBSHOP_SECRET_KEY>`

- Body JSON (exact schema)

  - `code` required
  - `state_hash` **required** (SHA-256 hash of the state string) - binds the code to the specific state to prevent code theft attacks

- Response JSON (exact schema)

  - must include `uid` and `email` at minimum

- One-time semantics:

  - deletes Redis code on successful redemption
  - rejects reused/expired codes

- HTTP status codes for failures:

  - `400` - invalid request (missing params)
  - `401` - invalid/missing Authorization header
  - `404` - code not found or expired
  - `409` - code already redeemed
  - `422` - state_hash mismatch

- Error response JSON format:
  ```json
  { "success": false, "error": "<error_code>", "message": "<human_readable>" }
  ```

### D) Redis key format (webshop side)

Document:

- key prefix
- value fields
- TTL
- deletion behavior on redemption

### E) Copy-paste examples

Include request examples (curl-style) for:

- exchange request from 3D app backend
- sample response payload

### F) Notes about security

- Why `state` is signed
- Binding code to state (if implemented)
- Logging guidance

The guide must reflect the actual implementation details the agent chose in the 3D app (paths, param names, cookie names, etc.). No guessing.

---

## Notes for Copilot Agent

- Prefer minimal touchpoints: implement the smallest set of files needed, follow existing repo conventions.
- Keep the middleware exclusions correct to avoid redirect loops.
- Keep everything server-side where possible (S2S exchange, cookie setting).
- Commit in logical chunks if that’s the repo style.
