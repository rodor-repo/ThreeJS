import _ from "lodash"
import type { WsProduct } from "@/types/erpTypes"
import type { CarcassDimensions } from "@/features/carcass"
import type { GDMapping } from "../hooks/useGDMapping"
import { SelectedCabinetSnapshot } from "../../productPanel.types"

/**
 * Convert a value to number, handling both number and string inputs
 */
export const toNum = (v: number | string | undefined): number =>
  typeof v === "number" ? v : Number(v)

/**
 * Single dimension entry from WsProduct.dims
 */
export type DimEntry = [string, WsProduct["dims"][string]]

/**
 * Build a sorted list of dimension entries from WsProduct.dims
 */
export function buildDimsList(dims: WsProduct["dims"] | undefined): DimEntry[] {
  if (!dims) return []
  const entries = Object.entries(dims)
  return _.sortBy(entries, ([, dimObj]) => Number(dimObj.sortNum))
}

/**
 * Clamp a value to min/max bounds
 */
export function clampValue(value: number, min?: number, max?: number): number {
  let result = value
  if (typeof min === "number") result = Math.max(min, result)
  if (typeof max === "number") result = Math.min(max, result)
  return result
}

/**
 * Calculate the default value for a dimension, clamped to bounds
 */
export function getDefaultDimValue(
  dimObj: WsProduct["dims"][string]
): number | string {
  if (dimObj.valueType === "range") {
    let defVal = Number(dimObj.defaultValue ?? dimObj.min ?? 0)
    if (isNaN(defVal)) defVal = 0
    return clampValue(defVal, dimObj.min, dimObj.max)
  }
  return String(dimObj.defaultValue ?? dimObj.options?.[0] ?? "")
}

/**
 * Validation result for drawer height changes
 */
export interface DrawerHeightValidation {
  valid: boolean
  error?: string
}

/**
 * Validate a drawer height change against the last drawer's constraints
 * Returns validation result with error message if invalid
 */
export function validateDrawerHeightChange(
  currentValues: Record<string, number | string>,
  dimId: string,
  newValue: number,
  drawerHeightGDMap: Record<number, string[]>,
  dimsList: DimEntry[],
  drawerQty: number
): DrawerHeightValidation {
  // Find which drawer index this dimension belongs to
  let drawerHeightIndex: number | null = null
  const dimObj = dimsList.find(([id]) => id === dimId)?.[1]

  if (dimObj?.GDId) {
    for (const [idxStr, list] of Object.entries(drawerHeightGDMap)) {
      if (list.includes(dimObj.GDId)) {
        drawerHeightIndex = Number(idxStr)
        break
      }
    }
  }

  // If not a drawer height or is the dependent (last) drawer, skip validation
  if (drawerHeightIndex === null) return { valid: true }

  const lastDrawerIdx = drawerQty - 1
  const isDependentDrawer = drawerHeightIndex === lastDrawerIdx
  if (isDependentDrawer) return { valid: true }

  // Find the last drawer's dimension entry
  const lastDrawerDimEntry = dimsList.find(
    ([_, d]) => d.GDId && drawerHeightGDMap[lastDrawerIdx]?.includes(d.GDId)
  )

  if (!lastDrawerDimEntry) return { valid: true }

  const [lastId, lastDimObj] = lastDrawerDimEntry
  const lastCurrentVal = toNum(
    currentValues[lastId] ?? lastDimObj.defaultValue ?? lastDimObj.min
  )
  const currentVal = toNum(
    currentValues[dimId] ?? dimObj?.defaultValue ?? dimObj?.min
  )
  const delta = newValue - currentVal
  const projectedLastVal = lastCurrentVal - delta

  const lastMin = typeof lastDimObj.min === "number" ? lastDimObj.min : 50
  const lastMax = typeof lastDimObj.max === "number" ? lastDimObj.max : 2000

  if (projectedLastVal < lastMin) {
    return {
      valid: false,
      error: `Cannot increase height: Last drawer would be too small (min ${lastMin}mm).`,
    }
  }

  if (projectedLastVal > lastMax) {
    return {
      valid: false,
      error: `Cannot decrease height: Last drawer would be too large (max ${lastMax}mm).`,
    }
  }

  return { valid: true }
}

