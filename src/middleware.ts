import { NextResponse, type NextRequest } from "next/server"
import { BRIDGE_CALLBACK_PATH, SESSION_COOKIE_NAME } from "@/lib/auth/constants"
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
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionToken) {
    const session = await verifyRoomSessionToken(sessionToken)
    if (session) {
      if (provider === "controlpanel" && session.role !== "admin") {
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
