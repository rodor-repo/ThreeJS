import { NextResponse, type NextRequest } from "next/server"
import {
  BRIDGE_NONCE_TTL_SECONDS,
  BRIDGE_START_PATH,
  DEFAULT_BRIDGE_PROVIDER,
  type BridgeProvider,
} from "./constants"
import { setBridgeNonceCookie } from "./cookies"
import { createBridgeStateToken } from "./bridgeState"

export function getRequestReturnTo(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value) return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  return value
}

export function getBridgeProviderFromRequest(
  request: NextRequest
): BridgeProvider {
  const mode = request.nextUrl.searchParams.get("mode")
  return mode === "admin" ? "controlpanel" : DEFAULT_BRIDGE_PROVIDER
}

function getBridgeProviderBaseUrl(provider: BridgeProvider) {
  if (provider === "controlpanel") {
    const baseUrl = process.env.CONTROL_PANEL_URL
    if (!baseUrl) {
      throw new Error("CONTROL_PANEL_URL is required")
    }
    return baseUrl
  }

  const baseUrl = process.env.WEBSHOP_URL
  if (!baseUrl) {
    throw new Error("WEBSHOP_URL is required")
  }
  return baseUrl
}

export function buildBridgeStartUrl(
  provider: BridgeProvider,
  state: string,
  returnTo: string
) {
  const baseUrl = getBridgeProviderBaseUrl(provider)
  const url = new URL(BRIDGE_START_PATH, baseUrl)
  url.searchParams.set("state", state)
  url.searchParams.set("return_to", returnTo)
  return url
}

export async function startBridgeFlow(
  request: NextRequest,
  returnTo: string,
  provider: BridgeProvider
) {
  const shouldLog = process.env.BRIDGE_DEBUG === "true"
  const nonce = globalThis.crypto.randomUUID()
  const state = await createBridgeStateToken({
    nonce,
    return_to: returnTo,
    provider,
  })

  const response = NextResponse.redirect(
    buildBridgeStartUrl(provider, state, returnTo),
    307
  )

  if (shouldLog) {
    console.info("bridge: redirecting to provider start", {
      provider,
      returnTo,
    })
  }

  setBridgeNonceCookie(response, nonce, BRIDGE_NONCE_TTL_SECONDS)
  return response
}
