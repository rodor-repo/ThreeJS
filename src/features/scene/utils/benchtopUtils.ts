import { CabinetData } from "../types"
import {
  BENCHTOP_FIXED_DEPTH_EXTENSION,
  DEFAULT_BENCHTOP_FRONT_OVERHANG,
} from "@/features/carcass/builders/builder-constants"

/**
 * Calculates the effective benchtop dimensions, considering child fillers/panels
 *
 * Length = Cabinet Width + any child filler/panel widths
 * Starting X = Lowest X value (cabinet left edge or child filler/panel left edge)
 */
export function getEffectiveBenchtopDimensions(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): { effectiveLength: number; effectiveLeftX: number } {
  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentLeftX = parentX
  const parentRightX = parentX + parentWidth

  let minX = parentLeftX
  let maxX = parentRightX

  // Find all child fillers/panels attached to this cabinet
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  // Extend benchtop to include children
  childCabinets.forEach((child) => {
    const childLeftX = child.group.position.x
    const childWidth = child.carcass.dimensions.width
    const childRightX = childLeftX + childWidth

    if (childLeftX < minX) {
      minX = childLeftX
    }
    if (childRightX > maxX) {
      maxX = childRightX
    }
  })

  const effectiveLength = maxX - minX
  const effectiveLeftX = minX

  return { effectiveLength, effectiveLeftX }
}

/**
 * Calculates the total benchtop depth including fixed extension and front overhang
 */
export function calculateBenchtopDepth(
  parentDepth: number,
  frontOverhang: number = DEFAULT_BENCHTOP_FRONT_OVERHANG
): number {
  return parentDepth + BENCHTOP_FIXED_DEPTH_EXTENSION + frontOverhang
}
