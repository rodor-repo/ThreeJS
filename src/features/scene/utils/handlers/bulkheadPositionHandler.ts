import * as THREE from 'three'
import { CabinetData } from '../../types'
import { WallDimensions } from '../../types'
import { getEffectiveLeftEdge, getEffectiveRightEdge } from '../../lib/snapUtils'
import { WALL_THICKNESS } from '../../lib/sceneUtils'

/**
 * Checks if an overhead cabinet has an adjacent cabinet to its left
 * Returns the adjacent cabinet if found, null otherwise
 */
export function hasLeftAdjacentCabinet(
  cabinet: CabinetData,
  allCabinets: CabinetData[]
): CabinetData | null {
  const cabinetMinX = cabinet.group.position.x
  
  // Find all overhead and tall cabinets (excluding the current one)
  const adjacentCabinets = allCabinets.filter(
    (c) =>
      c.cabinetId !== cabinet.cabinetId &&
      (c.cabinetType === 'top' || c.cabinetType === 'tall')
  )
  
  // Check if any cabinet's max X equals this cabinet's min X
  for (const other of adjacentCabinets) {
    const otherMaxX = other.group.position.x + other.carcass.dimensions.width
    
    // Use a small epsilon for floating point comparison
    const EPSILON = 0.01
    if (Math.abs(otherMaxX - cabinetMinX) < EPSILON) {
      return other
    }
  }
  
  return null
}

/**
 * Checks if an overhead cabinet has an adjacent cabinet to its right
 * Returns the adjacent cabinet if found, null otherwise
 */
export function hasRightAdjacentCabinet(
  cabinet: CabinetData,
  allCabinets: CabinetData[]
): CabinetData | null {
  const cabinetMaxX = cabinet.group.position.x + cabinet.carcass.dimensions.width
  
  // Find all overhead and tall cabinets (excluding the current one)
  const adjacentCabinets = allCabinets.filter(
    (c) =>
      c.cabinetId !== cabinet.cabinetId &&
      (c.cabinetType === 'top' || c.cabinetType === 'tall')
  )
  
  // Check if any cabinet's min X equals this cabinet's max X
  for (const other of adjacentCabinets) {
    const otherMinX = other.group.position.x
    
    // Use a small epsilon for floating point comparison
    const EPSILON = 0.01
    if (Math.abs(otherMinX - cabinetMaxX) < EPSILON) {
      return other
    }
  }
  
  return null
}

/**
 * Calculates the effective width of a cabinet including its child fillers/panels
 */
