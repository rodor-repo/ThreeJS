import { NextResponse, type NextRequest } from "next/server"
import {
  BRIDGE_EXCHANGE_PATH,
  BRIDGE_NONCE_COOKIE_NAME,
  DEFAULT_BRIDGE_PROVIDER,
  type BridgeProvider,
} from "@/lib/auth/constants"
import {
  clearBridgeNonceCookie,
  setRoomSessionCookie,
} from "@/lib/auth/cookies"
import { sanitizeReturnTo, startBridgeFlow } from "@/lib/auth/bridge"
import { hashBridgeState, verifyBridgeStateToken } from "@/lib/auth/bridgeState"
import {
  createRoomSessionToken,
  getSessionTtlSeconds,
} from "@/lib/auth/session"

type ExchangeSuccessResponse = {
  uid: string
  email: string
  success?: boolean
}

type ExchangeErrorResponse = {
  success: false
  error?: string
}

type BridgeProviderConfig = {
  provider: BridgeProvider
  baseUrl: string
  secret: string
  role: "user" | "admin"
}

function getBridgeProviderConfig(
  provider: BridgeProvider
): BridgeProviderConfig {
  if (provider === "controlpanel") {
    if (!process.env.CONTROL_PANEL_URL || !process.env.WEBSHOP_SECRET_KEY) {
      throw new Error("Missing control panel environment variables")
    }

    return {
      provider,
      baseUrl: process.env.CONTROL_PANEL_URL,
      secret: process.env.WEBSHOP_SECRET_KEY,
      role: "admin",
    }
  }

  if (!process.env.WEBSHOP_URL || !process.env.WEBSHOP_SECRET_KEY) {
    throw new Error("Missing webshop environment variables")
  }

  return {
    provider,
    baseUrl: process.env.WEBSHOP_URL,
    secret: process.env.WEBSHOP_SECRET_KEY,
    role: "user",
  }
}

export async function GET(request: NextRequest) {
  const shouldLog = process.env.BRIDGE_DEBUG === "true"
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  if (shouldLog) {
    console.info("bridge: callback received")
  }

  if (!code || !state) {
    return startBridgeFlow(request, "/", DEFAULT_BRIDGE_PROVIDER)
  }

  const statePayload = await verifyBridgeStateToken(state)
  if (!statePayload) {
    return startBridgeFlow(request, "/", DEFAULT_BRIDGE_PROVIDER)
  }

  if (shouldLog) {
    console.info("bridge: state verified")
  }

  const nonceCookie = request.cookies.get(BRIDGE_NONCE_COOKIE_NAME)?.value
  if (!nonceCookie || nonceCookie !== statePayload.nonce) {
    return startBridgeFlow(
      request,
      sanitizeReturnTo(statePayload.return_to),
      statePayload.provider
    )
  }

  if (shouldLog) {
    console.info("bridge: nonce verified")
  }

  const providerConfig = getBridgeProviderConfig(statePayload.provider)

  const exchangeUrl = new URL(BRIDGE_EXCHANGE_PATH, providerConfig.baseUrl)
  let exchangeResponse: Response

  try {
    exchangeResponse = await fetch(exchangeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        state_hash: await hashBridgeState(state),
      }),
      cache: "no-store",
    })
  } catch {
    return startBridgeFlow(
      request,
      sanitizeReturnTo(statePayload.return_to),
      statePayload.provider
    )
  }

  let exchangeData: ExchangeSuccessResponse | ExchangeErrorResponse
  try {
    exchangeData = await exchangeResponse.json()
  } catch {
    return startBridgeFlow(
      request,
      sanitizeReturnTo(statePayload.return_to),
      statePayload.provider
    )
  }

  if (!exchangeResponse.ok || exchangeData.success === false) {
    return startBridgeFlow(
      request,
      sanitizeReturnTo(statePayload.return_to),
      statePayload.provider
    )
  }

  if (
    typeof exchangeData.uid !== "string" ||
    typeof exchangeData.email !== "string"
  ) {
    return startBridgeFlow(
      request,
      sanitizeReturnTo(statePayload.return_to),
      statePayload.provider
    )
  }

  if (shouldLog) {
    console.info("bridge: exchange succeeded", {
      provider: providerConfig.provider,
    })
  }

  const sessionToken = await createRoomSessionToken({
    uid: exchangeData.uid,
    email: exchangeData.email,
    role: providerConfig.role,
  })

  const returnTo = sanitizeReturnTo(statePayload.return_to)
  const response = NextResponse.redirect(
    new URL(returnTo, request.nextUrl.origin),
    307
  )

  setRoomSessionCookie(response, sessionToken, getSessionTtlSeconds())
  clearBridgeNonceCookie(response)

  if (shouldLog) {
    console.info("bridge: session set, redirecting", {
      provider: providerConfig.provider,
      returnTo,
    })
  }

  return response
}
