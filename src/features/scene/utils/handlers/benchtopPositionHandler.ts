import { CabinetData } from "../../types"
import { getEffectiveBenchtopDimensions } from "./benchtopHandler"

/**
 * Updates benchtop position and dimensions when parent cabinet changes
 * Benchtops are separate selectable objects but need to follow parent cabinet
 * 
 * Now uses CarcassAssembly methods instead of direct mesh manipulation.
 */
export const updateBenchtopPosition = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[],
  changes: {
    positionChanged?: boolean
    dimensionsChanged?: boolean
    childChanged?: boolean // When filler/panel is added/removed/resized
  }
) => {
  // Find benchtop for this parent cabinet
  const benchtopCabinet = allCabinets.find(
    (c) =>
      c.cabinetType === "benchtop" &&
      c.benchtopParentCabinetId === parentCabinet.cabinetId
  )

  if (!benchtopCabinet) {
    return
  }

  // Access benchtop via CarcassAssembly (not userData anymore)
  const carcass = benchtopCabinet.carcass
  if (!carcass?.benchtop) {
    return
  }

  const parentY = parentCabinet.group.position.y
  const parentZ = parentCabinet.group.position.z
  const parentHeight = parentCabinet.carcass.dimensions.height
  const parentDepth = parentCabinet.carcass.dimensions.depth

  // Calculate effective benchtop length including children
  const { effectiveLength, effectiveLeftX } = getEffectiveBenchtopDimensions(
    parentCabinet,
    allCabinets
  )

  // Benchtop dimensions:
  // Length = effective length (cabinet + children)
  // Thickness = cabinet property or 38mm (default)
  // Depth = parent cabinet depth + 20mm (fixed) + front overhang
  const benchtopThickness = benchtopCabinet.benchtopThickness ?? 38
  const FIXED_DEPTH_EXTENSION = 20 // Fixed 20mm extension beyond cabinet
  const frontOverhang = benchtopCabinet.benchtopFrontOverhang ?? 20
  const leftOverhang = benchtopCabinet.benchtopLeftOverhang ?? 0
  const rightOverhang = benchtopCabinet.benchtopRightOverhang ?? 0
  const benchtopDepth = parentDepth + FIXED_DEPTH_EXTENSION + frontOverhang

  // Update benchtop dimensions if needed
  if (changes.dimensionsChanged || changes.childChanged) {
    // Update config values to ensure BenchtopBuilder has correct overhang values
    carcass.config.benchtopFrontOverhang = frontOverhang
    carcass.config.benchtopLeftOverhang = leftOverhang
    carcass.config.benchtopRightOverhang = rightOverhang

    // Use CarcassAssembly.updateDimensions() - this calls BenchtopBuilder.updateDimensions()
    carcass.updateDimensions({
      width: effectiveLength,
      height: benchtopThickness,
      depth: benchtopDepth,
    })
  }

  // Update benchtop world position
  if (
    changes.positionChanged ||
    changes.dimensionsChanged ||
    changes.childChanged
  ) {
    // Benchtop position:
    // X = effectiveLeftX (lowest X value - left edge of cabinet or child filler)
    // Y = parent cabinet top (parentY + parentHeight)
    // Z = parentZ (same as parent - starts from back wall)
    benchtopCabinet.group.position.set(
      effectiveLeftX,
      parentY + parentHeight,
      parentZ
    )
  }
}

/**
 * Checks if there's an adjacent cabinet on the left side
 */
export const hasLeftAdjacentCabinet = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): boolean => {
  const parentLeftX = parentCabinet.group.position.x

  return allCabinets.some(
    (c) =>
      c.cabinetType === "base" &&
      c.cabinetId !== parentCabinet.cabinetId &&
      Math.abs(c.group.position.x + c.carcass.dimensions.width - parentLeftX) < 1 // Within 1mm tolerance
  )
}

/**
 * Checks if there's an adjacent cabinet on the right side
 */
export const hasRightAdjacentCabinet = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): boolean => {
  const parentRightX = parentCabinet.group.position.x + parentCabinet.carcass.dimensions.width

  return allCabinets.some(
    (c) =>
      c.cabinetType === "base" &&
      c.cabinetId !== parentCabinet.cabinetId &&
      Math.abs(c.group.position.x - parentRightX) < 1 // Within 1mm tolerance
  )
}
