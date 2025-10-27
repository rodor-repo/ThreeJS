import type { CabinetData } from "../types"

/**
 * Represents a potential snap point that a cabinet can snap to
 */
export type SnapPoint = {
  /** Type of snap alignment */
  type: "edge-left" | "edge-right" | "align-y" | "align-top" | "align-bottom"
  /** The position to snap to */
  position: { x?: number; y?: number }
  /** Distance from current position to snap point */
  distance: number
  /** The cabinet that provides this snap point */
  targetCabinet: CabinetData
}

/**
 * Result of snap calculation
 */
export type SnapResult = {
  /** Whether snapping occurred */
  snapped: boolean
  /** Final position after snap (or original if no snap) */
  position: { x: number; y: number }
  /** All active snap points that were applied */
  activeSnapPoints: SnapPoint[]
}

/**
 * Configuration for snap behavior
 */
export type SnapConfig = {
  /** Distance threshold for snapping (in mm) */
  threshold: number
  /** Enable edge-to-edge horizontal snapping */
  enableEdgeSnap: boolean
  /** Enable vertical Y-position alignment */
  enableVerticalSnap: boolean
  /** Enable overlap prevention */
  enableOverlapPrevention: boolean
  /** Minimum gap between cabinets to prevent touching (in mm) */
  minGap: number
}

/**
 * Default snap configuration
 */
export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  // threshold: 100, // 100mm snap distance
  threshold: 25, // 100mm snap distance
  enableEdgeSnap: true,
  enableVerticalSnap: true,
  enableOverlapPrevention: true,
  minGap: 0, // No gap for edge-to-edge snapping (cabinets touch)
}

/**
 * Main snap calculation function
 * Takes the dragged cabinet, target position, and all other cabinets
 * Returns the snapped position and information about active snap points
 */
export function calculateSnapPosition(
  draggedCabinet: CabinetData,
  targetX: number,
  targetY: number,
  otherCabinets: CabinetData[],
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): SnapResult {
  // Filter out the dragged cabinet from others
  const others = otherCabinets.filter((cab) => cab !== draggedCabinet)

  if (others.length === 0) {
    // No other cabinets to snap to
    return {
      snapped: false,
      position: { x: targetX, y: targetY },
      activeSnapPoints: [],
    }
  }

  // Detect all potential snap points
  const snapPoints = detectSnapPoints(
    draggedCabinet,
    targetX,
    targetY,
    others,
    config
  )

  if (snapPoints.length === 0) {
    return {
      snapped: false,
      position: { x: targetX, y: targetY },
      activeSnapPoints: [],
    }
  }

  // Find closest snap points for X and Y independently
  const { xSnap, ySnap } = findClosestSnaps(snapPoints)

  let finalX = targetX
  let finalY = targetY
  const activeSnapPoints: SnapPoint[] = []

  // Apply X snap if found
  if (xSnap && xSnap.position.x !== undefined) {
    finalX = xSnap.position.x
    activeSnapPoints.push(xSnap)
  }

  // Apply Y snap if found
  if (ySnap && ySnap.position.y !== undefined) {
    finalY = ySnap.position.y
    activeSnapPoints.push(ySnap)
  }

  // Check for overlaps if enabled
  if (config.enableOverlapPrevention) {
    const hasOverlap = checkOverlap(
      draggedCabinet,
      finalX,
      finalY,
      others,
      config.minGap
    )

    if (hasOverlap) {
      // Revert to original position if snap causes overlap
      finalX = targetX
      finalY = targetY
      activeSnapPoints.length = 0
    }
  }

  return {
    snapped: activeSnapPoints.length > 0,
    position: { x: finalX, y: finalY },
    activeSnapPoints,
  }
}

/**
 * Detect all potential snap points from nearby cabinets
 */
