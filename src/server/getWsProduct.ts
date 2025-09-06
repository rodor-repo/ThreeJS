"use server"

import type { WsProduct } from "@/types/erpTypes"

export async function getWsProduct(productId: string) {
  if (!productId) throw new Error("productId is required")

  const response = await fetch(
    `${process.env.WEBSHOP_URL}/api/3D/three-js/wsProduct/${encodeURIComponent(
      productId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
        "Content-Type": "application/json",
        // Header alone won't prevent Next from caching; see fetch options below
        "Cache-Control": "no-cache",
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

  const data: {
    product: WsProduct
    materialOptions: MaterialOptionsResponse
    defaultMaterialSelections: DefaultMaterialSelections
  } = await response.json()
  return data
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
