"use server"

import { createSwrCache, stableStringify } from "@/server/swrCache"

export type MaterialSelection = {
  priceRangeId: string
  colorId: string
  finishId?: string
}

export type CalculatePriceRequest = {
  productId: string
  // Dimension values keyed by the wsProduct dimension id (e.g., "W", "H", custom ids)
  dims: Record<string, number | string>
  // Per-material selection chosen by the user
  materialSelections: Record<string, MaterialSelection>
  // Optional: prefer a specific currency code (e.g., "USD", "GBP") if supported by backend
  currencyCode?: string
}

export type ApiPriceResponse = {
  basePrice: number
  gstAmount: number
  finalPrice: number
  materialPriceMap: Record<string, string>
  errorResult: {
    formulaErrors: any[]
    configurationErrors: any[]
    materialErrors: any[]
    hardwareErrors: any[]
    dimensionLinkWarnings: any[]
    hasErrors: boolean
    hasWarnings: boolean
  }
  isPriceCalculationIncomplete: boolean
}

export type CalculatePriceResponse = {
  price: number
  // Optional detailed structure, depends on backend implementation
  breakdown?: ApiPriceResponse
}

const priceCache = createSwrCache<CalculatePriceResponse>({
  maxEntries: 100,
  ttlMs: 5 * 60 * 1000,
})

/**
 * Calls the webshop pricing endpoint to calculate a price for a configured product.
 * The exact endpoint can be configured via WEBSHOP_CALCULATE_PRICE_URL. If not provided,
 * it falls back to `${WEBSHOP_URL}/api/3D/three-js/calculate-price`.
 */
export async function calculateWsProductPrice(
  payload: CalculatePriceRequest
): Promise<CalculatePriceResponse> {
  if (!payload?.productId) throw new Error("productId is required")

  if (
    !process.env.WEBSHOP_URL ||
    !process.env.WEBSHOP_SECRET_KEY ||
    !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ) {
    throw new Error("Missing required environment variables")
  }

  const url =
    process.env.WEBSHOP_CALCULATE_PRICE_URL ||
    (process.env.WEBSHOP_URL
      ? `${process.env.WEBSHOP_URL}/api/3D/three-js/calculate-price`
      : undefined)
  if (!url)
    throw new Error(
      "No pricing endpoint configured: set WEBSHOP_CALCULATE_PRICE_URL or WEBSHOP_URL"
    )

  const normalizedDims = normalizeDimensions(payload.dims)
  const cacheKey = buildPriceCacheKey(
    payload.productId,
    normalizedDims,
    payload.materialSelections,
    payload.currencyCode
  )

  return priceCache.get(cacheKey, async () => {
    let response: Response
    try {
      const requestBody = {
        productId: payload.productId,
        dimensions: normalizedDims,
        materials: payload.materialSelections,
        currencyCode: payload.currencyCode,
      }

      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY!}`,
          "Content-Type": "application/json",
          // Header alone won't prevent framework caching; see fetch options below
          "Cache-Control": "no-cache",
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
        },
        body: JSON.stringify(requestBody),
        // Always compute price with fresh data; disable any caching layers
        cache: "no-store",
        // next: { revalidate: 0 },
      })
    } catch (err: unknown) {
      const e = err as Error
      throw new Error(
        `Network error calling pricing API: ${e?.message || "unknown error"}`
      )
    }

    if (!response.ok) {
      let text: string | undefined
      try {
        text = await response.text()
      } catch {}

      let json: any
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {}
      }

      const requestId =
        response.headers.get("x-request-id") ||
        response.headers.get("x-correlation-id") ||
        json?.requestId ||
        json?.traceId ||
        json?.correlationId

      const apiErrorMessage =
        json?.message ||
        json?.error ||
        (Array.isArray(json?.errors)
          ? json.errors?.[0]?.message || json.errors?.[0]
          : undefined) ||
        json?.detail ||
        json?.details

      const msg =
        `Failed to calculate price: ${response.status} ${response.statusText}` +
        (requestId ? ` [requestId: ${requestId}]` : "") +
        (apiErrorMessage ? ` - ${apiErrorMessage}` : "")

      throw new Error(msg)
    }

    let data: ApiPriceResponse
    try {
      data = await response.json()
    } catch (e) {
      throw new Error("Invalid pricing response: not JSON")
    }

    if (typeof data?.finalPrice !== "number") {
      throw new Error("Invalid price response")
    }

    return {
      price: data.finalPrice,
      breakdown: data,
    }
  })
}

function normalizeDimensions(dims: Record<string, number | string>) {
  return Object.fromEntries(
    Object.entries(dims).map(([key, value]) => {
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase()
        if (lowerValue === "yes") return [key, 1]
        if (lowerValue === "no") return [key, 0]
      }
      return [key, value]
    })
  )
}

function normalizeMaterialSelectionsForKey(
  selections: Record<string, MaterialSelection>
) {
  return Object.fromEntries(
    Object.entries(selections).map(([materialId, selection]) => [
      materialId,
      {
        priceRangeId: selection.priceRangeId ?? "",
        colorId: selection.colorId ?? "",
        finishId: selection.finishId ?? "",
      },
    ])
  )
}

function buildPriceCacheKey(
  productId: string,
  dims: Record<string, number | string>,
  materialSelections: Record<string, MaterialSelection>,
  currencyCode?: string
) {
  return `price:${stableStringify({
    productId,
    dims,
    materialSelections: normalizeMaterialSelectionsForKey(materialSelections),
    currencyCode: currencyCode ?? null,
  })}`
}
