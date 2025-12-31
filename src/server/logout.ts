"use server"

import { cookies } from "next/headers"
import {
  ADMIN_SESSION_COOKIE_NAME,
  BRIDGE_NONCE_COOKIE_NAME,
  USER_SESSION_COOKIE_NAME,
} from "@/lib/auth/constants"

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
})

export async function clearAuthSessionCookies(): Promise<{ success: true }> {
  const cookieStore = cookies()

  const clearCookie = (cookieName: string) => {
    try {
      cookieStore.delete(cookieName)
    } catch {
      // ignore: some Next versions only support clearing via set
    }

    cookieStore.set(cookieName, "", {
      ...baseCookieOptions(),
      maxAge: 0,
    })
  }

  clearCookie(USER_SESSION_COOKIE_NAME)
  clearCookie(ADMIN_SESSION_COOKIE_NAME)
  clearCookie(BRIDGE_NONCE_COOKIE_NAME)

  return { success: true }
}
