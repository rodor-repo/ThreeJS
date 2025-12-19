import { CabinetData } from "../../types"
import { 
  getEffectiveBenchtopDimensions, 
  calculateBenchtopDepth 
} from "../benchtopUtils"
import { 
  DEFAULT_BENCHTOP_THICKNESS, 
  DEFAULT_BENCHTOP_FRONT_OVERHANG 
} from "@/features/carcass/builders/builder-constants"
import { 
  getLeftAdjacentCabinet, 
  getRightAdjacentCabinet 
} from "../../lib/snapUtils"

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
  const benchtopThickness = benchtopCabinet.benchtopThickness ?? DEFAULT_BENCHTOP_THICKNESS
  const frontOverhang = benchtopCabinet.benchtopFrontOverhang ?? DEFAULT_BENCHTOP_FRONT_OVERHANG
  const leftOverhang = benchtopCabinet.benchtopLeftOverhang ?? 0
  const rightOverhang = benchtopCabinet.benchtopRightOverhang ?? 0
  const benchtopDepth = calculateBenchtopDepth(parentDepth, frontOverhang)

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
  return !!getLeftAdjacentCabinet(parentCabinet, allCabinets, { allowedTypes: ["base"] })
}

/**
 * Checks if there's an adjacent cabinet on the right side
 */
export const hasRightAdjacentCabinet = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): boolean => {
  return !!getRightAdjacentCabinet(parentCabinet, allCabinets, { allowedTypes: ["base"] })
}
