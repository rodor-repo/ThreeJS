import { CabinetData } from "../../types"
import * as THREE from "three"
import { Benchtop } from "@/features/carcass/parts/Benchtop"
import { getEffectiveBenchtopDimensions } from "./benchtopHandler"

/**
 * Updates benchtop position and dimensions when parent cabinet changes
 * Benchtops are separate selectable objects but need to follow parent cabinet
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

  // Get benchtop from group userData
  const benchtop = benchtopCabinet.group.userData.benchtop as Benchtop | undefined

  if (!benchtop) {
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
  // Thickness = 38mm (fixed)
  // Depth = parent cabinet depth + 20mm (fixed) + front overhang
  const benchtopThickness = 38
  const FIXED_DEPTH_EXTENSION = 20 // Fixed 20mm extension beyond cabinet
  const frontOverhang = benchtopCabinet.benchtopFrontOverhang ?? 20
  const benchtopDepth = parentDepth + FIXED_DEPTH_EXTENSION + frontOverhang  // Parent + 20mm + overhang

  // Update benchtop dimensions if needed
  if (changes.dimensionsChanged || changes.childChanged) {
    // Pass current overhang values - depth already includes front overhang
    benchtop.updateDimensions(
      effectiveLength,
      benchtopThickness,
      benchtopDepth,  // Depth includes front overhang
      frontOverhang,
      benchtopCabinet.benchtopLeftOverhang,
      benchtopCabinet.benchtopRightOverhang
    )

    // Update carcass dimensions for consistency - depth includes front overhang
    if (benchtopCabinet.carcass) {
      benchtopCabinet.carcass.dimensions.width = effectiveLength
      benchtopCabinet.carcass.dimensions.height = benchtopThickness
      benchtopCabinet.carcass.dimensions.depth = benchtopDepth
    }
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
