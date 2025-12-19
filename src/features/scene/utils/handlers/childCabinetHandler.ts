import { CabinetData } from "../../types"
import { updateKickerPosition } from "./kickerPositionHandler"
import { updateUnderPanelPosition } from "./underPanelPositionHandler"
import { updateBenchtopPosition } from "./benchtopPositionHandler"

/**
 * Updates child fillers/panels when parent cabinet dimensions change
 */
export const updateChildCabinets = (
  parentCabinet: CabinetData,
  cabinets: CabinetData[],
  changes: {
    heightChanged?: boolean
    widthChanged?: boolean
    depthChanged?: boolean
    kickerHeightChanged?: boolean
    positionChanged?: boolean
    overhangChanged?: boolean
  }
) => {
  // Find all child cabinets (fillers/panels) that have this parent
  const childCabinets = cabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true
  )

  if (childCabinets.length === 0) return

  const parentX = parentCabinet.group.position.x
  const parentY = parentCabinet.group.position.y
  const parentZ = parentCabinet.group.position.z
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentHeight = parentCabinet.carcass.dimensions.height
  const parentDepth = parentCabinet.carcass.dimensions.depth

  // Get door material for Z positioning
  const doorMaterial = parentCabinet.carcass.config.doorMaterial
  const doorThickness = doorMaterial ? doorMaterial.getThickness() : 0
  const doorOffset = 2 // 2mm clearance offset
  const doorFrontEdgeZ = parentZ + parentDepth + doorThickness + doorOffset

  childCabinets.forEach((childCabinet) => {
    const side = childCabinet.parentSide

    // Check if parent is overhead cabinet with overhang doors
    const isOverheadWithOverhang = parentCabinet.cabinetType === 'top' && 
                                    parentCabinet.carcass.config.overhangDoor === true
    const overhangAmount = 20 // 20mm overhang extension

    // 1. Height change: Update child height to match parent
    // All cabinets (including overhead): Keep bottom Y position aligned with parent, extend upward (positive Y) like parent cabinets
    // For overhead cabinets with overhang: add overhang amount to height, and position 20mm lower to align with door overhang
    if (changes.heightChanged) {
      let newHeight = parentHeight
      let newY = parentY // Align bottom Y with parent bottom Y (extends upward in positive Y direction)
      
      if (isOverheadWithOverhang) {
        // Add overhang extension to height, and position 20mm lower to align with door overhang
        newHeight = parentHeight + overhangAmount
        newY = parentY - overhangAmount // Position 20mm lower (negative Y) to align with door overhang
      }
      
      childCabinet.carcass.updateDimensions({
        width: childCabinet.carcass.dimensions.width,
        height: newHeight,
        depth: childCabinet.carcass.dimensions.depth,
      })
      
      // Update Y position to align bottom with parent bottom (extends upward in positive Y direction)
      // For overhead with overhang: position 20mm lower to align with door overhang
      childCabinet.group.position.set(
        childCabinet.group.position.x,
        newY,
        childCabinet.group.position.z
      )
    }

    // 2. Kicker height change: Update child Y position (Off the Floor)
    if (changes.kickerHeightChanged) {
      let newY = parentY // Match parent Y position (kicker height)
      
      if (isOverheadWithOverhang) {
        // For overhead with overhang: position 20mm lower to align with door overhang
        newY = parentY - overhangAmount
      }
      
      childCabinet.group.position.set(
        childCabinet.group.position.x,
        newY,
        childCabinet.group.position.z
      )
    }

    // 3. Depth change: Update child Z position (fillers) or depth (panels)
    if (changes.depthChanged) {
      if (childCabinet.cabinetType === 'filler') {
        // Update Z position to maintain door alignment
        const fillerDepth = childCabinet.carcass.dimensions.depth
        const fillerType = childCabinet.carcass.dimensions.width === 100 ? 'l-shape' : 'linear'
        const lShapeOffset = fillerType === 'l-shape' ? 20 : 0
        const fillerZ = doorFrontEdgeZ - fillerDepth + lShapeOffset
        
        childCabinet.group.position.set(
          childCabinet.group.position.x,
          childCabinet.group.position.y,
          fillerZ
        )
      } else if (childCabinet.cabinetType === 'panel') {
        // Update panel depth to match parent depth
        childCabinet.carcass.updateDimensions({
          width: childCabinet.carcass.dimensions.width,
          height: childCabinet.carcass.dimensions.height,
          depth: parentDepth, // Match parent depth
        })
      }
    }

    // 4. Width change: Update child X position to maintain snap position
    if (changes.widthChanged) {
      if (side === 'left') {
        // Position to the left of the cabinet
        childCabinet.group.position.set(
          parentX - childCabinet.carcass.dimensions.width,
          childCabinet.group.position.y,
          childCabinet.group.position.z
        )
      } else if (side === 'right') {
        // Position to the right of the cabinet
        childCabinet.group.position.set(
          parentX + parentWidth,
          childCabinet.group.position.y,
          childCabinet.group.position.z
        )
      }
    }

    // 5. Position change: Update child X and Y position to maintain snap position and follow parent Y
    if (changes.positionChanged) {
      // Calculate new Y position based on parent Y
      // For overhead cabinets with overhang: position 20mm lower to align with door overhang
      let newY = parentY
      if (isOverheadWithOverhang) {
        newY = parentY - overhangAmount // Position 20mm lower (negative Y) to align with door overhang
      }

      if (side === 'left') {
        childCabinet.group.position.set(
          parentX - childCabinet.carcass.dimensions.width,
          newY,
          childCabinet.group.position.z
        )
      } else if (side === 'right') {
        childCabinet.group.position.set(
          parentX + parentWidth,
          newY,
          childCabinet.group.position.z
        )
      } else {
        // If side is not specified, still update Y position
        childCabinet.group.position.set(
          childCabinet.group.position.x,
          newY,
          childCabinet.group.position.z
        )
      }
    }

    // 6. Overhang change: Update child height and position for overhead cabinets
    if (changes.overhangChanged && isOverheadWithOverhang) {
      // Add overhang extension to height, and position 20mm lower to align with door overhang
      const newHeight = parentHeight + overhangAmount
      const newY = parentY - overhangAmount // Position 20mm lower (negative Y) to align with door overhang
      
      childCabinet.carcass.updateDimensions({
        width: childCabinet.carcass.dimensions.width,
        height: newHeight,
        depth: childCabinet.carcass.dimensions.depth,
      })
      
      // Update Y position to align with door overhang
      childCabinet.group.position.set(
        childCabinet.group.position.x,
        newY,
        childCabinet.group.position.z
      )
    } else if (changes.overhangChanged && !isOverheadWithOverhang) {
      // Overhang was disabled, remove the extension (restore to parent height and position)
      const newHeight = parentHeight
      const newY = parentY // Align bottom with parent bottom
      
      childCabinet.carcass.updateDimensions({
        width: childCabinet.carcass.dimensions.width,
        height: newHeight,
        depth: childCabinet.carcass.dimensions.depth,
      })
      
      // Update Y position to align with parent bottom
      childCabinet.group.position.set(
        childCabinet.group.position.x,
        newY,
        childCabinet.group.position.z
      )
    }
  })

  // Update parent kicker if parent is base or tall and child dimensions/position changed
  // (affects kicker width extension)
  if (
    (parentCabinet.cabinetType === 'base' || parentCabinet.cabinetType === 'tall') &&
    (changes.widthChanged || changes.positionChanged)
  ) {
    updateKickerPosition(parentCabinet, cabinets, {
      dimensionsChanged: true
    })
  }

  // Update parent underPanel if parent is top and child dimensions/position changed
  // (affects underPanel width extension)
  if (
    parentCabinet.cabinetType === 'top' &&
    (changes.widthChanged || changes.positionChanged)
  ) {
    updateUnderPanelPosition(parentCabinet, cabinets, {
      dimensionsChanged: true
    })
  }

  // Update parent benchtop if parent is base and child dimensions/position changed
  // (affects benchtop length)
  if (
    parentCabinet.cabinetType === 'base' &&
    (changes.widthChanged || changes.positionChanged)
  ) {
    updateBenchtopPosition(parentCabinet, cabinets, {
      dimensionsChanged: true,
      childChanged: true
    })
  }
}

