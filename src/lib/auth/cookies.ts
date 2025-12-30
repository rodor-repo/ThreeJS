import type { NextResponse } from "next/server"
import {
  BRIDGE_NONCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "./constants"

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
})

export function setRoomSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  })
}

export function clearRoomSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  })
}

export function setBridgeNonceCookie(
  response: NextResponse,
  nonce: string,
  maxAgeSeconds: number
) {
  response.cookies.set(BRIDGE_NONCE_COOKIE_NAME, nonce, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  })
}

export function clearBridgeNonceCookie(response: NextResponse) {
  response.cookies.set(BRIDGE_NONCE_COOKIE_NAME, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  })
}
