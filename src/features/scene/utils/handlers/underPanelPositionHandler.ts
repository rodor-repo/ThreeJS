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
 * Updates under panel position and dimensions when parent cabinet changes.
 * Now uses CarcassAssembly methods instead of direct part manipulation.
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

  // Access underPanel via CarcassAssembly (not direct part manipulation)
  const carcass = underPanelCabinet.carcass
  if (!carcass?.underPanelFace) {
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
  // Height: thickness (16mm)
  const underPanelThickness = 16
  const targetDepth = parentDepth - 20

  // Update under panel dimensions via CarcassAssembly.updateDimensions()
  // This calls UnderPanelBuilder.updateDimensions() which handles the part update
  if (changes.dimensionsChanged || changes.widthChanged || changes.depthChanged || changes.heightChanged) {
    carcass.updateDimensions({
      width: effectiveWidth,
      height: underPanelThickness,
      depth: targetDepth,
    })
  }

  // Update under panel world position
  // UnderPanelFace.ts sets local position relative to group origin
  // So group position should be at: X=effectiveLeftX, Y=parentY, Z=parentZ
  if (
    changes.positionChanged ||
    changes.dimensionsChanged ||
    changes.widthChanged ||
    changes.depthChanged ||
    changes.heightChanged
  ) {
    underPanelCabinet.group.position.set(effectiveLeftX, parentY, parentZ)
  }
}
