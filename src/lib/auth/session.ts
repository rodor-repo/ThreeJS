import { SignJWT, jwtVerify } from "jose"
import { DEFAULT_SESSION_TTL_SECONDS } from "./constants"

export type RoomSessionPayload = {
  uid: string
  email: string
  role: "user" | "admin"
}

function getSessionSecret() {
  const secret = process.env.THREEJS_AUTH_SECRET
  if (!secret) {
    throw new Error("THREEJS_AUTH_SECRET is required")
  }
  return new TextEncoder().encode(secret)
}

export function getSessionTtlSeconds() {
  const rawValue = process.env.THREEJS_SESSION_TTL_SECONDS
  if (!rawValue) return DEFAULT_SESSION_TTL_SECONDS

  const parsed = Number(rawValue.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS
  }

  return parsed
}

export async function createRoomSessionToken(
  payload: RoomSessionPayload
): Promise<string> {
  const ttlSeconds = getSessionTtlSeconds()

  return new SignJWT({
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSessionSecret())
}

export async function verifyRoomSessionToken(
  token: string
): Promise<RoomSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    const uid = payload.uid
    const email = payload.email
    const role = payload.role

    if (
      typeof uid !== "string" ||
      typeof email !== "string" ||
      (role !== "user" && role !== "admin")
    ) {
      return null
    }

    return { uid, email, role }
  } catch {
    return null
  }
}
