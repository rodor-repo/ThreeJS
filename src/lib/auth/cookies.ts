import type { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE_NAME,
  BRIDGE_NONCE_COOKIE_NAME,
  USER_SESSION_COOKIE_NAME,
} from "./constants"

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
})

export function setUserSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
) {
  setSessionCookie(response, USER_SESSION_COOKIE_NAME, token, maxAgeSeconds)
}

export function clearUserSessionCookie(response: NextResponse) {
  clearSessionCookie(response, USER_SESSION_COOKIE_NAME)
}

export function setAdminSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
) {
  setSessionCookie(response, ADMIN_SESSION_COOKIE_NAME, token, maxAgeSeconds)
}

export function clearAdminSessionCookie(response: NextResponse) {
  clearSessionCookie(response, ADMIN_SESSION_COOKIE_NAME)
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

function setSessionCookie(
  response: NextResponse,
  cookieName: string,
  token: string,
  maxAgeSeconds: number
) {
  response.cookies.set(cookieName, token, {
    ...baseCookieOptions(),
    maxAge: maxAgeSeconds,
  })
}

function clearSessionCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  })
}
