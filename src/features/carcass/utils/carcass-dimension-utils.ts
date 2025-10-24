import type { CabinetType } from "../CarcassAssembly"

/**
 * Calculates the panel width that fits between two end panels
 * Formula: totalWidth - (2 × thickness)
 */
export function calculatePanelWidth(
  totalWidth: number,
  thickness: number
): number {
  return totalWidth - thickness * 2
}

/**
 * Calculates the effective depth accounting for back panel
 * Formula: totalDepth - backThickness
 */
export function calculateEffectiveDepth(
  totalDepth: number,
  backThickness: number
): number {
  return totalDepth - backThickness
}

/**
 * Calculates the X position for the right end panel
 * The right end is positioned at: width - (thickness / 2) to center the panel
 */
export function calculateRightEndXPosition(
  totalWidth: number,
  thickness: number
): number {
  return totalWidth - thickness / 2
}

/**
 * Calculates panel center position between left end and based on panel width
 * Used for positioning bottom, top, back, and shelf panels
 */
export function calculatePanelCenterX(
  leftEndThickness: number,
  panelWidth: number
): number {
  return leftEndThickness + panelWidth / 2
}

/**
 * Calculates panel center position accounting for back panel
 * Used for positioning bottom and top panels in Z-axis
 */
export function calculatePanelCenterZ(
  backThickness: number,
  panelDepth: number
): number {
  return backThickness + panelDepth / 2
}

/**
 * Calculates the Y position for a cabinet based on its type
 * - Top cabinets: positioned at wall height (2400mm)
 * - Base/Tall cabinets: positioned above floor by leg height
 */
export function calculateCabinetYPosition(
  cabinetType: CabinetType,
  legHeight: number
): number {
  switch (cabinetType) {
    case "top":
      return 2400
    case "base":
    case "tall":
      return legHeight
    default:
      return 0
  }
}

/**
 * Calculates door dimensions with gap applied
 * @param carcassWidth - Total width of the carcass
 * @param carcassHeight - Total height of the carcass
 * @param doorGap - Gap around the door
 * @param doorCount - Number of doors (1 or 2)
 */
export function calculateDoorDimensions(
  carcassWidth: number,
  carcassHeight: number,
  doorGap: number,
  doorCount: number
): {
  width: number
  height: number
} {
  const height = carcassHeight - doorGap * 2

  if (doorCount === 2) {
    // Two doors: divide width by 2 and subtract gap
    const width = carcassWidth / 2 - doorGap
    return { width, height }
  } else {
    // Single door: subtract gap on both sides
    const width = carcassWidth - doorGap * 2
    return { width, height }
  }
}

/**
 * Calculates drawer width accounting for end panel thicknesses
 */
export function calculateDrawerWidth(
  carcassWidth: number,
  endPanelThickness: number
): number {
  return carcassWidth - endPanelThickness * 2
}

/**
 * Calculates shelf positions with spacing
 * @param startHeight - Starting height (above bottom panel)
 * @param endHeight - Ending height (below top panel)
 * @param shelfCount - Number of shelves to create
 * @param maxSpacing - Maximum spacing between shelves
 */
export function calculateShelfPositions(
  startHeight: number,
  endHeight: number,
  shelfCount: number,
  maxSpacing: number
): number[] {
  if (shelfCount <= 0 || endHeight <= startHeight) {
    return []
  }

  const totalShelfSpace = endHeight - startHeight
  const spacing = Math.min(maxSpacing, totalShelfSpace / (shelfCount + 1))

  const positions: number[] = []
  for (let i = 0; i < shelfCount; i++) {
    positions.push(startHeight + (i + 1) * spacing)
  }

  return positions
}
