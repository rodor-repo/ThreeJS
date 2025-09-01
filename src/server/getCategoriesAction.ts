"use server"

import type { WsProducts } from "@/types/erpTypes"

export async function getCategoriesAndSubCategoriesAction() {
  const response = await fetch(
    `${process.env.WEBSHOP_URL}/api/3D/three-js/categories-sub-categories`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`)
  }

  const data: {
    categories: WsProducts["categories"]
    subCategories: WsProducts["subCategories"]
  } = await response.json()

  return data
}
