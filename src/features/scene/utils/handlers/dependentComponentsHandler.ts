import { CabinetData, WallDimensions } from "../../types"
import { updateChildCabinets } from "./childCabinetHandler"
import { updateKickerPosition } from "./kickerPositionHandler"
import { updateBulkheadPosition } from "./bulkheadPositionHandler"
import { updateUnderPanelPosition } from "./underPanelPositionHandler"
import { updateBenchtopPosition } from "./benchtopPositionHandler"

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
      positionChanged: changes.positionChanged || false,
    })
  }

  // Update underPanel position for top cabinets
  if (cabinet.cabinetType === "top") {
    updateUnderPanelPosition(cabinet, allCabinets, {
      heightChanged: changes.heightChanged || false,
      widthChanged: changes.widthChanged || changes.childChanged || false,
      depthChanged: changes.depthChanged || false,
      positionChanged: changes.positionChanged || false,
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
        changes.childChanged ||
        false,
    })
  }

  // Update benchtop position for base cabinets
  if (cabinet.cabinetType === "base") {
    updateBenchtopPosition(cabinet, allCabinets, {
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
        false,
      positionChanged: changes.positionChanged || false,
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
          positionChanged: changes.positionChanged || false,
        })
      }

      // Update parent benchtop (affects benchtop length)
      if (parentCabinet.cabinetType === "base") {
        updateBenchtopPosition(parentCabinet, allCabinets, {
          dimensionsChanged: true,
          positionChanged: false,
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
          positionChanged: changes.positionChanged || false,
        })
      }

      // Update parent underPanel (affects underPanel width)
      if (parentCabinet.cabinetType === "top") {
        updateUnderPanelPosition(parentCabinet, allCabinets, {
          dimensionsChanged: true,
          positionChanged: false,
        })
      }
    }
  }
}

