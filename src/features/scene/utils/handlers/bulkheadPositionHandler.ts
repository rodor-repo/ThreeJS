import * as THREE from "three"
import { CabinetData } from "../../types"
import { WallDimensions } from "../../types"
import {
  getEffectiveLeftEdge,
  getEffectiveRightEdge,
  getLeftAdjacentCabinet as getLeftAdjacentCabinetUtil,
  getRightAdjacentCabinet as getRightAdjacentCabinetUtil,
} from "../../lib/snapUtils"
import { WALL_THICKNESS } from "../../lib/sceneUtils"

/**
 * Checks if an overhead cabinet has an adjacent cabinet to its left
 * Returns the adjacent cabinet if found, null otherwise
 */
export function hasLeftAdjacentCabinet(
  cabinet: CabinetData,
  allCabinets: CabinetData[]
): CabinetData | null {
  return getLeftAdjacentCabinetUtil(cabinet, allCabinets, {
    allowedTypes: ["top", "tall"],
    epsilon: 4.0,
  })
}

/**
 * Checks if an overhead cabinet has an adjacent cabinet to its right
 * Returns the adjacent cabinet if found, null otherwise
 */
export function hasRightAdjacentCabinet(
  cabinet: CabinetData,
  allCabinets: CabinetData[]
): CabinetData | null {
  return getRightAdjacentCabinetUtil(cabinet, allCabinets, {
    allowedTypes: ["top", "tall"],
    epsilon: 4.0,
  })
}

/**
 * Calculates the effective width of a cabinet including its child fillers/panels
 */
function getEffectiveBulkheadWidth(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): number {
  let minX = parentCabinet.group.position.x
  let maxX =
    parentCabinet.group.position.x + parentCabinet.carcass.dimensions.width

  // Find all child fillers/panels
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  childCabinets.forEach((child) => {
    const childLeft = child.group.position.x
    const childRight = child.group.position.x + child.carcass.dimensions.width

    if (childLeft < minX) {
      minX = childLeft
    }
    if (childRight > maxX) {
      maxX = childRight
    }
  })

  return maxX - minX
}

/**
 * Calculates the height from cabinet top to back wall top
 */
function calculateBulkheadHeight(
  parentCabinet: CabinetData,
  wallDimensions: WallDimensions
): number {
  const cabinetTopY =
    parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height
  const backWallTopY = wallDimensions.height

  // Height is the gap from cabinet top to back wall top
  const height = Math.max(0, backWallTopY - cabinetTopY)

  return height
}

/**
 * Updates the position and dimensions of an independent bulkhead CabinetData object
 * when its parent cabinet's dimensions or position change.
 */
