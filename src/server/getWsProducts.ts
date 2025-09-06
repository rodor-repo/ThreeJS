"use server"

import type { WsProducts } from "@/types/erpTypes"

export async function getWsProducts() {
  if (
    !process.env.WEBSHOP_URL ||
    !process.env.WEBSHOP_SECRET_KEY ||
    !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ) {
    throw new Error("Missing required environment variables")
  }

  const response = await fetch(
    `${process.env.WEBSHOP_URL}/api/3D/three-js/wsProducts`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
        "Content-Type": "application/json",
        // Request header is not enough to bypass Next.js caching; see options below
        "Cache-Control": "no-cache",
        "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      },
      // Always fetch fresh data on the server
      // next: { revalidate: 0 } also disables ISR caching for this request
      cache: "no-store",
      // next: { revalidate: 0 },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`)
  }

  const WsProducts: WsProducts = await response.json()

  return WsProducts
}
