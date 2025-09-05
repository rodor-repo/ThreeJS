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
      },
      // revalidate on demand if needed; keep same behavior as sibling util
      // next: { revalidate: 0 }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch product ${productId}: ${response.status} ${response.statusText}`
    )
  }

  const wsProduct: WsProduct = await response.json()
  return wsProduct
}
