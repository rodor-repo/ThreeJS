import { CarcassShelf } from "../parts/CarcassShelf"
import { CarcassMaterial } from "../Material"
import {
  calculateShelfPositions,
  calculatePanelWidth,
  calculateEffectiveDepth,
} from "./carcass-dimension-utils"
import {
  SHELF_OFFSET_FROM_EDGE,
  DEFAULT_WARDROBE_DRAWER_HEIGHT,
  DEFAULT_WARDROBE_DRAWER_BUFFER,
} from "../builders/builder-constants"

export interface ShelfCreationParams {
  width: number
  height: number
  depth: number
  shelfCount: number
  shelfSpacing: number
  material: CarcassMaterial
  cabinetType: string
  // Wardrobe-specific
  drawerQuantity?: number
  wardrobeDrawerHeight?: number
  wardrobeDrawerBuffer?: number
}

/**
 * Creates shelves for a cabinet based on configuration
 * Handles both regular cabinets and wardrobes with drawer space considerations
 */
export function createShelves(params: ShelfCreationParams): CarcassShelf[] {
  const {
    width,
    height,
    depth,
    shelfCount,
    shelfSpacing,
    material,
    cabinetType,
    drawerQuantity = 0,
    wardrobeDrawerHeight = DEFAULT_WARDROBE_DRAWER_HEIGHT,
    wardrobeDrawerBuffer = DEFAULT_WARDROBE_DRAWER_BUFFER,
  } = params

  if (shelfCount <= 0) {
    return []
  }

  const thickness = material.getThickness()

  // Calculate start height based on cabinet type
  let startHeight: number
  if (cabinetType === "wardrobe") {
    const totalDrawerHeight = drawerQuantity * wardrobeDrawerHeight
    startHeight = totalDrawerHeight + wardrobeDrawerBuffer + thickness
  } else {
    startHeight = thickness + SHELF_OFFSET_FROM_EDGE
  }

  const endHeight = height - thickness - SHELF_OFFSET_FROM_EDGE

  // Don't create shelves if there's no room
  if (endHeight <= startHeight) {
    return []
  }

  const shelfPositions = calculateShelfPositions(
    startHeight,
    endHeight,
    shelfCount,
    shelfSpacing
  )

  const panelWidth = calculatePanelWidth(width, thickness)
  const effectiveDepth = calculateEffectiveDepth(depth, thickness)

  return shelfPositions.map((shelfHeight) => {
    return new CarcassShelf({
      depth: effectiveDepth,
      width: panelWidth,
      thickness: thickness,
      height: shelfHeight,
      leftEndThickness: thickness,
      backThickness: thickness,
      material: material.getMaterial(),
    })
  })
}
