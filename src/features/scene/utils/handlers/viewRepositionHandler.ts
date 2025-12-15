import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { areCabinetsPaired, clampPositionX } from "./sharedCabinetUtils"
import { updateAllDependentComponents } from "./dependentComponentsHandler"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

/**
 * Repositions other cabinets in the same view when a cabinet's width changes
 * Handles three lock states: left, right, or center (neither)
 */
export function repositionViewCabinets(
  changingCabinet: CabinetData,
  widthDelta: number,
  oldX: number,
  oldWidth: number,
  cabinets: CabinetData[],
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>,
  viewManager: ViewManagerResult,
  wallDimensions?: WallDimensions
): void {
  // Skip if cabinet doesn't belong to a view
  if (!changingCabinet.viewId || changingCabinet.viewId === "none") {
    return
  }

  const cabinetsInSameView = viewManager.getCabinetsInView(
    changingCabinet.viewId as ViewId
  )

  const leftLock = changingCabinet.leftLock ?? false
  const rightLock = changingCabinet.rightLock ?? false

  if (leftLock && !rightLock) {
    // Left lock: move cabinets on the RIGHT
    const changingLeftEdge = oldX

    cabinetsInSameView.forEach((cabinetId) => {
      if (cabinetId === changingCabinet.cabinetId) return

      const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
      if (!otherCabinet) return

      // Skip if cabinets are paired
      if (
        areCabinetsPaired(
          changingCabinet.cabinetId,
          otherCabinet.cabinetId,
          cabinetGroups
        )
      ) {
        return
      }

      // Cabinet is on the RIGHT if its left edge is to the right of changing cabinet's left edge
      if (otherCabinet.group.position.x > changingLeftEdge) {
        const oldX = otherCabinet.group.position.x
        const newX = otherCabinet.group.position.x + widthDelta
        const clampedX = clampPositionX(newX)

        otherCabinet.group.position.set(
          clampedX,
          otherCabinet.group.position.y,
          otherCabinet.group.position.z
        )

        // Update all dependent components if position changed
        if (Math.abs(clampedX - oldX) > 0.1 && wallDimensions) {
          updateAllDependentComponents(otherCabinet, cabinets, wallDimensions, {
            positionChanged: true,
          })
        }
      }
    })
  } else if (rightLock && !leftLock) {
    // Right lock: move cabinets on the LEFT
    const changingRightEdge = oldX + oldWidth

    cabinetsInSameView.forEach((cabinetId) => {
      if (cabinetId === changingCabinet.cabinetId) return

      const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
      if (!otherCabinet) return

      // Skip if cabinets are paired
      if (
        areCabinetsPaired(
          changingCabinet.cabinetId,
          otherCabinet.cabinetId,
          cabinetGroups
        )
      ) {
        return
      }

      // Cabinet is on the LEFT if its right edge is to the left of changing cabinet's right edge
      if (
        otherCabinet.group.position.x +
          otherCabinet.carcass.dimensions.width <
        changingRightEdge
      ) {
        const oldX = otherCabinet.group.position.x
        const newX = otherCabinet.group.position.x - widthDelta
        const clampedX = clampPositionX(newX)

        otherCabinet.group.position.set(
          clampedX,
          otherCabinet.group.position.y,
          otherCabinet.group.position.z
        )

        // Update all dependent components if position changed
        if (Math.abs(clampedX - oldX) > 0.1 && wallDimensions) {
          updateAllDependentComponents(otherCabinet, cabinets, wallDimensions, {
            positionChanged: true,
          })
        }
      }
    })
  } else if (!leftLock && !rightLock) {
    // Neither lock: move LEFT cabinets left by halfDelta, RIGHT cabinets right by halfDelta
    const halfDelta = widthDelta / 2
    const changingLeftEdge = oldX
    const changingRightEdge = oldX + oldWidth

    cabinetsInSameView.forEach((cabinetId) => {
      if (cabinetId === changingCabinet.cabinetId) return

      const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
      if (!otherCabinet) return

      // Skip if cabinets are paired
      if (
        areCabinetsPaired(
          changingCabinet.cabinetId,
          otherCabinet.cabinetId,
          cabinetGroups
        )
      ) {
        return
      }

      const otherX = otherCabinet.group.position.x
      const otherWidth = otherCabinet.carcass.dimensions.width
      const otherRight = otherX + otherWidth

      // Move cabinets on the LEFT side by halfDelta (negative X direction)
      if (otherRight < changingRightEdge) {
        const oldX = otherCabinet.group.position.x
        const newX = otherCabinet.group.position.x - halfDelta
        const clampedX = clampPositionX(newX)

        otherCabinet.group.position.set(
          clampedX,
          otherCabinet.group.position.y,
          otherCabinet.group.position.z
        )

        // Update all dependent components if position changed
        if (Math.abs(clampedX - oldX) > 0.1 && wallDimensions) {
          updateAllDependentComponents(otherCabinet, cabinets, wallDimensions, {
            positionChanged: true,
          })
        }
      }
      // Move cabinets on the RIGHT side by halfDelta (positive X direction)
      else if (otherX > changingLeftEdge) {
        const oldX = otherCabinet.group.position.x
        const newX = otherCabinet.group.position.x + halfDelta
        const clampedX = clampPositionX(newX)

        otherCabinet.group.position.set(
          clampedX,
          otherCabinet.group.position.y,
          otherCabinet.group.position.z
        )

        // Update all dependent components if position changed
        if (Math.abs(clampedX - oldX) > 0.1 && wallDimensions) {
          updateAllDependentComponents(otherCabinet, cabinets, wallDimensions, {
            positionChanged: true,
          })
        }
      }
    })
  }
}
