"use server"

// Types matching the Add to Cart API documentation

export type MaterialSelection = {
  // priceRangeId?: string
  colorId: string
  finishId?: string
}

export type ProductConfig = {
  productId: string
  dimensions: Record<string, number | string>
  materials: Record<string, MaterialSelection>
  hardwares?: Record<string, string>
  doorExcluded?: boolean
  quantity?: number
}

export type AddToCartRequest = {
  userEmail: string
  projectName: string
  items: ProductConfig[]
  projectId?: string
}

export type ItemError = {
  index: number
  productId: string
  error: string
}

export type ProjectTotals = {
  price: number
  totalPrice: number
  GST: number
  surcharge: number
}

export type AddToCartSuccessResponse = {
  success: true
  projectId: string
  cartItemIds: string[]
  projectTotals: ProjectTotals
  itemsAdded: number
  itemErrors?: ItemError[]
}

export type AddToCartErrorResponse = {
  success: false
  error: string
  itemErrors?: ItemError[]
}

export type AddToCartResponse =
  | AddToCartSuccessResponse
  | AddToCartErrorResponse

/**
 * Calls the webshop add-to-cart endpoint to add configured products to a user's cart.
 * Uses the same authentication and base URL as calculateWsProductPrice.
 *
 * @param items - Array of product configurations to add to cart
 * @param projectName - Name for the shopping cart project (optional, defaults to timestamp-based name)
 * @param userEmail - Email of the user (optional, defaults to it@cabinetworx.com.au)
 * @param projectId - Existing project ID for updating (optional, creates new project if not provided)
 */
export async function addToCart(
  items: ProductConfig[],
  projectName?: string,
  userEmail?: string,
  projectId?: string
): Promise<AddToCartResponse> {
  if (!items || items.length === 0) {
    return {
      success: false,
      error: "No items provided to add to cart",
    }
  }

  console.log(JSON.stringify(items, null, 2))

  // Validate all items have productId
  const invalidItems = items.filter((item) => !item.productId)
  if (invalidItems.length > 0) {
    return {
      success: false,
      error: "Some items are missing productId",
      itemErrors: invalidItems.map((_, idx) => ({
        index: idx,
        productId: "",
        error: "Missing productId",
      })),
    }
  }

  if (
    !process.env.WEBSHOP_URL ||
    !process.env.WEBSHOP_SECRET_KEY ||
    !process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ) {
    return {
      success: false,
      error: "Missing required environment variables for webshop integration",
    }
  }

  // Build the endpoint URL
  const url =
    process.env.WEBSHOP_ADD_TO_CART_URL ||
    `${process.env.WEBSHOP_URL}/api/3D/three-js/add-to-cart`

  // Use provided email or fallback to hardcoded one
  const finalUserEmail = userEmail || "it@cabinetworx.com.au"

  // Generate project name if not provided
  const finalProjectName =
    projectName ||
    `3D Design - ${new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`

  // Normalize dimension values: "yes"/"no" -> 1/0
  const normalizedItems = items.map((item) => ({
    ...item,
    dimensions: Object.fromEntries(
      Object.entries(item.dimensions).map(([key, value]) => {
        if (typeof value === "string") {
          const lowerValue = value.toLowerCase()
          if (lowerValue === "yes") return [key, 1]
          if (lowerValue === "no") return [key, 0]
        }
        return [key, value]
      })
    ),
  }))

  const requestBody: AddToCartRequest = {
    userEmail: finalUserEmail,
    projectName: finalProjectName,
    items: normalizedItems,
    ...(projectId && { projectId }),
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WEBSHOP_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-vercel-protection-bypass":
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    })
  } catch (err: unknown) {
    const e = err as Error
    return {
      success: false,
      error: `Network error calling add-to-cart API: ${
        e?.message || "unknown error"
      }`,
    }
  }

  // Parse the response
  let data: AddToCartResponse
  try {
    data = await response.json()
    console.log(JSON.stringify(data, null, 2))
  } catch {
    // If JSON parsing fails, try to get text for error message
    let text: string | undefined
    try {
      text = await response.text()
    } catch {}

    return {
      success: false,
      error: `Invalid response from add-to-cart API: ${response.status} ${
        response.statusText
      }${text ? ` - ${text}` : ""}`,
    }
  }

  // If response is not OK but we got JSON, return it (it should be an error response)
  if (!response.ok && !data.success) {
    return data
  }

  // If response is OK but success is false (shouldn't happen but handle it)
  if (!data.success) {
    return data
  }

  return data
}
