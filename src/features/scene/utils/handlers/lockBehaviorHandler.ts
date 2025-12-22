import { CabinetData, WallDimensions } from "../../types"
import { clampPositionX } from "./sharedCabinetUtils"
import { updateAllDependentComponents } from "./dependentComponentsHandler"

/**
 * Applies width change to a cabinet based on its lock state
 * Returns the new X position and whether position changed, or null if both locks prevent resize
 */
export function applyWidthChangeWithLock(
  cabinet: CabinetData,
  newWidth: number,
  oldWidth: number,
  oldX: number
): { newX: number; positionChanged: boolean } | null {
  const leftLock = cabinet.leftLock ?? false
  const rightLock = cabinet.rightLock ?? false
  const widthDelta = newWidth - oldWidth

  if (leftLock && rightLock) {
    // Both locks are active - cannot resize width
    return null
  } else if (leftLock) {
    // Left edge is locked - keep left edge fixed, move right edge
    // Position stays the same (left edge is frozen)
    return { newX: oldX, positionChanged: false }
  } else if (rightLock) {
    // Right edge is locked - keep right edge fixed, move left edge
    const rightEdge = oldX + oldWidth
    const newX = rightEdge - newWidth
    const clampedX = clampPositionX(newX)
    return { newX: clampedX, positionChanged: Math.abs(clampedX - oldX) > 0.1 }
  } else {
    // Neither lock is active - cabinet extends/shrinks equally from center
    // Center position stays fixed
    const centerX = oldX + oldWidth / 2
    const newX = centerX - newWidth / 2
    const clampedX = clampPositionX(newX)
    return { newX: clampedX, positionChanged: Math.abs(clampedX - oldX) > 0.1 }
  }
}

/**
 * Processes grouped (paired) cabinets with proportional width changes
 * Respects each grouped cabinet's individual lock state
 */
export function processGroupedCabinets(
  sourceCabinet: CabinetData,
  widthDelta: number,
  cabinets: CabinetData[],
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>,
  wallDimensions: WallDimensions
): void {
  const groupData = cabinetGroups.get(sourceCabinet.cabinetId)
  if (!groupData || groupData.length === 0) return

  groupData.forEach((groupCabinet) => {
    const groupedCabinet = cabinets.find(
      (c) => c.cabinetId === groupCabinet.cabinetId
    )
    if (!groupedCabinet) return

    // Calculate proportional width change
    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
    const newGroupedWidth =
      groupedCabinet.carcass.dimensions.width + proportionalDelta

    // Apply width change with lock behavior
    const result = applyWidthChangeWithLock(
      groupedCabinet,
      newGroupedWidth,
      groupedCabinet.carcass.dimensions.width,
      groupedCabinet.group.position.x
    )

    // If both locks prevent resize, skip this grouped cabinet
    if (!result) return

    const { newX, positionChanged } = result

    // Update dimensions
    groupedCabinet.carcass.updateDimensions({
      width: newGroupedWidth,
      height: groupedCabinet.carcass.dimensions.height,
      depth: groupedCabinet.carcass.dimensions.depth,
    })

    // Update position
    groupedCabinet.group.position.set(
      newX,
      groupedCabinet.group.position.y,
      groupedCabinet.group.position.z
    )

    // Update all dependent components
    updateAllDependentComponents(groupedCabinet, cabinets, wallDimensions, {
      widthChanged: true,
      positionChanged,
    })
  })
}

