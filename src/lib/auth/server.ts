import { cookies } from "next/headers"
import {
  USER_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from "./constants"
import { verifyRoomSessionToken, type RoomSessionPayload } from "./session"

/**
 * Require a valid user session (webshop customer).
 * Reads the user session cookie, verifies the token, and ensures role is "user".
 *
 * @throws Error with message "AUTH_REQUIRED" if no session or invalid session
 * @returns The verified session payload with email, uid, and role
 */
export async function requireUserSession(): Promise<RoomSessionPayload> {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    throw new Error("AUTH_REQUIRED")
  }

  const session = await verifyRoomSessionToken(sessionToken)

  if (!session || session.role !== "user") {
    throw new Error("AUTH_REQUIRED")
  }

  return session
}

/**
 * Require a valid admin session (control panel admin).
 * Reads the admin session cookie, verifies the token, and ensures role is "admin".
 *
 * @throws Error with message "AUTH_REQUIRED" if no session or invalid session
 * @returns The verified session payload with email, uid, and role
 */
export async function requireAdminSession(): Promise<RoomSessionPayload> {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    throw new Error("AUTH_REQUIRED")
  }

  const session = await verifyRoomSessionToken(sessionToken)

  if (!session || session.role !== "admin") {
    throw new Error("AUTH_REQUIRED")
  }

  return session
}