/**
 * Result of extracting primary dimensions from values
 */
export interface ExtractedDimensions {
  width: number
  height: number
  depth: number
  overhangDoor: boolean
  shelfCount: number | undefined
  drawerQty: number | undefined
  doorQty: number | undefined
  pendingDrawerHeights: Record<number, number>
}

/**
 * Pure utility to extract dimensions from a values object based on GD mapping
 * Can be used by both ProductPanel and CabinetFactory
 */
export function getExtractedDimensions(
  vals: Record<string, number | string>,
  dimsList: DimEntry[],
  gdMapping: GDMapping,
  initialDefaults?: Partial<ExtractedDimensions>,
  isModalFillerOrPanel = false,
  changedId?: string
): ExtractedDimensions {
  let width = initialDefaults?.width ?? 0
  let height = initialDefaults?.height ?? 0
  let depth = initialDefaults?.depth ?? 0
  let overhangDoor = initialDefaults?.overhangDoor ?? false
  let shelfCount = initialDefaults?.shelfCount
  let drawerQty = initialDefaults?.drawerQty
  let doorQty = initialDefaults?.doorQty
  
  const pendingDrawerHeights: Record<number, number> = {}

  dimsList.forEach(([id, dimObj]) => {
    if (!dimObj.GDId) return
    const v = vals[id]
    const gdId = dimObj.GDId

    if (gdMapping.widthGDIds.includes(gdId)) {
      width = toNum(v) || width
    }

    // Skip height and depth updates for modal fillers/panels
    if (!isModalFillerOrPanel) {
      if (gdMapping.heightGDIds.includes(gdId)) {
        height = toNum(v) || height
      }
      if (gdMapping.depthGDIds.includes(gdId)) {
        depth = toNum(v) || depth
      }
    }

    if (gdMapping.doorOverhangGDIds.includes(gdId)) {
      overhangDoor =
        v.toString().toLowerCase() === "yes" || v === 1 || v === "1"
    }

    if (gdMapping.shelfQtyGDIds.includes(gdId)) {
      shelfCount = toNum(v) || shelfCount
    }

    if (gdMapping.drawerQtyGDIds.includes(gdId)) {
      drawerQty = toNum(v) || drawerQty
    }

    if (gdMapping.doorQtyGDIds.includes(gdId)) {
      doorQty = toNum(v) || doorQty
    }

    // Drawer heights
    Object.entries(gdMapping.drawerHeightGDMap).forEach(
      ([drawerIndexStr, gdList]) => {
        const drawerIndex = Number(drawerIndexStr)
        if (gdList.includes(gdId)) {
          const numVal = toNum(v)
          if (!isNaN(numVal)) {
            if (!changedId) {
              // Initial setup - apply to all
              pendingDrawerHeights[drawerIndex] = numVal
            } else if (id === changedId) {
              // User change - only apply if this is the changed one
              pendingDrawerHeights[drawerIndex] = numVal
            }
          }
        }
      }
    )
  })

  return {
    width,
    height,
    depth,
    overhangDoor,
    shelfCount,
    drawerQty,
    doorQty,
    pendingDrawerHeights,
  }
}

/**
 * Extract primary dimension values from the values object using GD mappings
 */
export function extractPrimaryDimensions(
  vals: Record<string, number | string>,
  dimsList: DimEntry[],
  gdMapping: GDMapping,
  selectedCabinet: SelectedCabinetSnapshot,
  isModalFillerOrPanel: boolean,
  changedId?: string
): ExtractedDimensions {
  return getExtractedDimensions(
    vals,
    dimsList,
    gdMapping,
    {
      width: selectedCabinet.dimensions.width,
      height: selectedCabinet.dimensions.height,
      depth: selectedCabinet.dimensions.depth,
      overhangDoor: selectedCabinet.overhangDoor,
      shelfCount: selectedCabinet.carcass?.config?.shelfCount,
      drawerQty: selectedCabinet.carcass?.config?.drawerQuantity,
      doorQty: selectedCabinet.carcass?.config?.doorCount,
    },
    isModalFillerOrPanel,
    changedId
  )
}

/**
 * Callbacks for applying dimensions to 3D
 */
