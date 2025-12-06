import type { CabinetData } from "../types"
import { WALL_THICKNESS } from "./sceneUtils"

/**
 * Cabinet types that should be excluded from snap detection.
 * Kickers and bulkheads are "accessory" cabinets that follow their parent cabinets
 * and should not be snap targets themselves.
 */
const EXCLUDED_SNAP_TYPES = ["kicker", "bulkhead"] as const

/**
 * Checks if a cabinet should be excluded from snap detection
 */
function isExcludedFromSnap(cabinet: CabinetData): boolean {
  if (EXCLUDED_SNAP_TYPES.includes(cabinet.cabinetType as typeof EXCLUDED_SNAP_TYPES[number])) {
    return true
  }
  // Exclude child fillers/panels from being snap targets themselves
  if (cabinet.parentCabinetId && (cabinet.cabinetType === 'filler' || cabinet.cabinetType === 'panel')) {
    return true
  }
  return false
}

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
 * Also considers additional walls for snapping
 * Returns the snapped position and information about active snap points
 */
export function calculateSnapPosition(
  draggedCabinet: CabinetData,
  targetX: number,
  targetY: number,
  otherCabinets: CabinetData[],
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
  additionalWalls?: Array<{ id: string; length: number; distanceFromLeft: number; thickness?: number }>,
  allCabinets?: CabinetData[] // Full list of all cabinets for child lookup
): SnapResult {
  // Filter out the dragged cabinet from others using cabinetId
  // to handle stale references
  // Also filter out kickers and bulkheads - they are "accessory" cabinets that follow their parents
  // and should not be snap targets themselves
  const others = otherCabinets.filter(
    (cab) => cab.cabinetId !== draggedCabinet.cabinetId && !isExcludedFromSnap(cab)
  )

  // Use provided allCabinets or fall back to others + dragged
  const fullCabinetsList = allCabinets || [draggedCabinet, ...others]

  // Detect all potential snap points from cabinets
  const snapPoints = detectSnapPoints(
    draggedCabinet,
    targetX,
    targetY,
    others,
    config,
    fullCabinetsList
  )

  // Detect snap points from additional walls
  if (additionalWalls && additionalWalls.length > 0) {
    const wallSnapPoints = detectWallSnapPoints(
      draggedCabinet,
      targetX,
      targetY,
      additionalWalls,
      config,
      fullCabinetsList
    )
    snapPoints.push(...wallSnapPoints)
  }

  if (snapPoints.length === 0 && others.length === 0 && (!additionalWalls || additionalWalls.length === 0)) {
    // No other cabinets or walls to snap to
    return {
      snapped: false,
      position: { x: targetX, y: targetY },
      activeSnapPoints: [],
    }
  }

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
      config.minGap,
      fullCabinetsList
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
 * Get the effective bounds of a cabinet relative to its own position, considering child fillers/panels
 * Returns offsets from the cabinet's origin (x=0)
 */
function getCabinetRelativeEffectiveBounds(cabinet: CabinetData, allCabinets: CabinetData[]): { leftOffset: number; rightOffset: number } {
  const parentWidth = cabinet.carcass.dimensions.width
  
  let minRelLeft = 0
  let maxRelRight = parentWidth

  // Find child fillers/panels
  for (const c of allCabinets) {
    if (
      c.parentCabinetId === cabinet.cabinetId &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true
    ) {
      const childWidth = c.carcass.dimensions.width
      
      // Calculate relative position based on side
      // This is more robust than using group.position which might be lagging during drag
      if (c.parentSide === 'left') {
        const relX = -childWidth
        if (relX < minRelLeft) {
          minRelLeft = relX
        }
      } else if (c.parentSide === 'right') {
        const relX = parentWidth + childWidth
        if (relX > maxRelRight) {
          maxRelRight = relX
        }
      }
    }
  }

  return { leftOffset: minRelLeft, rightOffset: maxRelRight }
}

/**
 * Get the effective left edge (lowest X) of a cabinet, considering child fillers/panels
 * Optimized to avoid unnecessary filtering
 */
export function getEffectiveLeftEdge(cabinet: CabinetData, allCabinets: CabinetData[]): number {
  let minLeft = cabinet.group.position.x
  
  // Find child fillers/panels on the left side - single pass optimization
  for (const c of allCabinets) {
    if (
      c.parentCabinetId === cabinet.cabinetId &&
      c.parentSide === 'left' &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true
    ) {
      // Calculate based on parent position and child width
      // More robust than using child position directly
      const childLeft = cabinet.group.position.x - c.carcass.dimensions.width
      if (childLeft < minLeft) {
        minLeft = childLeft
      }
    }
  }

  return minLeft
}

/**
 * Get the effective right edge (highest X) of a cabinet, considering child fillers/panels
 * Optimized to avoid unnecessary filtering
 */
export function getEffectiveRightEdge(cabinet: CabinetData, allCabinets: CabinetData[]): number {
  const cabinetRight = cabinet.group.position.x + cabinet.carcass.dimensions.width
  let maxRight = cabinetRight
  
  // Find child fillers/panels on the right side - single pass optimization
  for (const c of allCabinets) {
    if (
      c.parentCabinetId === cabinet.cabinetId &&
      c.parentSide === 'right' &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true
    ) {
      // Calculate based on parent position and child width
      const childRight = cabinetRight + c.carcass.dimensions.width
      if (childRight > maxRight) {
        maxRight = childRight
      }
    }
  }

  return maxRight
}

/**
 * Detect all potential snap points from nearby cabinets
 */
function detectSnapPoints(
  draggedCabinet: CabinetData,
  targetX: number,
  targetY: number,
  otherCabinets: CabinetData[],
  config: SnapConfig,
  allCabinets: CabinetData[]
): SnapPoint[] {
  const snapPoints: SnapPoint[] = []
  const draggedHeight = draggedCabinet.carcass.dimensions.height

  // Calculate dragged cabinet edges at target position
  // Use effective edges that consider child fillers/panels for the dragged cabinet
  const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(draggedCabinet, allCabinets)
  
  const draggedLeft = targetX + leftOffset
  const draggedRight = targetX + rightOffset
  const draggedBottom = targetY
  const draggedTop = targetY + draggedHeight

  for (const other of otherCabinets) {
    const otherY = other.group.position.y
    const otherHeight = other.carcass.dimensions.height

    // Use effective edges that consider child fillers/panels
    const otherLeft = getEffectiveLeftEdge(other, allCabinets)
    const otherRight = getEffectiveRightEdge(other, allCabinets)
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
          position: { x: otherRight - leftOffset },
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
          position: { x: otherLeft - rightOffset },
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
 * Detect snap points from additional walls
 * Walls have left and right edges that cabinets can snap to
 */
function detectWallSnapPoints(
  draggedCabinet: CabinetData,
  targetX: number,
  targetY: number,
  additionalWalls: Array<{ id: string; length: number; distanceFromLeft: number; thickness?: number }>,
  config: SnapConfig,
  allCabinets: CabinetData[]
): SnapPoint[] {
  const snapPoints: SnapPoint[] = []

  // Calculate dragged cabinet edges at target position
  const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(draggedCabinet, allCabinets)
  const draggedLeft = targetX + leftOffset
  const draggedRight = targetX + rightOffset

  for (const wall of additionalWalls) {
    // Wall thickness defaults to WALL_THICKNESS if not specified
    const wallThickness = wall.thickness ?? WALL_THICKNESS
    const wallLeft = wall.distanceFromLeft
    const wallRight = wall.distanceFromLeft + wallThickness

    // Edge-to-edge snapping (horizontal) - snap to wall edges
    if (config.enableEdgeSnap) {
      // Snap dragged cabinet's LEFT edge to wall's RIGHT edge
      // (placing dragged cabinet to the RIGHT of wall)
      const leftToRightDist = Math.abs(draggedLeft - wallRight)
      if (leftToRightDist <= config.threshold) {
        snapPoints.push({
          type: "edge-right",
          position: { x: wallRight - leftOffset },
          distance: leftToRightDist,
          targetCabinet: draggedCabinet, // Use dragged cabinet as placeholder (walls don't have CabinetData)
        })
      }

      // Snap dragged cabinet's RIGHT edge to wall's LEFT edge
      // (placing dragged cabinet to the LEFT of wall)
      const rightToLeftDist = Math.abs(draggedRight - wallLeft)
      if (rightToLeftDist <= config.threshold) {
        snapPoints.push({
          type: "edge-left",
          position: { x: wallLeft - rightOffset },
          distance: rightToLeftDist,
          targetCabinet: draggedCabinet, // Use dragged cabinet as placeholder (walls don't have CabinetData)
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
  minGap: number,
  allCabinets: CabinetData[]
): boolean {
  const draggedHeight = draggedCabinet.carcass.dimensions.height

  const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(draggedCabinet, allCabinets)
  const draggedLeft = x + leftOffset - minGap
  const draggedRight = x + rightOffset + minGap
  const draggedBottom = y - minGap
  const draggedTop = y + draggedHeight + minGap

  for (const other of otherCabinets) {
    const otherY = other.group.position.y
    const otherHeight = other.carcass.dimensions.height

    // Use effective edges that consider child fillers/panels
    const otherLeft = getEffectiveLeftEdge(other, allCabinets)
    const otherRight = getEffectiveRightEdge(other, allCabinets)
    const otherBottom = otherY
    const otherTop = otherY + otherHeight

    // Check for bounding box overlap using AABB collision detection
    // Use a small epsilon to handle floating point precision issues
    const EPSILON = 0.01
    const xOverlap = draggedLeft < otherRight - EPSILON && draggedRight > otherLeft + EPSILON
    const yOverlap = draggedBottom < otherTop - EPSILON && draggedTop > otherBottom + EPSILON

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
