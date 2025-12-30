import { SignJWT, jwtVerify } from "jose"
import { BRIDGE_STATE_TTL_SECONDS, type BridgeProvider } from "./constants"

export type BridgeStatePayload = {
  nonce: string
  return_to: string
  provider: BridgeProvider
}

function getBridgeStateSecret() {
  const secret = process.env.BRIDGE_STATE_SECRET
  if (!secret) {
    throw new Error("BRIDGE_STATE_SECRET is required")
  }
  return new TextEncoder().encode(secret)
}

export async function createBridgeStateToken(
  payload: BridgeStatePayload
): Promise<string> {
  return new SignJWT({
    nonce: payload.nonce,
    return_to: payload.return_to,
    provider: payload.provider,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${BRIDGE_STATE_TTL_SECONDS}s`)
    .sign(getBridgeStateSecret())
}

export async function verifyBridgeStateToken(
  token: string
): Promise<BridgeStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getBridgeStateSecret())
    const nonce = payload.nonce
    const returnTo = payload.return_to
    const provider = payload.provider

    if (
      typeof nonce !== "string" ||
      typeof returnTo !== "string" ||
      (provider !== "webshop" && provider !== "controlpanel")
    ) {
      return null
    }

    return { nonce, return_to: returnTo, provider }
  } catch {
    return null
  }
}

export async function hashBridgeState(state: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available for state hashing")
  }

  const data = new TextEncoder().encode(state)
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
