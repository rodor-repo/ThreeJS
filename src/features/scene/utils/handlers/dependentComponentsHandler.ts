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
      widthChanged: changes.widthChanged || false,
      depthChanged: changes.depthChanged || false,
      positionChanged: changes.positionChanged || false,
    })
  }

  // Update underPanel position for top cabinets
  if (cabinet.cabinetType === "top") {
    updateUnderPanelPosition(cabinet, allCabinets, {
      heightChanged: changes.heightChanged || false,
      widthChanged: changes.widthChanged || false,
      depthChanged: changes.depthChanged || false,
      positionChanged: changes.positionChanged || false,
      dimensionsChanged:
        changes.heightChanged ||
        changes.widthChanged ||
        changes.depthChanged ||
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
      childChanged: false, // Will be set to true when filler/panel changes
    })
  }
}

