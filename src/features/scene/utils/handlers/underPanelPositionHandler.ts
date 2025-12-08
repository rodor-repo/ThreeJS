import { CabinetData } from "../../types"
import * as THREE from "three"

/**
 * Calculates the effective width of the under panel, considering child fillers/panels
 * that have "off the floor" measurement > 0 (or generally just children)
 */
function getEffectiveUnderPanelWidth(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): { effectiveWidth: number; effectiveLeftX: number } {
  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentLeftX = parentX
  const parentRightX = parentX + parentWidth

  let minX = parentLeftX
  let maxX = parentRightX

  // Find all child fillers/panels
  // For under panel, we should include all children attached to this parent
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  // Extend width to include children
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
 * Updates under panel position and dimensions when parent cabinet changes
 */
export const updateUnderPanelPosition = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[],
  changes: {
    positionChanged?: boolean
    dimensionsChanged?: boolean
    heightChanged?: boolean
    widthChanged?: boolean
    depthChanged?: boolean
  }
) => {
  // Find under panel for this parent cabinet
  const underPanelCabinet = allCabinets.find(
    (c) =>
      c.cabinetType === "underPanel" &&
      c.underPanelParentCabinetId === parentCabinet.cabinetId
  )

  if (!underPanelCabinet) {
    return
  }

  // Get underPanelFace from carcass
  const underPanelFace = underPanelCabinet.carcass?.underPanelFace

  if (!underPanelFace) {
    return
  }

  const parentY = parentCabinet.group.position.y
  const parentZ = parentCabinet.group.position.z
  const parentDepth = parentCabinet.carcass.dimensions.depth
  
  // Calculate effective width including children
  const { effectiveWidth, effectiveLeftX } = getEffectiveUnderPanelWidth(
    parentCabinet,
    allCabinets
  )

  // Target dimensions for Under Panel
  // Width: effective width
  // Depth: parentDepth - 20 (gap at front)
  // Height: thickness (managed by carcass part, usually 16mm)
  const targetDepth = parentDepth - 20

  // Calculate under panel world position
  // The UnderPanelFace part is positioned relative to its local origin (which is the cabinet group origin)
  // UnderPanelFace.ts sets local position:
  // x = width/2
  // y = -thickness/2
  // z = depth/2 (flush with back Z=0)
  
  // So the cabinet group should be positioned at:
  // X: effectiveLeftX
  // Y: parentY
  // Z: parentZ
  
  const underPanelWorldPos = new THREE.Vector3(
    effectiveLeftX,
    parentY,
    parentZ
  )

  // Update under panel dimensions if needed
  if (changes.dimensionsChanged || changes.widthChanged || changes.depthChanged || changes.heightChanged) {
    if (typeof underPanelFace.updateDimensions === "function") {
      underPanelFace.updateDimensions(
        effectiveWidth,
        targetDepth
      )
    }
    
    // Update carcass dimensions for consistency
    if (underPanelCabinet.carcass) {
      underPanelCabinet.carcass.dimensions.width = effectiveWidth
      underPanelCabinet.carcass.dimensions.height = 16 // thickness
      underPanelCabinet.carcass.dimensions.depth = targetDepth
    }
  }

  // Update under panel world position
  // Always update if anything changed to be safe
  underPanelCabinet.group.position.copy(underPanelWorldPos)
}
