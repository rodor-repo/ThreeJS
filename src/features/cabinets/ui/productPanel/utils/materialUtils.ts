import _ from "lodash"
import type {
  MaterialOptionsResponse,
  DefaultMaterialSelections,
} from "@/server/getProductData"

/**
 * Material selection state for a single material
 */
export interface MaterialSelection {
  priceRangeId: string
  colorId: string
  finishId?: string
}

/**
 * Complete material selections for all materials
 */
export type MaterialSelections = Record<string, MaterialSelection>

/**
 * Get the first price range ID from material options
 */
export function getFirstPriceRangeId(
  materialOptions: MaterialOptionsResponse[string] | undefined
): string | undefined {
  if (!materialOptions?.priceRanges) return undefined
  return Object.keys(materialOptions.priceRanges)[0]
}

/**
 * Get the first color ID from a price range
 */
export function getFirstColorId(
  priceRange: MaterialOptionsResponse[string]["priceRanges"][string] | undefined
): string | undefined {
  if (!priceRange?.colorOptions) return undefined
  return Object.keys(priceRange.colorOptions)[0]
}

/**
 * Get the first finish ID from a color option
 */
export function getFirstFinishId(
  colorOption:
    | MaterialOptionsResponse[string]["priceRanges"][string]["colorOptions"][string]
    | undefined
): string | undefined {
  if (!colorOption?.finishes) return undefined
  return Object.keys(colorOption.finishes)[0]
}

/**
 * Find the price range that contains a specific color ID
 */
export function findPriceRangeByColorId(
  materialOptions: MaterialOptionsResponse[string] | undefined,
  colorId: string
): string | undefined {
  if (!materialOptions?.priceRanges) return undefined

  for (const [prId, pr] of Object.entries(materialOptions.priceRanges)) {
    if (colorId in pr.colorOptions) {
      return prId
    }
  }
  return undefined
}

/**
 * Build API default material selections from the API response
 * This converts DefaultMaterialSelections into MaterialSelections with resolved IDs
 */
export function buildApiDefaults(
  defaultMaterialSelections: DefaultMaterialSelections | undefined,
  materialOptions: MaterialOptionsResponse | undefined
): MaterialSelections {
  const apiDefaults: MaterialSelections = {}

  if (!defaultMaterialSelections || !materialOptions) {
    return apiDefaults
  }

  for (const [materialId, sel] of Object.entries(defaultMaterialSelections)) {
    const mOpts = materialOptions[materialId]
    if (!mOpts) {
      console.warn("[materialUtils] No material options for", materialId)
      continue
    }

    const desiredColorId = sel.colorId || undefined

    // Find priceRange containing the colorId
    let priceRangeId: string | undefined
    if (desiredColorId) {
      priceRangeId = findPriceRangeByColorId(mOpts, desiredColorId)
    }

    // Fallback to first price range if not found
    if (!priceRangeId) {
      priceRangeId = getFirstPriceRangeId(mOpts)
    }

    const pr = priceRangeId ? mOpts.priceRanges[priceRangeId] : undefined

    // Determine colorId
    let colorId = desiredColorId
    if (!colorId && pr) {
      colorId = getFirstColorId(pr)
    }

    // Determine finishId
    let finishId = sel.finishId || undefined
    if (!finishId && colorId && pr) {
      const colorOption = pr.colorOptions[colorId]
      if (colorOption) {
        finishId = getFirstFinishId(colorOption)
      }
    }

    apiDefaults[materialId] = {
      priceRangeId: priceRangeId || "",
      colorId: colorId || "",
      finishId,
    }
  }

  return apiDefaults
}

/**
 * Merge saved material selections with API defaults
 * Saved selections take precedence where present
 */
export function mergeSelections(
  apiDefaults: MaterialSelections,
  saved?: MaterialSelections
): MaterialSelections {
  if (!saved || _.isEmpty(saved)) {
    return { ...apiDefaults }
  }
  return { ...apiDefaults, ...saved }
}

/**
 * Get complete selection for a material, resolving fallbacks
 */
export function getCompleteSelection(
  materialId: string,
  currentSelection: MaterialSelection | undefined,
  materialOptions: MaterialOptionsResponse | undefined,
  defaultPriceRangeIds?: string[]
): MaterialSelection {
  const mOpts = materialOptions?.[materialId]
  const prPairs = mOpts ? Object.entries(mOpts.priceRanges) : []

  // Price range: current → default list → first available
  const priceRangeId =
    currentSelection?.priceRangeId ||
    defaultPriceRangeIds?.[0] ||
    prPairs?.[0]?.[0] ||
    ""

  const priceRange =
    priceRangeId && mOpts ? mOpts.priceRanges[priceRangeId] : undefined

  const colorPairs = priceRange ? Object.entries(priceRange.colorOptions) : []

  // Color: current → first available
  const colorId = currentSelection?.colorId || colorPairs?.[0]?.[0] || ""

  const selectedColor =
    colorId && priceRange ? priceRange.colorOptions[colorId] : undefined

  // Finish: current → first available
  const finishId =
    currentSelection?.finishId ||
    (selectedColor ? Object.keys(selectedColor.finishes)[0] : undefined)

  return { priceRangeId, colorId, finishId }
}

/**
 * Update selection when price range changes
 * Automatically selects first color and finish in new price range
 */
export function updateSelectionForPriceRange(
  newPriceRangeId: string,
  materialOptions: MaterialOptionsResponse[string] | undefined
): MaterialSelection {
  const priceRange = materialOptions?.priceRanges?.[newPriceRangeId]
  const firstColorId = priceRange ? getFirstColorId(priceRange) : undefined
  const firstFinishId =
    firstColorId && priceRange
      ? getFirstFinishId(priceRange.colorOptions[firstColorId])
      : undefined

  return {
    priceRangeId: newPriceRangeId,
    colorId: firstColorId || "",
    finishId: firstFinishId,
  }
}

/**
 * Update selection when color changes
 * Automatically selects first finish for new color
 */
export function updateSelectionForColor(
  newColorId: string,
  currentPriceRangeId: string,
  materialOptions: MaterialOptionsResponse[string] | undefined
): MaterialSelection {
  const priceRange = materialOptions?.priceRanges?.[currentPriceRangeId]
  const colorOption = priceRange?.colorOptions?.[newColorId]
  const firstFinishId = colorOption ? getFirstFinishId(colorOption) : undefined

  return {
    priceRangeId: currentPriceRangeId,
    colorId: newColorId,
    finishId: firstFinishId,
  }
}

/**
 * Get display info for a material selection
 */
export interface MaterialDisplayInfo {
  colorName?: string
  colorImageUrl?: string
  finishName?: string
}

export function getMaterialDisplayInfo(
  selection: MaterialSelection | undefined,
  materialOptions: MaterialOptionsResponse[string] | undefined
): MaterialDisplayInfo {
  if (!selection || !materialOptions) {
    return {}
  }

  const priceRange = materialOptions.priceRanges?.[selection.priceRangeId]
  const colorOption = priceRange?.colorOptions?.[selection.colorId]
  const finish =
    selection.finishId && colorOption
      ? colorOption.finishes?.[selection.finishId]
      : undefined

  return {
    colorName: colorOption?.color,
    colorImageUrl: colorOption?.imageUrl,
    finishName: finish?.finish,
  }
}
