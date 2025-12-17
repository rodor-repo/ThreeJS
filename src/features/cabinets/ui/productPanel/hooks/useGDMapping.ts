import { useMemo } from "react"
import type { GDThreeJsType } from "@/types/erpTypes"

/**
 * GD ID mapping for dimension types
 */
export interface GDMapping {
  widthGDIds: string[]
  heightGDIds: string[]
  depthGDIds: string[]
  doorOverhangGDIds: string[]
  shelfQtyGDIds: string[]
  drawerQtyGDIds: string[]
  doorQtyGDIds: string[]
  drawerHeightGDMap: Record<number, string[]>
}

/**
 * Creates a GD mapping object from raw threeJsGDs data
 */
export function getGDMapping(
  threeJsGDs: Record<GDThreeJsType, string[]> | undefined
): GDMapping {
  return {
    widthGDIds: threeJsGDs?.width || [],
    heightGDIds: threeJsGDs?.height || [],
    depthGDIds: threeJsGDs?.depth || [],
    doorOverhangGDIds: threeJsGDs?.doorOverhang || [],
    shelfQtyGDIds: threeJsGDs?.shelfQty || [],
    drawerQtyGDIds: threeJsGDs?.drawerQty || [],
    doorQtyGDIds: threeJsGDs?.doorQty || [],
    drawerHeightGDMap: {
      0: threeJsGDs?.drawerH1 || [],
      1: threeJsGDs?.drawerH2 || [],
      2: threeJsGDs?.drawerH3 || [],
      3: threeJsGDs?.drawerH4 || [],
      4: threeJsGDs?.drawerH5 || [],
    },
  }
}

/**
 * Hook to derive GD ID lists from threeJsGDs configuration
 * Memoized to prevent unnecessary recalculations
 */
export function useGDMapping(
  threeJsGDs: Record<GDThreeJsType, string[]> | undefined
): GDMapping {
  return useMemo(
    () => getGDMapping(threeJsGDs),
    [threeJsGDs]
  )
}

/**
 * Check if a GD ID matches a specific dimension type
 */
export function isWidthGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.widthGDIds.includes(gdId)
}

export function isHeightGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.heightGDIds.includes(gdId)
}

export function isDepthGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.depthGDIds.includes(gdId)
}

export function isDoorOverhangGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.doorOverhangGDIds.includes(gdId)
}

export function isShelfQtyGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.shelfQtyGDIds.includes(gdId)
}

export function isDrawerQtyGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.drawerQtyGDIds.includes(gdId)
}

export function isDoorQtyGD(
  gdId: string | undefined,
  mapping: GDMapping
): boolean {
  return !!gdId && mapping.doorQtyGDIds.includes(gdId)
}

/**
 * Find which drawer index a GD ID belongs to (if any)
 * Returns null if not a drawer height GD
 */
export function getDrawerHeightIndex(
  gdId: string | undefined,
  mapping: GDMapping
): number | null {
  if (!gdId) return null

  for (const [indexStr, gdList] of Object.entries(mapping.drawerHeightGDMap)) {
    if (gdList.includes(gdId)) {
      return Number(indexStr)
    }
  }
  return null
}

/**
 * Get all dimension badges for a given GD ID
 */
export function getDimensionBadges(
  gdId: string | undefined,
  mapping: GDMapping
): string[] {
  const badges: string[] = []
  if (!gdId) return badges

  if (isWidthGD(gdId, mapping)) badges.push("Width")
  if (isHeightGD(gdId, mapping)) badges.push("Height")
  if (isDepthGD(gdId, mapping)) badges.push("Depth")
  if (isDoorOverhangGD(gdId, mapping)) badges.push("Door Overhang")
  if (isShelfQtyGD(gdId, mapping)) badges.push("Shelf Qty")
  if (isDrawerQtyGD(gdId, mapping)) badges.push("Drawer Qty")
  if (isDoorQtyGD(gdId, mapping)) badges.push("Door Qty")

  const drawerIndex = getDrawerHeightIndex(gdId, mapping)
  if (drawerIndex !== null) {
    badges.push(`Drawer H${drawerIndex + 1}`)
  }

  return badges
}
