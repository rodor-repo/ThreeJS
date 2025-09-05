import { NextResponse } from "next/server"
import { getWsProduct } from "@/server/getWsProduct"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("id") || searchParams.get("productId")
    if (!productId)
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    const data = await getWsProduct(productId)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to fetch" },
      { status: 500 }
    )
  }
}
