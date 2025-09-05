"use server"

import type { WsProducts } from "@/types/erpTypes"

export async function getWsProducts() {
  const response = await fetch(
    `${process.env.WEBSHOP_URL}/api/3D/three-js/wsProducts`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`)
  }

  const WsProducts: WsProducts = await response.json()

  return WsProducts
}