export const updateBulkheadPosition = (
  parentCabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions,
  changes: {
    heightChanged?: boolean
    widthChanged?: boolean
    depthChanged?: boolean
    positionChanged?: boolean
  }
) => {
  // Find the independent bulkhead associated with this parent cabinet
  const bulkheadCabinet = allCabinets.find(
    (c) =>
      c.cabinetType === "bulkhead" &&
      c.bulkheadParentCabinetId === parentCabinet.cabinetId
  )

  if (!bulkheadCabinet) {
    return
  }

  // Get bulkheadFace from carcass
  const bulkheadFace = bulkheadCabinet.carcass?.bulkheadFace

  if (!bulkheadFace) {
    return
  }

  // Calculate effective width (cabinet + children)
  const effectiveWidth = getEffectiveBulkheadWidth(parentCabinet, allCabinets)

  // Calculate height (from cabinet top to back wall top)
  const bulkheadHeight = calculateBulkheadHeight(parentCabinet, wallDimensions)

  const parentDepth = parentCabinet.carcass.dimensions.depth
  const parentTopY =
    parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height

  // Get parent cabinet's world position
  const parentWorldPos = new THREE.Vector3()
  parentCabinet.group.getWorldPosition(parentWorldPos)

  // Calculate bulkhead's local position relative to the parent cabinet's origin
  // X: Center of effective width (accounting for children)
  const _bulkheadLocalX = effectiveWidth / 2

  // Y: Position relative to cabinet top (bulkhead extends upward from cabinet top)
  // In local space, cabinet top is at y = cabinetHeight
  // Bulkhead center should be at: y = cabinetHeight + bulkheadHeight/2
  const _bulkheadLocalY =
    parentCabinet.carcass.dimensions.height + bulkheadHeight / 2

  // Z: Start at front edge (z = depth) and extend 16mm toward negative Z
  // Center position: z = depth - thickness/2
  const bulkheadThickness = 16
  const bulkheadLocalZ = parentDepth - bulkheadThickness / 2

  // Calculate bulkhead's world position
  // Note: We need to account for the effective width offset (children may extend beyond cabinet)
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  const effectiveLeftEdge =
    childCabinets.length > 0
      ? Math.min(
          parentWorldPos.x,
          ...childCabinets.map((c) => c.group.position.x)
        )
      : parentWorldPos.x

  const newBulkheadWorldPos = new THREE.Vector3(
    effectiveLeftEdge + effectiveWidth / 2, // Center of effective width
    parentTopY + bulkheadHeight / 2, // Top of cabinet + half bulkhead height
    parentWorldPos.z + bulkheadLocalZ // Parent Z + local Z offset
  )

  // Update bulkhead face dimensions
  if (
    changes.heightChanged ||
    changes.widthChanged ||
    changes.depthChanged ||
    changes.positionChanged
  ) {
    if (typeof bulkheadFace.updateDimensions === "function") {
      bulkheadFace.updateDimensions(
        effectiveWidth,
        bulkheadHeight,
        parentDepth,
        parentTopY,
        bulkheadThickness
      )
    }
  }

  // Update bulkhead world position
  if (
    changes.positionChanged ||
    changes.heightChanged ||
    changes.widthChanged ||
    changes.depthChanged
  ) {
    bulkheadCabinet.group.position.copy(newBulkheadWorldPos)

    // Update carcass dimensions for consistency
    if (bulkheadCabinet.carcass) {
      bulkheadCabinet.carcass.dimensions.width = effectiveWidth
      bulkheadCabinet.carcass.dimensions.height = bulkheadHeight
      bulkheadCabinet.carcass.dimensions.depth = bulkheadThickness
    }
  }

  // Update return bulkheads if they exist (for overhead and tall cabinets)
  // Returns are now part of the bulkhead's CarcassAssembly
  if (
    parentCabinet.cabinetType === "top" ||
    parentCabinet.cabinetType === "tall"
  ) {
    const frontEdgeOffsetZ = parentDepth - 16 // Front edge offset 16mm toward negative Z
    const returnDepth = frontEdgeOffsetZ // Extends to Z=0 (back wall)
    const returnHeight = bulkheadHeight // Same height as main bulkhead
    const offsetX = effectiveWidth / 2 // Distance from center to edge

    // Update left return bulkhead if it exists
    if (bulkheadCabinet.carcass?.bulkheadReturnLeft) {
      if (
        changes.heightChanged ||
        changes.depthChanged ||
        changes.positionChanged ||
        changes.widthChanged
      ) {
        bulkheadCabinet.carcass.updateBulkheadReturn(
          "left",
          returnHeight,
          returnDepth,
          offsetX
        )
      }
    }

    // Update right return bulkhead if it exists
    if (bulkheadCabinet.carcass?.bulkheadReturnRight) {
      if (
        changes.heightChanged ||
        changes.depthChanged ||
        changes.positionChanged ||
        changes.widthChanged
      ) {
        bulkheadCabinet.carcass.updateBulkheadReturn(
          "right",
          returnHeight,
          returnDepth,
          offsetX
        )
      }
    }
  }
}

/**
 * Checks if a cabinet (or its children) reaches the left wall
 * Returns true if the cabinet's left edge (or its children's left edge) is at or near X=0
 * The left wall's right edge is at X=0, so we check if the cabinet reaches X=0
 */
function reachesLeftWall(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  _wallDimensions: WallDimensions
): boolean {
  const effectiveLeftEdge = getEffectiveLeftEdge(cabinet, allCabinets)
  const EPSILON = 1.0 // Increased tolerance to account for slight offsets

  // Check if reaches X=0 (left wall right edge)
  // Cabinet can be slightly before X=0 (negative) or at X=0
  if (effectiveLeftEdge <= EPSILON && effectiveLeftEdge >= -EPSILON) {
    return true
  }

  return false
}

/**
 * Checks if a cabinet (or its children) reaches the right wall
 * Returns true if the cabinet's right edge (or its children's right edge) is at or near the right wall
 */
function reachesRightWall(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions
): boolean {
  const effectiveRightEdge = getEffectiveRightEdge(cabinet, allCabinets)
  const rightWallPosition =
    wallDimensions.backWallLength || wallDimensions.length || 0
  const EPSILON = 0.01
  return Math.abs(effectiveRightEdge - rightWallPosition) < EPSILON
}

/**
 * Checks if a cabinet (or its children) reaches a middle wall from the left side
 * Returns true if the cabinet's right edge (or its children's right edge) is at or near a middle wall's left edge
 */
function reachesMiddleWallFromLeft(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions
): boolean {
  if (
    !wallDimensions.additionalWalls ||
    wallDimensions.additionalWalls.length === 0
  ) {
    return false
  }

  const effectiveRightEdge = getEffectiveRightEdge(cabinet, allCabinets)
  const EPSILON = 0.01

  for (const wall of wallDimensions.additionalWalls) {
    const wallLeft = wall.distanceFromLeft
    // Check if cabinet's right edge reaches the wall's left edge
    if (Math.abs(effectiveRightEdge - wallLeft) < EPSILON) {
      return true
    }
  }

  return false
}

/**
 * Checks if a cabinet (or its children) reaches a middle wall from the right side
 * Returns true if the cabinet's left edge (or its children's left edge) is at or near a middle wall's right edge
 */
