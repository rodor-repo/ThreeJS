import { NextResponse, type NextRequest } from "next/server"
import {
  BRIDGE_CALLBACK_PATH,
  getSessionCookieNameForProvider,
} from "@/lib/auth/constants"
import {
  getBridgeProviderFromRequest,
  getRequestReturnTo,
  startBridgeFlow,
} from "@/lib/auth/bridge"
import { verifyRoomSessionToken } from "@/lib/auth/session"

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/i

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith(BRIDGE_CALLBACK_PATH) ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const provider = getBridgeProviderFromRequest(request)
  const sessionCookieName = getSessionCookieNameForProvider(provider)
  const sessionToken = request.cookies.get(sessionCookieName)?.value
  if (sessionToken) {
    const session = await verifyRoomSessionToken(sessionToken)
    if (session) {
      const hasExpectedRole =
        provider === "controlpanel"
          ? session.role === "admin"
          : session.role === "user"
      if (!hasExpectedRole) {
        return startBridgeFlow(
          request,
          getRequestReturnTo(request),
          provider
        )
      }
      return NextResponse.next()
    }
  }

  return startBridgeFlow(request, getRequestReturnTo(request), provider)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