function getEffectiveBulkheadWidth(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): number {
  let minX = parentCabinet.group.position.x
  let maxX = parentCabinet.group.position.x + parentCabinet.carcass.dimensions.width

  // Find all child fillers/panels
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
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
  const cabinetTopY = parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height
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
    (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === parentCabinet.cabinetId
  )

  if (!bulkheadCabinet || !bulkheadCabinet.bulkheadFace) {
    return
  }

  const bulkheadFace = bulkheadCabinet.bulkheadFace
  
  // Calculate effective width (cabinet + children)
  const effectiveWidth = getEffectiveBulkheadWidth(parentCabinet, allCabinets)
  
  // Calculate height (from cabinet top to back wall top)
  const bulkheadHeight = calculateBulkheadHeight(parentCabinet, wallDimensions)
  
  const parentDepth = parentCabinet.carcass.dimensions.depth
  const parentTopY = parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height

  // Get parent cabinet's world position
  const parentWorldPos = new THREE.Vector3()
  parentCabinet.group.getWorldPosition(parentWorldPos)

  // Calculate bulkhead's local position relative to the parent cabinet's origin
  // X: Center of effective width (accounting for children)
  const bulkheadLocalX = effectiveWidth / 2
  
  // Y: Position relative to cabinet top (bulkhead extends upward from cabinet top)
  // In local space, cabinet top is at y = cabinetHeight
  // Bulkhead center should be at: y = cabinetHeight + bulkheadHeight/2
  const bulkheadLocalY = parentCabinet.carcass.dimensions.height + bulkheadHeight / 2
  
  // Z: Start at front edge (z = depth) and extend 16mm toward negative Z
  // Center position: z = depth - thickness/2
  const bulkheadThickness = 16
  const bulkheadLocalZ = parentDepth - bulkheadThickness / 2

  // Calculate bulkhead's world position
  // Note: We need to account for the effective width offset (children may extend beyond cabinet)
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
      c.hideLockIcons === true
  )
  
  const effectiveLeftEdge = childCabinets.length > 0
    ? Math.min(parentWorldPos.x, ...childCabinets.map((c) => c.group.position.x))
    : parentWorldPos.x
  
  const newBulkheadWorldPos = new THREE.Vector3(
    effectiveLeftEdge + effectiveWidth / 2, // Center of effective width
    parentTopY + bulkheadHeight / 2, // Top of cabinet + half bulkhead height
    parentWorldPos.z + bulkheadLocalZ // Parent Z + local Z offset
  )

  // Update bulkhead face dimensions
  if (changes.heightChanged || changes.widthChanged || changes.depthChanged || changes.positionChanged) {
    if (typeof bulkheadFace.updateDimensions === 'function') {
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
  if (changes.positionChanged || changes.heightChanged || changes.widthChanged || changes.depthChanged) {
    bulkheadCabinet.group.position.copy(newBulkheadWorldPos)
    
    // Update dummy carcass dimensions for consistency
    if (bulkheadCabinet.carcass) {
      bulkheadCabinet.carcass.dimensions.width = effectiveWidth
      bulkheadCabinet.carcass.dimensions.height = bulkheadHeight
      bulkheadCabinet.carcass.dimensions.depth = bulkheadThickness
    }
  }

  // Update return bulkheads if they exist (for overhead and tall cabinets)
  if (parentCabinet.cabinetType === 'top' || parentCabinet.cabinetType === 'tall') {
    const returnBulkheadCabinets = allCabinets.filter(
      (c) => c.cabinetType === 'bulkhead' && c.bulkheadReturnParentCabinetId === parentCabinet.cabinetId
    )

    const frontEdgeOffsetZ = parentDepth - 16 // Front edge offset 16mm toward negative Z
    const returnDepth = frontEdgeOffsetZ // Extends to Z=0 (back wall)
    const returnHeight = bulkheadHeight // Same height as main bulkhead
    const returnThickness = 16

    const childCabinets = allCabinets.filter(
      (c) =>
        c.parentCabinetId === parentCabinet.cabinetId &&
        (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
        c.hideLockIcons === true
    )
    
    const effectiveLeftEdge = childCabinets.length > 0
      ? Math.min(parentWorldPos.x, ...childCabinets.map((c) => c.group.position.x))
      : parentWorldPos.x
    
    const effectiveRightEdge = childCabinets.length > 0
      ? Math.max(parentWorldPos.x + parentCabinet.carcass.dimensions.width, ...childCabinets.map((c) => c.group.position.x + c.carcass.dimensions.width))
      : parentWorldPos.x + parentCabinet.carcass.dimensions.width

    // Update left return bulkhead
    const leftReturnCabinet = returnBulkheadCabinets.find(c => c.bulkheadReturnSide === 'left')
    if (leftReturnCabinet && leftReturnCabinet.bulkheadReturn) {
      const bulkheadReturn = leftReturnCabinet.bulkheadReturn
      
      if (changes.heightChanged || changes.depthChanged || changes.positionChanged) {
        if (typeof bulkheadReturn.updateDimensions === 'function') {
          bulkheadReturn.updateDimensions(
            returnHeight,
            returnDepth,
            parentTopY,
            returnThickness
          )
        }
      }

      const returnLeftWorldPos = new THREE.Vector3(
        effectiveLeftEdge + returnThickness / 2, // Left edge + (thickness/2) to extend toward positive X
        parentTopY + returnHeight / 2,
        parentWorldPos.z + frontEdgeOffsetZ / 2
      )

      if (changes.positionChanged || changes.heightChanged || changes.depthChanged) {
        leftReturnCabinet.group.position.copy(returnLeftWorldPos)
        
        if (leftReturnCabinet.carcass) {
          leftReturnCabinet.carcass.dimensions.width = returnThickness
          leftReturnCabinet.carcass.dimensions.height = returnHeight
          leftReturnCabinet.carcass.dimensions.depth = returnDepth
        }
      }
    }

    // Update right return bulkhead
    const rightReturnCabinet = returnBulkheadCabinets.find(c => c.bulkheadReturnSide === 'right')
    if (rightReturnCabinet && rightReturnCabinet.bulkheadReturn) {
      const bulkheadReturn = rightReturnCabinet.bulkheadReturn
      
      if (changes.heightChanged || changes.depthChanged || changes.positionChanged) {
        if (typeof bulkheadReturn.updateDimensions === 'function') {
          bulkheadReturn.updateDimensions(
            returnHeight,
            returnDepth,
            parentTopY,
            returnThickness
          )
        }
      }

      const returnRightWorldPos = new THREE.Vector3(
        effectiveRightEdge - returnThickness / 2, // Right edge - (thickness/2) to extend toward negative X
        parentTopY + returnHeight / 2,
        parentWorldPos.z + frontEdgeOffsetZ / 2
      )

      if (changes.positionChanged || changes.heightChanged || changes.depthChanged) {
        rightReturnCabinet.group.position.copy(returnRightWorldPos)
        
        if (rightReturnCabinet.carcass) {
          rightReturnCabinet.carcass.dimensions.width = returnThickness
          rightReturnCabinet.carcass.dimensions.height = returnHeight
          rightReturnCabinet.carcass.dimensions.depth = returnDepth
        }
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
  wallDimensions: WallDimensions
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
  const rightWallPosition = wallDimensions.backWallLength || wallDimensions.length || 0
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
  if (!wallDimensions.additionalWalls || wallDimensions.additionalWalls.length === 0) {
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
  if (!wallDimensions.additionalWalls || wallDimensions.additionalWalls.length === 0) {
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
 */
export function updateReturnBulkheads(
  overheadCabinet: CabinetData,
  allCabinets: CabinetData[],
  wallDimensions: WallDimensions,
  addCabinet: (cabinet: CabinetData) => void,
  deleteCabinet: (cabinetId: string) => void
) {
  if (overheadCabinet.cabinetType !== 'top' && overheadCabinet.cabinetType !== 'tall') return

  // Check if bulkhead exists
  const bulkheadCabinet = allCabinets.find(
    (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === overheadCabinet.cabinetId
  )
  if (!bulkheadCabinet) return

  const leftAdjacentCabinet = hasLeftAdjacentCabinet(overheadCabinet, allCabinets)
  const rightAdjacentCabinet = hasRightAdjacentCabinet(overheadCabinet, allCabinets)
  
  // Check if cabinet reaches walls (considering children)
  const reachesLeft = reachesLeftWall(overheadCabinet, allCabinets, wallDimensions)
  const reachesRight = reachesRightWall(overheadCabinet, allCabinets, wallDimensions)
  const reachesMiddleFromLeft = reachesMiddleWallFromLeft(overheadCabinet, allCabinets, wallDimensions)
  const reachesMiddleFromRight = reachesMiddleWallFromRight(overheadCabinet, allCabinets, wallDimensions)
  
  // Get current cabinet depth
  const currentCabinetDepth = overheadCabinet.carcass.dimensions.depth
  
  // Determine if left return should exist based on depth comparison rule
  // Left return should be removed if:
  // - Cabinet reaches left wall, OR
  // - Cabinet reaches middle wall from left, OR
  // - There's a left adjacent cabinet AND (current cabinet has smaller depth OR adjacent cabinet has bulkhead with smaller depth)
  let shouldHaveLeftReturn = !reachesLeft && !reachesMiddleFromLeft
  if (leftAdjacentCabinet) {
    const leftAdjacentDepth = leftAdjacentCabinet.carcass.dimensions.depth
    // If current cabinet has smaller depth, remove its left return
    // If current cabinet has larger depth, keep its left return (adjacent cabinet will remove its right return)
    if (currentCabinetDepth < leftAdjacentDepth) {
      shouldHaveLeftReturn = false
    }
    // If depths are equal or current is larger, keep the return (will be handled when processing adjacent cabinet)
  }
  
  // Determine if right return should exist based on depth comparison rule
  // Right return should be removed if:
  // - Cabinet reaches right wall, OR
  // - Cabinet reaches middle wall from right, OR
  // - There's a right adjacent cabinet AND current cabinet has smaller depth
  let shouldHaveRightReturn = !reachesRight && !reachesMiddleFromRight
  if (rightAdjacentCabinet) {
    const rightAdjacentDepth = rightAdjacentCabinet.carcass.dimensions.depth
    // If current cabinet has smaller depth, remove its right return
    // If current cabinet has larger depth, keep its right return (adjacent cabinet will remove its left return)
    if (currentCabinetDepth < rightAdjacentDepth) {
      shouldHaveRightReturn = false
    }
    // If depths are equal or current is larger, keep the return (will be handled when processing adjacent cabinet)
  }

  // Get existing return bulkheads
  const existingReturnBulkheads = allCabinets.filter(
    (c) => c.cabinetType === 'bulkhead' && c.bulkheadReturnParentCabinetId === overheadCabinet.cabinetId
  )

  const existingLeftReturn = existingReturnBulkheads.find(c => c.bulkheadReturnSide === 'left')
  const existingRightReturn = existingReturnBulkheads.find(c => c.bulkheadReturnSide === 'right')

  // Remove left return if it shouldn't exist
  if (!shouldHaveLeftReturn && existingLeftReturn) {
    const bulkheadReturn = existingLeftReturn.bulkheadReturn
    if (bulkheadReturn && typeof bulkheadReturn.dispose === 'function') {
      bulkheadReturn.dispose()
    }
    deleteCabinet(existingLeftReturn.cabinetId)
    delete (overheadCabinet.group as any).bulkheadReturnLeft
    delete (overheadCabinet.group as any).bulkheadReturnLeftCabinetData
  }

  // Remove right return if it shouldn't exist
  if (!shouldHaveRightReturn && existingRightReturn) {
    const bulkheadReturn = existingRightReturn.bulkheadReturn
    if (bulkheadReturn && typeof bulkheadReturn.dispose === 'function') {
      bulkheadReturn.dispose()
    }
    deleteCabinet(existingRightReturn.cabinetId)
    delete (overheadCabinet.group as any).bulkheadReturnRight
    delete (overheadCabinet.group as any).bulkheadReturnRightCabinetData
  }

  // Create left return if needed and doesn't exist
  if (shouldHaveLeftReturn && !existingLeftReturn) {
    import('../../../carcass/parts/BulkheadReturn').then(({ BulkheadReturn }) => {
      const cabinetTopY = overheadCabinet.group.position.y + overheadCabinet.carcass.dimensions.height
      const bulkheadHeight = Math.max(0, wallDimensions.height - cabinetTopY)
      const frontEdgeOffsetZ = overheadCabinet.carcass.dimensions.depth - 16
      const returnDepth = frontEdgeOffsetZ
      const returnHeight = bulkheadHeight
      const returnThickness = 16

      const childCabinets = allCabinets.filter(
        (c) =>
          c.parentCabinetId === overheadCabinet.cabinetId &&
          (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
          c.hideLockIcons === true
      )
      
      const cabinetWorldPos = new THREE.Vector3()
      overheadCabinet.group.getWorldPosition(cabinetWorldPos)
      
      const effectiveLeftEdge = childCabinets.length > 0
        ? Math.min(cabinetWorldPos.x, ...childCabinets.map((c) => c.group.position.x))
        : cabinetWorldPos.x

      const bulkheadReturnLeft = new BulkheadReturn({
        height: returnHeight,
        depth: returnDepth,
        material: overheadCabinet.carcass.config.material.getMaterial(),
      })

      const returnLeftWorldPos = new THREE.Vector3(
        effectiveLeftEdge + returnThickness / 2,
        cabinetTopY + returnHeight / 2,
        cabinetWorldPos.z + frontEdgeOffsetZ / 2
      )

      bulkheadReturnLeft.group.position.copy(returnLeftWorldPos)
      bulkheadReturnLeft.group.name = `bulkheadReturnLeft_${overheadCabinet.cabinetId}`

      const returnLeftDummyCarcass = {
        dimensions: { width: returnThickness, height: returnHeight, depth: returnDepth },
        config: overheadCabinet.carcass.config,
        updateDimensions: () => {},
        updateKickerHeight: () => {},
        updateKickerFace: () => {},
      } as any

      const returnLeftCabinetData: CabinetData = {
        group: bulkheadReturnLeft.group,
        carcass: returnLeftDummyCarcass,
        cabinetType: 'bulkhead',
        subcategoryId: overheadCabinet.subcategoryId,
        cabinetId: `bulkheadReturnLeft_${overheadCabinet.cabinetId}_${Date.now()}`,
        viewId: overheadCabinet.viewId,
        bulkheadReturn: bulkheadReturnLeft,
        bulkheadReturnParentCabinetId: overheadCabinet.cabinetId,
        bulkheadReturnSide: 'left',
        hideLockIcons: true,
      }

      addCabinet(returnLeftCabinetData)
      ;(overheadCabinet.group as any).bulkheadReturnLeft = bulkheadReturnLeft
      ;(overheadCabinet.group as any).bulkheadReturnLeftCabinetData = returnLeftCabinetData
    })
  }

  // Create right return if needed and doesn't exist
  if (shouldHaveRightReturn && !existingRightReturn) {
    import('../../../carcass/parts/BulkheadReturn').then(({ BulkheadReturn }) => {
      const cabinetTopY = overheadCabinet.group.position.y + overheadCabinet.carcass.dimensions.height
      const bulkheadHeight = Math.max(0, wallDimensions.height - cabinetTopY)
      const frontEdgeOffsetZ = overheadCabinet.carcass.dimensions.depth - 16
      const returnDepth = frontEdgeOffsetZ
      const returnHeight = bulkheadHeight
      const returnThickness = 16

      const childCabinets = allCabinets.filter(
        (c) =>
          c.parentCabinetId === overheadCabinet.cabinetId &&
          (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
          c.hideLockIcons === true
      )
      
      const cabinetWorldPos = new THREE.Vector3()
      overheadCabinet.group.getWorldPosition(cabinetWorldPos)
      
      const cabinetMaxX = cabinetWorldPos.x + overheadCabinet.carcass.dimensions.width
      const effectiveRightEdge = childCabinets.length > 0
        ? Math.max(cabinetMaxX, ...childCabinets.map((c) => c.group.position.x + c.carcass.dimensions.width))
        : cabinetMaxX

      const bulkheadReturnRight = new BulkheadReturn({
        height: returnHeight,
        depth: returnDepth,
        material: overheadCabinet.carcass.config.material.getMaterial(),
      })

      const returnRightWorldPos = new THREE.Vector3(
        effectiveRightEdge - returnThickness / 2,
        cabinetTopY + returnHeight / 2,
        cabinetWorldPos.z + frontEdgeOffsetZ / 2
      )

      bulkheadReturnRight.group.position.copy(returnRightWorldPos)
      bulkheadReturnRight.group.name = `bulkheadReturnRight_${overheadCabinet.cabinetId}`

      const returnRightDummyCarcass = {
        dimensions: { width: returnThickness, height: returnHeight, depth: returnDepth },
        config: overheadCabinet.carcass.config,
        updateDimensions: () => {},
        updateKickerHeight: () => {},
        updateKickerFace: () => {},
      } as any

      const returnRightCabinetData: CabinetData = {
        group: bulkheadReturnRight.group,
        carcass: returnRightDummyCarcass,
        cabinetType: 'bulkhead',
        subcategoryId: overheadCabinet.subcategoryId,
        cabinetId: `bulkheadReturnRight_${overheadCabinet.cabinetId}_${Date.now()}`,
        viewId: overheadCabinet.viewId,
        bulkheadReturn: bulkheadReturnRight,
        bulkheadReturnParentCabinetId: overheadCabinet.cabinetId,
        bulkheadReturnSide: 'right',
        hideLockIcons: true,
      }

      addCabinet(returnRightCabinetData)
      ;(overheadCabinet.group as any).bulkheadReturnRight = bulkheadReturnRight
      ;(overheadCabinet.group as any).bulkheadReturnRightCabinetData = returnRightCabinetData
    })
  }
}