function detectSnapPoints(
  draggedCabinet: CabinetData,
  targetX: number,
  targetY: number,
  otherCabinets: CabinetData[],
  config: SnapConfig
): SnapPoint[] {
  const snapPoints: SnapPoint[] = []
  const draggedWidth = draggedCabinet.carcass.dimensions.width
  const draggedHeight = draggedCabinet.carcass.dimensions.height

  // Calculate dragged cabinet edges at target position
  const draggedLeft = targetX
  const draggedRight = targetX + draggedWidth
  const draggedBottom = targetY
  const draggedTop = targetY + draggedHeight

  for (const other of otherCabinets) {
    const otherX = other.group.position.x
    const otherY = other.group.position.y
    const otherWidth = other.carcass.dimensions.width
    const otherHeight = other.carcass.dimensions.height

    const otherLeft = otherX
    const otherRight = otherX + otherWidth
    const otherBottom = otherY
    const otherTop = otherY + otherHeight

    // Edge-to-edge snapping (horizontal)
    if (config.enableEdgeSnap) {
      // Snap dragged cabinet's LEFT edge to other's RIGHT edge
      // (placing dragged cabinet to the RIGHT of other)
      const leftToRightDist = Math.abs(draggedLeft - otherRight)
      if (leftToRightDist <= config.threshold) {
        snapPoints.push({
          type: "edge-right",
          position: { x: otherRight },
          distance: leftToRightDist,
          targetCabinet: other,
        })
      }

      // Snap dragged cabinet's RIGHT edge to other's LEFT edge
      // (placing dragged cabinet to the LEFT of other)
      const rightToLeftDist = Math.abs(draggedRight - otherLeft)
      if (rightToLeftDist <= config.threshold) {
        snapPoints.push({
          type: "edge-left",
          position: { x: otherLeft - draggedWidth },
          distance: rightToLeftDist,
          targetCabinet: other,
        })
      }
    }

    // Vertical alignment snapping
    if (config.enableVerticalSnap) {
      // Snap to same Y position (bottom alignment)
      const bottomAlignDist = Math.abs(draggedBottom - otherBottom)
      if (bottomAlignDist <= config.threshold) {
        snapPoints.push({
          type: "align-bottom",
          position: { y: otherBottom },
          distance: bottomAlignDist,
          targetCabinet: other,
        })
      }

      // Snap to same top edge (top alignment)
      const topAlignDist = Math.abs(draggedTop - otherTop)
      if (topAlignDist <= config.threshold) {
        snapPoints.push({
          type: "align-top",
          position: { y: otherTop - draggedHeight },
          distance: topAlignDist,
          targetCabinet: other,
        })
      }
    }
  }

  return snapPoints
}

/**
 * Find the closest snap point for X and Y independently
 */
function findClosestSnaps(snapPoints: SnapPoint[]): {
  xSnap: SnapPoint | null
  ySnap: SnapPoint | null
} {
  let xSnap: SnapPoint | null = null
  let ySnap: SnapPoint | null = null

  for (const point of snapPoints) {
    // X-axis snaps (edge-left, edge-right)
    if (
      (point.type === "edge-left" || point.type === "edge-right") &&
      point.position.x !== undefined
    ) {
      if (!xSnap || point.distance < xSnap.distance) {
        xSnap = point
      }
    }

    // Y-axis snaps (align-y, align-top, align-bottom)
    if (
      (point.type === "align-y" ||
        point.type === "align-top" ||
        point.type === "align-bottom") &&
      point.position.y !== undefined
    ) {
      if (!ySnap || point.distance < ySnap.distance) {
        ySnap = point
      }
    }
  }

  return { xSnap, ySnap }
}

/**
 * Check if a cabinet at a given position would overlap with any other cabinets
 */
function checkOverlap(
  draggedCabinet: CabinetData,
  x: number,
  y: number,
  otherCabinets: CabinetData[],
  minGap: number
): boolean {
  const draggedWidth = draggedCabinet.carcass.dimensions.width
  const draggedHeight = draggedCabinet.carcass.dimensions.height

  const draggedLeft = x - minGap
  const draggedRight = x + draggedWidth + minGap
  const draggedBottom = y - minGap
  const draggedTop = y + draggedHeight + minGap

  for (const other of otherCabinets) {
    const otherX = other.group.position.x
    const otherY = other.group.position.y
    const otherWidth = other.carcass.dimensions.width
    const otherHeight = other.carcass.dimensions.height

    const otherLeft = otherX
    const otherRight = otherX + otherWidth
    const otherBottom = otherY
    const otherTop = otherY + otherHeight

    // Check for bounding box overlap using AABB collision detection
    const xOverlap = draggedLeft < otherRight && draggedRight > otherLeft
    const yOverlap = draggedBottom < otherTop && draggedTop > otherBottom

    if (xOverlap && yOverlap) {
      return true // Overlap detected
    }
  }

  return false // No overlap
}

/**
 * Get snap guide data for rendering
 * Returns information about lines to draw for visual feedback
 */
export type SnapGuideData = {
  type: "vertical" | "horizontal"
  position: { x?: number; y?: number }
  color: string
}

export function getSnapGuides(snapResult: SnapResult): SnapGuideData[] {
  const guides: SnapGuideData[] = []

  for (const snap of snapResult.activeSnapPoints) {
    if (snap.type === "edge-left" || snap.type === "edge-right") {
      // Vertical line for X-axis snaps
      guides.push({
        type: "vertical",
        position: { x: snap.position.x },
        color: "#00FFFF", // Cyan
      })
    } else if (
      snap.type === "align-y" ||
      snap.type === "align-top" ||
      snap.type === "align-bottom"
    ) {
      // Horizontal line for Y-axis snaps
      guides.push({
        type: "horizontal",
        position: { y: snap.position.y },
        color: "#FFFF00", // Yellow
      })
    }
  }

  return guides
}
