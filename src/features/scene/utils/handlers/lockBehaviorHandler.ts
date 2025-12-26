import { CabinetData, WallDimensions } from "../../types"
import { clampPositionX, getCabinetHorizontalEdges } from "./sharedCabinetUtils"
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

  const { left: leftEdge, right: rightEdge } = getCabinetHorizontalEdges(cabinet)
  const isCentered = cabinet.cabinetType === 'kicker' || cabinet.cabinetType === 'bulkhead'

  if (leftLock && rightLock) {
    // Both locks are active - cannot resize width
    return null
  } else if (leftLock) {
    // Left edge is locked - keep left edge fixed, move right edge
    // For centered types: newCenter = leftEdge + newWidth / 2
    // For left-aligned types: newX = leftEdge
    const newX = isCentered ? leftEdge + newWidth / 2 : leftEdge
    return { newX, positionChanged: Math.abs(newX - oldX) > 0.1 }
  } else if (rightLock) {
    // Right edge is locked - keep right edge fixed, move left edge
    // For centered types: newCenter = rightEdge - newWidth / 2
    // For left-aligned types: newX = rightEdge - newWidth
    const newX = isCentered ? rightEdge - newWidth / 2 : rightEdge - newWidth
    const clampedX = isCentered ? newX : clampPositionX(newX) // Don't clamp center position directly the same way
    return { newX: clampedX, positionChanged: Math.abs(clampedX - oldX) > 0.1 }
  } else {
    // Neither lock is active - cabinet extends/shrinks equally from center
    // For centered types: position (center) stays fixed
    // For left-aligned types: position (left) moves to maintain center
    const centerX = leftEdge + oldWidth / 2
    const newX = isCentered ? centerX : centerX - newWidth / 2
    const clampedX = isCentered ? newX : clampPositionX(newX)
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

