import { CabinetData } from "../../types"
import * as THREE from "three"

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

  // Calculate kicker world position relative to parent
  // Kicker local position relative to cabinet (from KickerFace.updatePosition logic)
  const kickerLocalX = parentWidth / 2
  const kickerLocalY = -kickerHeight / 2
  const kickerLocalZ = parentDepth - 70 + 16 / 2 // depth - zOffset + thickness/2

  // Convert to world position
  const kickerWorldPos = new THREE.Vector3(
    parentX + kickerLocalX,
    parentY + kickerLocalY,
    parentZ + kickerLocalZ
  )

  // Update kicker face dimensions if needed
  if (changes.dimensionsChanged || changes.kickerHeightChanged) {
    if (typeof kickerFace.updateDimensions === 'function') {
      kickerFace.updateDimensions(
        parentWidth,
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
      kickerCabinet.carcass.dimensions.width = parentWidth
      kickerCabinet.carcass.dimensions.height = kickerHeight
      kickerCabinet.carcass.dimensions.depth = 16 // kicker thickness
    }
  }
}

