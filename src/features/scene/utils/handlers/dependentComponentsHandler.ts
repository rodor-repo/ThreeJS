import { CabinetData, WallDimensions } from "../../types"
import { updateKickerPosition } from "./kickerPositionHandler"
import {
  updateBulkheadPosition,
  updateReturnBulkheads,
} from "./bulkheadPositionHandler"
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
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
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
    const isOverheadWithOverhang =
      parentCabinet.cabinetType === "top" &&
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
      if (childCabinet.cabinetType === "filler") {
        // Update Z position to maintain door alignment
        const fillerDepth = childCabinet.carcass.dimensions.depth
        const fillerType =
          childCabinet.carcass.dimensions.width === 100 ? "l-shape" : "linear"
        const lShapeOffset = fillerType === "l-shape" ? 20 : 0
        const fillerZ = doorFrontEdgeZ - fillerDepth + lShapeOffset

        childCabinet.group.position.set(
          childCabinet.group.position.x,
          childCabinet.group.position.y,
          fillerZ
        )
      } else if (childCabinet.cabinetType === "panel") {
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
      if (side === "left") {
        // Position to the left of the cabinet
        childCabinet.group.position.set(
          parentX - childCabinet.carcass.dimensions.width,
          childCabinet.group.position.y,
          childCabinet.group.position.z
        )
      } else if (side === "right") {
        // Position to the right of the cabinet
        childCabinet.group.position.set(
          parentX + parentWidth,
          childCabinet.group.position.y,
          childCabinet.group.position.z
        )
      }
    }

    // 5. Position change: Update child X position only to maintain snap position
    // IMPORTANT: Preserve child's Y position (Off the Floor value) - don't reset to parent Y
    if (changes.positionChanged) {
      if (side === "left") {
        childCabinet.group.position.set(
          parentX - childCabinet.carcass.dimensions.width,
          childCabinet.group.position.y, // Preserve current Y (Off the Floor)
          childCabinet.group.position.z
        )
      } else if (side === "right") {
        childCabinet.group.position.set(
          parentX + parentWidth,
          childCabinet.group.position.y, // Preserve current Y (Off the Floor)
          childCabinet.group.position.z
        )
      }
      // If side is not specified, position doesn't need to change
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
}

/**
 * Updates all dependent components (children, kicker, bulkhead, underPanel) for a cabinet
 * This consolidates the repeated pattern found throughout the codebase
 */
export function updateAllDependentComponents(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions,
  changes: {
    heightChanged?: boolean
    widthChanged?: boolean
    depthChanged?: boolean
    positionChanged?: boolean
    kickerHeightChanged?: boolean
    overhangChanged?: boolean
    childChanged?: boolean
  }
): void {
  // Update child cabinets (fillers/panels)
  updateChildCabinets(cabinet, allCabinets, changes)

  // Update kicker position for base and tall cabinets
  if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
    updateKickerPosition(cabinet, allCabinets, {
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
        changes.childChanged ||
        false,
      positionChanged: changes.positionChanged || false,
      kickerHeightChanged: changes.kickerHeightChanged || false,
    })
  }

  // Update bulkhead position for base, top, and tall cabinets
  if (
    cabinet.cabinetType === "base" ||
    cabinet.cabinetType === "top" ||
    cabinet.cabinetType === "tall"
  ) {
    updateBulkheadPosition(cabinet, allCabinets, wallDimensions, {
      heightChanged: changes.heightChanged || false,
      widthChanged: changes.widthChanged || changes.childChanged || false,
      depthChanged: changes.depthChanged || false,
      positionChanged:
        changes.positionChanged || changes.kickerHeightChanged || false,
    })

    // Update return bulkheads (only for top and tall)
    if (cabinet.cabinetType === "top" || cabinet.cabinetType === "tall") {
      updateReturnBulkheads(cabinet, allCabinets, wallDimensions)
    }
  }

  // Update underPanel position for top cabinets
  if (cabinet.cabinetType === "top") {
    updateUnderPanelPosition(cabinet, allCabinets, {
      heightChanged: changes.heightChanged || false,
      widthChanged: changes.widthChanged || changes.childChanged || false,
      depthChanged: changes.depthChanged || false,
      positionChanged:
        changes.positionChanged || changes.kickerHeightChanged || false,
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
        changes.childChanged ||
        false,
    })
  }

  // Update benchtop position for base cabinets and appliances (dishwasher/washingMachine)
  const isApplianceWithBenchtop = cabinet.cabinetType === "appliance" && 
    (cabinet.carcass?.config?.applianceType === "dishwasher" || 
     cabinet.carcass?.config?.applianceType === "washingMachine")
  
  if (cabinet.cabinetType === "base" || isApplianceWithBenchtop) {
    updateBenchtopPosition(cabinet, allCabinets, {
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
        false,
      positionChanged:
        changes.positionChanged || changes.kickerHeightChanged || false,
      childChanged: changes.childChanged || false,
    })
  }

  // If this is a child filler/panel, update the parent's dependent components
  // This ensures that when a filler is resized, the parent's kicker, benchtop, and bulkhead are updated
  if (
    cabinet.parentCabinetId &&
    (cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel") &&
    cabinet.hideLockIcons === true
  ) {
    const parentCabinet = allCabinets.find(
      (c) => c.cabinetId === cabinet.parentCabinetId
    )
    if (parentCabinet) {
      // Update parent kicker (affects kicker width extension)
      if (
        parentCabinet.cabinetType === "base" ||
        parentCabinet.cabinetType === "tall"
      ) {
        updateKickerPosition(parentCabinet, allCabinets, {
          dimensionsChanged: true,
          positionChanged:
            changes.positionChanged || changes.kickerHeightChanged || false,
        })
      }

      // Update parent benchtop (affects benchtop length)
      if (parentCabinet.cabinetType === "base") {
        updateBenchtopPosition(parentCabinet, allCabinets, {
          dimensionsChanged: true,
          positionChanged:
            changes.positionChanged || changes.kickerHeightChanged || false,
          childChanged: true,
        })
      }

      // Update parent bulkhead (affects bulkhead width)
      if (
        parentCabinet.cabinetType === "base" ||
        parentCabinet.cabinetType === "top" ||
        parentCabinet.cabinetType === "tall"
      ) {
        updateBulkheadPosition(parentCabinet, allCabinets, wallDimensions, {
          widthChanged: true,
          positionChanged:
            changes.positionChanged || changes.kickerHeightChanged || false,
        })

        // Update return bulkheads for parent
        if (
          parentCabinet.cabinetType === "top" ||
          parentCabinet.cabinetType === "tall"
        ) {
          updateReturnBulkheads(parentCabinet, allCabinets, wallDimensions)
        }
      }

      // Update parent underPanel (affects underPanel width)
      if (parentCabinet.cabinetType === "top") {
        updateUnderPanelPosition(parentCabinet, allCabinets, {
          dimensionsChanged: true,
          positionChanged:
            changes.positionChanged || changes.kickerHeightChanged || false,
        })
      }
    }
  }
}
