"use server"

import { createSwrCache } from "@/server/swrCache"
import type { GDThreeJsType, WsProduct } from "@/types/erpTypes"

export type ProductDataResponse = {
  product: WsProduct
  materialOptions: MaterialOptionsResponse
  defaultMaterialSelections: DefaultMaterialSelections
  threeJsGDs: Record<GDThreeJsType, string[]>
}

const productDataCache = createSwrCache<ProductDataResponse>({
  maxEntries: 200,
  ttlMs: 5 * 60 * 1000,
})

export async function getProductData(productId: string) {
  if (!productId) throw new Error("productId is required")

  // Safety check: Don't fetch data for appliances (fake cabinets)
  if (productId.startsWith("appliance-")) {
    throw new Error("Fetching data for appliances is not allowed")
    // return null  // Return null (or partial mock if strictly needed) to avoid 500 error
  }

  if (
    !process.env.WEBSHOP_URL ||
    !process.env.WEBSHOP_SECRET_KEY ||
    !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ) {
    throw new Error("Missing required environment variables")
  }

  return productDataCache.get(productId, async () => {
    const response = await fetch(
      `${
        process.env.WEBSHOP_URL
      }/api/3D/three-js/wsProduct/${encodeURIComponent(productId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY!}`,
          "Content-Type": "application/json",
          // Header alone won't prevent Next from caching; see fetch options below
          "Cache-Control": "no-cache",
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
        },
        // Force fresh data on every call
        cache: "no-store",
        // next: { revalidate: 0 },
      }
    )

    if (!response.ok) {
      throw new Error(
        `Failed to fetch product ${productId}: ${response.status} ${response.statusText}`
      )
    }

    const data: ProductDataResponse = await response.json()
    return data
  })
}

export type MaterialOptionsResponse = {
  [materialId: string]: {
    material: string
    priceRanges: {
      [priceRangeId: string]: {
        priceRange: string
        colorOptions: {
          [colorId: string]: {
            color: string
            imageUrl: string
            finishes: {
              [finishId: string]: {
                finish: string
              }
            }
          }
        }
      }
    }
  }
}

export type DefaultMaterialSelections = {
  [materialId: string]: {
    colorId: string | null
    finishId: string | null
  }
}
