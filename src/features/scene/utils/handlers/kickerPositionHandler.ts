import { CabinetData } from "../../types"
import * as THREE from "three"

/**
 * Calculates the effective width of the kicker, considering child fillers/panels
 * that have "off the floor" measurement > 0
 */
function getEffectiveKickerWidth(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): { effectiveWidth: number; effectiveLeftX: number } {
  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentLeftX = parentX
  const parentRightX = parentX + parentWidth

  let minX = parentLeftX
  let maxX = parentRightX

  // Find all child fillers/panels that have "off the floor" > 0
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true &&
      c.group.position.y > 0 // "Off the floor" is not zero
  )

  // Extend kicker width to include children
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

  const effectiveWidth = maxX - minX
  const effectiveLeftX = minX

  return { effectiveWidth, effectiveLeftX }
}

/**
 * Updates kicker position and dimensions when parent cabinet changes
 * Kickers are separate selectable objects but need to follow parent cabinet
 */
export const updateKickerPosition = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[],
  changes: {
    positionChanged?: boolean
    dimensionsChanged?: boolean
    kickerHeightChanged?: boolean
  }
) => {
  // Find kicker for this parent cabinet
  const kickerCabinet = allCabinets.find(
    (c) => c.cabinetType === 'kicker' && c.kickerParentCabinetId === parentCabinet.cabinetId
  )

  if (!kickerCabinet || !kickerCabinet.kickerFace) {
    return
  }

  const kickerFace = kickerCabinet.kickerFace
  const parentX = parentCabinet.group.position.x
  const parentY = parentCabinet.group.position.y
  const parentZ = parentCabinet.group.position.z
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentDepth = parentCabinet.carcass.dimensions.depth
  const kickerHeight = Math.max(0, parentY) // Kicker height = parent Y position

  // Calculate effective kicker width including children (only if "off the floor" > 0)
  const { effectiveWidth, effectiveLeftX } = getEffectiveKickerWidth(parentCabinet, allCabinets)

  // Calculate kicker world position
  // Kicker's local origin is at its center
  // We need to position it so its left edge aligns with effectiveLeftX
  const kickerLocalX = effectiveWidth / 2 // Center of effective width
  const kickerLocalY = -kickerHeight / 2
  const kickerLocalZ = parentDepth - 70 + 16 / 2 // depth - zOffset + thickness/2

  // Convert to world position
  // World X = effectiveLeftX + kickerLocalX (to center the kicker at effectiveLeftX + width/2)
  const kickerWorldPos = new THREE.Vector3(
    effectiveLeftX + kickerLocalX,
    parentY + kickerLocalY,
    parentZ + kickerLocalZ
  )

  // Update kicker face dimensions if needed
  if (changes.dimensionsChanged || changes.kickerHeightChanged) {
    if (typeof kickerFace.updateDimensions === 'function') {
      kickerFace.updateDimensions(
        effectiveWidth, // Use effective width including children
        kickerHeight,
        parentDepth
      )
    }
  }

  // Update kicker world position
  if (changes.positionChanged || changes.dimensionsChanged || changes.kickerHeightChanged) {
    kickerCabinet.group.position.copy(kickerWorldPos)
    
    // Update dummy carcass dimensions for consistency
    if (kickerCabinet.carcass) {
      kickerCabinet.carcass.dimensions.width = effectiveWidth
      kickerCabinet.carcass.dimensions.height = kickerHeight
      kickerCabinet.carcass.dimensions.depth = 16 // kicker thickness
    }
  }
}

