/**
 * Cart Utilities
 *
 * Functions for collecting product configurations from the scene
 * for the Add to Cart API.
 */

import type { CabinetData } from "@/features/scene/types"
import { cabinetPanelState } from "@/features/cabinets/ui/ProductPanel"
import type { ProductConfig } from "@/server/addToCart"

/**
 * Result of collecting cart items from the scene
 */
export interface CollectCartItemsResult {
  items: ProductConfig[]
  skipped: {
    cabinetId: string
    reason: string
  }[]
}

/**
 * Collects product configurations from all cabinets in the scene
 * that are ready to be added to cart.
 *
 * Requirements for a cabinet to be included:
 * - Must have a productId (webshop product association)
 * - Must have persisted panel state (dimensions and materials)
 *
 * @param cabinets - Array of all cabinets in the scene
 * @returns Object containing valid items and skipped cabinets with reasons
 */
export function collectCartItems(
  cabinets: CabinetData[]
): CollectCartItemsResult {
  const items: ProductConfig[] = []
  const skipped: { cabinetId: string; reason: string }[] = []

  for (const cabinet of cabinets) {
    // Skip cabinets without productId (not associated with a webshop product)
    if (!cabinet.productId) {
      skipped.push({
        cabinetId: cabinet.cabinetId,
        reason: "No webshop product associated",
      })
      continue
    }

    // // Skip certain cabinet types that shouldn't be added directly
    // // (they may be accessories or sub-items)
    // if (
    //   cabinet.cabinetType === "kicker" ||
    //   cabinet.cabinetType === "bulkhead" ||
    //   cabinet.cabinetType === "underPanel"
    // ) {
    //   // These are often child items of other cabinets
    //   // Check if they have their own productId - if so, include them
    //   if (!cabinet.productId) {
    //     skipped.push({
    //       cabinetId: cabinet.cabinetId,
    //       reason: `${cabinet.cabinetType} without product association`,
    //     })
    //     continue
    //   }
    // }

    // Get persisted panel state for this cabinet
    const panelState = cabinetPanelState.get(cabinet.cabinetId)

    if (!panelState) {
      skipped.push({
        cabinetId: cabinet.cabinetId,
        reason: "No panel state (cabinet not configured)",
      })
      continue
    }

    // Get dimensions from panel state values
    const dimensions: Record<string, number | string> = {}
    if (panelState.values) {
      for (const [dimId, value] of Object.entries(panelState.values)) {
        dimensions[dimId] = value
      }
    }

    // Get materials from panel state
    const materials: Record<
      string,
      { colorId: string; finishId?: string; priceRangeId?: string }
    > = {}
    if (panelState.materialSelections) {
      for (const [materialId, selection] of Object.entries(
        panelState.materialSelections
      )) {
        materials[materialId] = {
          colorId: selection.colorId,
          finishId: selection.finishId,
          priceRangeId: selection.priceRangeId,
        }
      }
    }

    // Build the product config
    const productConfig: ProductConfig = {
      productId: cabinet.productId,
      dimensions,
      materials,
      quantity: 1,
    }

    items.push(productConfig)
  }

  return { items, skipped }
}

/**
 * Formats a user-friendly summary of items being added to cart
 *
 * @param result - Result from collectCartItems
 * @returns Summary string
 */
export function formatCartSummary(result: CollectCartItemsResult): string {
  const lines: string[] = []

  lines.push(`Adding ${result.items.length} item(s) to cart`)

  if (result.skipped.length > 0) {
    lines.push(`(${result.skipped.length} item(s) skipped - not configured)`)
  }

  return lines.join("\n")
}