export interface ApplyDimensionsCallbacks {
  onDimensionsChange?: (dimensions: CarcassDimensions) => void
  onOverhangDoorToggle?: (overhang: boolean) => void
  onShelfCountChange?: (count: number) => void
  onDrawerQuantityChange?: (qty: number) => void
  onDoorCountChange?: (count: number) => void
  onDrawerHeightChange?: (
    index: number,
    height: number,
    changedId?: string
  ) => void
}

/**
 * Apply extracted dimensions to 3D scene via callbacks
 */
export function applyDimensionsTo3D(
  extracted: ExtractedDimensions,
  callbacks: ApplyDimensionsCallbacks,
  changedId?: string
): void {
  const {
    width,
    height,
    depth,
    overhangDoor,
    shelfCount,
    drawerQty,
    doorQty,
    pendingDrawerHeights,
  } = extracted

  callbacks.onDimensionsChange?.({ width, height, depth })
  callbacks.onOverhangDoorToggle?.(overhangDoor)
  callbacks.onShelfCountChange?.(shelfCount ?? 0)

  // Apply drawer quantity before heights so drawers exist
  if (
    drawerQty !== undefined &&
    callbacks.onDrawerQuantityChange &&
    drawerQty > 0
  ) {
    callbacks.onDrawerQuantityChange(drawerQty)
  }

  // Apply door count if defined
  if (doorQty !== undefined && callbacks.onDoorCountChange && doorQty > 0) {
    callbacks.onDoorCountChange(doorQty)
  }

  // Apply drawer heights only if enabled and callback present
  if (drawerQty && callbacks.onDrawerHeightChange) {
    Object.entries(pendingDrawerHeights).forEach(([idxStr, h]) => {
      const idx = Number(idxStr)
      if (idx < drawerQty!) {
        callbacks.onDrawerHeightChange!(idx, h, changedId)
      }
    })
  }
}

/**
 * Combined function to extract and apply dimensions to 3D
 * This is a convenience wrapper around extractPrimaryDimensions + applyDimensionsTo3D
 */
export function applyPrimaryDimsTo3D(
  vals: Record<string, number | string>,
  dimsList: DimEntry[],
  gdMapping: GDMapping,
  selectedCabinet: SelectedCabinetSnapshot,
  callbacks: ApplyDimensionsCallbacks,
  isModalFillerOrPanel: boolean,
  changedId?: string
): void {
  const extracted = extractPrimaryDimensions(
    vals,
    dimsList,
    gdMapping,
    selectedCabinet,
    isModalFillerOrPanel,
    changedId
  )
  applyDimensionsTo3D(extracted, callbacks, changedId)
}

/**
 * Build default values from WsProduct dims
 */
export function buildDefaultValues(
  dims: WsProduct["dims"] | undefined
): Record<string, number | string> {
  if (!dims) return {}
  const defaults: Record<string, number | string> = {}
  Object.entries(dims).forEach(([id, dimObj]) => {
    defaults[id] = dimObj.defaultValue
  })
  return defaults
}

/**
 * Sync width/height/depth from actual cabinet dimensions to values object
 */
export function syncCabinetDimensionsToValues(
  currentValues: Record<string, number | string>,
  dims: WsProduct["dims"],
  gdMapping: GDMapping,
  cabinetDimensions: CarcassDimensions
): Record<string, number | string> {
  const nextValues = { ...currentValues }

  for (const [dimId, dimObj] of Object.entries(dims)) {
    if (dimObj.GDId) {
      if (gdMapping.widthGDIds.includes(dimObj.GDId)) {
        nextValues[dimId] = cabinetDimensions.width
      } else if (gdMapping.heightGDIds.includes(dimObj.GDId)) {
        nextValues[dimId] = cabinetDimensions.height
      } else if (gdMapping.depthGDIds.includes(dimObj.GDId)) {
        nextValues[dimId] = cabinetDimensions.depth
      }
    }
  }

  return nextValues
}

/**
 * Find the dimension ID for a specific GD type (e.g., width)
 */
export function findDimIdByGDType(
  dims: WsProduct["dims"],
  gdIds: string[]
): string | null {
  for (const [dimId, dimObj] of Object.entries(dims)) {
    if (dimObj.GDId && gdIds.includes(dimObj.GDId)) {
      return dimId
    }
  }
  return null
}