function reachesMiddleWallFromRight(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions
): boolean {
  if (
    !wallDimensions.additionalWalls ||
    wallDimensions.additionalWalls.length === 0
  ) {
    return false
  }

  const effectiveLeftEdge = getEffectiveLeftEdge(cabinet, allCabinets)
  const EPSILON = 0.01

  for (const wall of wallDimensions.additionalWalls) {
    const wallThickness = wall.thickness ?? WALL_THICKNESS
    const wallRight = wall.distanceFromLeft + wallThickness
    // Check if cabinet's left edge reaches the wall's right edge
    if (Math.abs(effectiveLeftEdge - wallRight) < EPSILON) {
      return true
    }
  }

  return false
}

/**
 * Updates return bulkheads for overhead cabinets based on adjacent cabinet positions
 * Creates or removes return bulkheads as needed when cabinets are snapped
 * Returns are now managed through the bulkhead's CarcassAssembly
 */
export function updateReturnBulkheads(
  overheadCabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions
) {
  if (
    overheadCabinet.cabinetType !== "top" &&
    overheadCabinet.cabinetType !== "tall"
  )
    return

  // Check if bulkhead exists
  const bulkheadCabinet = allCabinets.find(
    (c) =>
      c.cabinetType === "bulkhead" &&
      c.bulkheadParentCabinetId === overheadCabinet.cabinetId
  )
  if (!bulkheadCabinet) return

  const leftAdjacentCabinet = hasLeftAdjacentCabinet(
    overheadCabinet,
    allCabinets
  )
  const rightAdjacentCabinet = hasRightAdjacentCabinet(
    overheadCabinet,
    allCabinets
  )

  // Check if cabinet reaches walls (considering children)
  const reachesLeft = reachesLeftWall(
    overheadCabinet,
    allCabinets,
    wallDimensions
  )
  const reachesRight = reachesRightWall(
    overheadCabinet,
    allCabinets,
    wallDimensions
  )
  const reachesMiddleFromLeft = reachesMiddleWallFromLeft(
    overheadCabinet,
    allCabinets,
    wallDimensions
  )
  const reachesMiddleFromRight = reachesMiddleWallFromRight(
    overheadCabinet,
    allCabinets,
    wallDimensions
  )

  // Get current cabinet depth
  const currentCabinetDepth = overheadCabinet.carcass.dimensions.depth

  // Determine if left return should exist based on depth comparison rule
  let shouldHaveLeftReturn = !reachesLeft && !reachesMiddleFromLeft
  if (leftAdjacentCabinet) {
    const leftAdjacentDepth = leftAdjacentCabinet.carcass.dimensions.depth
    if (currentCabinetDepth <= leftAdjacentDepth) {
      shouldHaveLeftReturn = false
    }
  }

  // Determine if right return should exist based on depth comparison rule
  let shouldHaveRightReturn = !reachesRight && !reachesMiddleFromRight
  if (rightAdjacentCabinet) {
    const rightAdjacentDepth = rightAdjacentCabinet.carcass.dimensions.depth
    if (currentCabinetDepth <= rightAdjacentDepth) {
      shouldHaveRightReturn = false
    }
  }

  // Calculate return dimensions
  const cabinetTopY =
    overheadCabinet.group.position.y + overheadCabinet.carcass.dimensions.height
  const bulkheadHeight = Math.max(0, wallDimensions.height - cabinetTopY)
  const frontEdgeOffsetZ = overheadCabinet.carcass.dimensions.depth - 16
  const returnDepth = frontEdgeOffsetZ
  const returnHeight = bulkheadHeight

  // Calculate effective width for offset
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === overheadCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  const cabinetWorldPos = new THREE.Vector3()
  overheadCabinet.group.getWorldPosition(cabinetWorldPos)

  let minX = cabinetWorldPos.x
  let maxX = cabinetWorldPos.x + overheadCabinet.carcass.dimensions.width

  childCabinets.forEach((child) => {
    const childLeft = child.group.position.x
    const childRight = child.group.position.x + child.carcass.dimensions.width
    if (childLeft < minX) minX = childLeft
    if (childRight > maxX) maxX = childRight
  })

  const effectiveWidth = maxX - minX
  const offsetX = effectiveWidth / 2

  // Check existing returns from carcass
  const hasLeftReturn = !!bulkheadCabinet.carcass?.bulkheadReturnLeft
  const hasRightReturn = !!bulkheadCabinet.carcass?.bulkheadReturnRight

  // Remove left return if it shouldn't exist
  if (!shouldHaveLeftReturn && hasLeftReturn) {
    bulkheadCabinet.carcass?.removeBulkheadReturn("left")
  }

  // Remove right return if it shouldn't exist
  if (!shouldHaveRightReturn && hasRightReturn) {
    bulkheadCabinet.carcass?.removeBulkheadReturn("right")
  }

  // Add left return if needed and doesn't exist
  if (shouldHaveLeftReturn && !hasLeftReturn) {
    bulkheadCabinet.carcass?.addBulkheadReturn(
      "left",
      returnHeight,
      returnDepth,
      offsetX
    )
  }

  // Add right return if needed and doesn't exist
  if (shouldHaveRightReturn && !hasRightReturn) {
    bulkheadCabinet.carcass?.addBulkheadReturn(
      "right",
      returnHeight,
      returnDepth,
      offsetX
    )
  }
}
