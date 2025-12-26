import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../../types"
import { getCabinetHorizontalEdges } from "../../utils/handlers/sharedCabinetUtils"
import {
  DIMENSION_CONSTANTS,
  createCompleteDimension,
  createArrow,
  createLine,
  createTextSprite,
  applyWallOffset,
  type WallOffsetContext,
} from "./dimensionLineUtils"
import {
  createDimensionLineId,
  type DimensionLineId,
} from "./dimensionLineState"
import type { DimensionLineOffset3D } from "./dimensionLineState"
import { setDimensionLineMetadata } from "./dimensionLineDrag"
import { ViewManager } from "@/features/cabinets/ViewManager"

/**
 * Interface for dimension line offset configuration
 */
export interface DimensionLineOffsets {
  getOffset: (id: DimensionLineId) => DimensionLineOffset3D
  isHidden: (id: DimensionLineId) => boolean
}

/**
 * Create width dimension line for a cabinet
 * Returns null if hidden
 * Width measures X axis, can be offset in Y (from Y/X views) or Z (from Z view)
 */
export function createWidthDimension(
  cabinet: CabinetData,
  wallOffsetContext: WallOffsetContext,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const id = createDimensionLineId("width", cabinet.cabinetId)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - width can be offset in Y or Z
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const baseOffset = DIMENSION_CONSTANTS.defaults.offset

  const { width, height, depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y
  const z = pos.z

  const isBulkhead = cabinet.cabinetType === "bulkhead"

  const { left: xLeftEdge, right: xRightEdge } = getCabinetHorizontalEdges(cabinet)
  const yTopEdge = cabinet.cabinetType === "bulkhead" ? y + height / 2 : y + height

  let dimensionZ: number
  if (cabinet.cabinetType === "bulkhead") {
    dimensionZ = z + depth / 2
  } else {
    dimensionZ = z + depth + baseOffset
  }

  const xCabinetLeft = xLeftEdge
  const xRight = xRightEdge

  // Apply 3D offset - Y offset moves up/down, Z offset moves forward/back
  let widthDimensionY: number
  let widthDimensionZ: number
  let widthLabelY: number

  if (isBulkhead) {
    widthDimensionY = yTopEdge + 100 + offset3D.y
    widthDimensionZ = dimensionZ + 20 + offset3D.z
    widthLabelY = widthDimensionY + 30
  } else {
    widthDimensionY = yTopEdge + baseOffset + offset3D.y
    widthDimensionZ = dimensionZ + offset3D.z
    widthLabelY = widthDimensionY + 30
  }

  const widthDimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(xCabinetLeft, yTopEdge, dimensionZ),
    extensionStart2: new THREE.Vector3(xRight, yTopEdge, dimensionZ),
    dimensionPoint1: new THREE.Vector3(xCabinetLeft, widthDimensionY, widthDimensionZ),
    dimensionPoint2: new THREE.Vector3(xRight, widthDimensionY, widthDimensionZ),
    labelText: `${Math.ceil(width)}mm`,
    labelPosition: new THREE.Vector3(
      (xCabinetLeft + xRight) / 2,
      widthLabelY,
      widthDimensionZ
    ),
    color,
    arrowColor,
    lineWidth,
  })

  setDimensionLineMetadata(widthDimension, id, "width")
  return widthDimension
}

/**
 * Create height dimension line for a cabinet
 * Returns null if hidden
 * Height measures Y axis, can be offset in X (from Y/Z views) or Z (from X view)
 */
export function createHeightDimension(
  cabinet: CabinetData,
  wallOffsetContext: WallOffsetContext,
  allCabinets?: CabinetData[],
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const id = createDimensionLineId("height", cabinet.cabinetId)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - height can be offset in X or Z
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const baseOffset = DIMENSION_CONSTANTS.defaults.offset

  const { width, height, depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y
  const z = pos.z

  const isBulkhead = cabinet.cabinetType === "bulkhead"

  const { left: xLeftEdge } = getCabinetHorizontalEdges(cabinet)
  let yBottomEdge: number
  let yTopEdge: number

  if (isBulkhead) {
    yBottomEdge = y - height / 2
    yTopEdge = y + height / 2
  } else {
    yBottomEdge = y
    yTopEdge = y + height
  }

  let dimensionZ: number
  if (isBulkhead) {
    dimensionZ = z + depth / 2
  } else {
    dimensionZ = z + depth + baseOffset
  }

  // Apply 3D offset - X offset moves left/right, Z offset moves forward/back
  let heightDimensionX: number
  let heightLabelX: number
  let heightDimensionZ: number

  if (
    isBulkhead &&
    cabinet.bulkheadParentCabinetId &&
    allCabinets
  ) {
    const parentCabinet = allCabinets.find(
      (c) => c.cabinetId === cabinet.bulkheadParentCabinetId
    )
    if (parentCabinet) {
      const parentX = parentCabinet.group.position.x
      const parentZ = parentCabinet.group.position.z
      const parentDepth = parentCabinet.carcass.dimensions.depth
      const parentXLeftEdge = parentX

      const parentDimensionLineX = applyWallOffset(
        parentXLeftEdge - baseOffset,
        wallOffsetContext
      )

      const parentOffsetDistance = parentXLeftEdge - parentDimensionLineX

      heightDimensionX = xLeftEdge - parentOffsetDistance + offset3D.x
      heightLabelX = heightDimensionX - 30
      heightDimensionZ = parentZ + parentDepth + baseOffset + offset3D.z
    } else {
      heightDimensionX = xLeftEdge - baseOffset + offset3D.x
      heightDimensionZ = dimensionZ + offset3D.z
      heightLabelX = heightDimensionX - 30
    }
  } else {
    const xLeft = isBulkhead
      ? xLeftEdge
      : applyWallOffset(xLeftEdge - baseOffset, wallOffsetContext)
    heightDimensionX = xLeft + offset3D.x
    heightDimensionZ = z + depth + baseOffset + offset3D.z
    heightLabelX = heightDimensionX - 30
  }

  const heightDimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(xLeftEdge, yBottomEdge, dimensionZ),
    extensionStart2: new THREE.Vector3(xLeftEdge, yTopEdge, dimensionZ),
    dimensionPoint1: new THREE.Vector3(heightDimensionX, yBottomEdge, heightDimensionZ),
    dimensionPoint2: new THREE.Vector3(heightDimensionX, yTopEdge, heightDimensionZ),
    labelText: `${Math.ceil(height)}mm`,
    labelPosition: new THREE.Vector3(
      heightLabelX,
      (yBottomEdge + yTopEdge) / 2,
      heightDimensionZ
    ),
    color,
    arrowColor,
    lineWidth,
    isVerticalText: true,
  })

  setDimensionLineMetadata(heightDimension, id, "height")
  return heightDimension
}

/**
 * Create kicker height dimension line for a cabinet
 * Returns null if hidden or not applicable
 * Kicker measures Y axis, can be offset in X (from Y/Z views) or Z (from X view)
 */
export function createKickerDimension(
  cabinet: CabinetData,
  wallOffsetContext: WallOffsetContext,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  if (cabinet.cabinetType !== "base" && cabinet.cabinetType !== "tall") {
    return null
  }

  const id = createDimensionLineId("kicker", cabinet.cabinetId)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - kicker (height-like) can be offset in X or Z
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const baseOffset = DIMENSION_CONSTANTS.defaults.offset

  const { depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y
  const z = pos.z

  const kickerHeight = y
  if (kickerHeight <= 0) return null

  const useVerticalText = kickerHeight >= 100
  const xCabinetLeft = x
  // Apply X offset
  const xLeft = applyWallOffset(xCabinetLeft - baseOffset, wallOffsetContext) + offset3D.x
  // Apply Z offset
  const dimensionZ = z + depth + baseOffset + offset3D.z

  const kickerDimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(xCabinetLeft, 0, z + depth + baseOffset),
    extensionStart2: new THREE.Vector3(xCabinetLeft, kickerHeight, z + depth + baseOffset),
    dimensionPoint1: new THREE.Vector3(xLeft, 0, dimensionZ),
    dimensionPoint2: new THREE.Vector3(xLeft, kickerHeight, dimensionZ),
    labelText: `${Math.ceil(kickerHeight)}mm`,
    labelPosition: new THREE.Vector3(xLeft - 30, kickerHeight / 2, dimensionZ),
    color,
    arrowColor,
    lineWidth,
    isVerticalText: useVerticalText,
  })

  setDimensionLineMetadata(kickerDimension, id, "kicker")
  return kickerDimension
}

/**
 * Create depth dimension line for a cabinet
 * Returns null if hidden or not applicable
 * Depth measures Z axis, can be offset in Y (from Y/X views) or X (from Z view)
 */
export function createDepthDimension(
  cabinet: CabinetData,
  wallOffsetContext: WallOffsetContext,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const isBulkhead = cabinet.cabinetType === "bulkhead"
  const isLShapeFiller = cabinet.cabinetType === "filler" && cabinet.carcass.dimensions.width === 100

  if (isBulkhead || isLShapeFiller) return null

  const id = createDimensionLineId("depth", cabinet.cabinetId)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - depth can be offset in Y or X
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const baseOffset = DIMENSION_CONSTANTS.defaults.offset

  const { height, depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y
  const z = pos.z

  // Apply X offset to the horizontal position
  const xLeft = applyWallOffset(x - baseOffset, wallOffsetContext) + offset3D.x

  // Apply Y offset to the vertical position
  const depthDimensionY = y + height + baseOffset + offset3D.y

  const depthDimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(xLeft, y + height, z),
    extensionStart2: new THREE.Vector3(xLeft, y + height, z + depth),
    dimensionPoint1: new THREE.Vector3(xLeft, depthDimensionY, z),
    dimensionPoint2: new THREE.Vector3(xLeft, depthDimensionY, z + depth),
    labelText: `${Math.ceil(depth)}mm`,
    labelPosition: new THREE.Vector3(xLeft - 30, depthDimensionY, z + depth / 2),
    color,
    arrowColor,
    lineWidth,
  })

  setDimensionLineMetadata(depthDimension, id, "depth")
  return depthDimension
}

/**
 * Create overall width dimension line across all cabinets
 * Returns null if hidden or no cabinets
 * Overall width measures X axis, can be offset in Y or Z
 */
export function createOverallWidthDimensionEnhanced(
  cabinets: CabinetData[],
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const filteredCabinets = cabinets.filter((c) => c.cabinetType !== "kicker")
  if (filteredCabinets.length === 0) return null

  const id = createDimensionLineId("overall-width", "scene")
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }

  const group = new THREE.Group()
  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const offset = DIMENSION_CONSTANTS.defaults.overallOffset
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength
  const extensionLength = DIMENSION_CONSTANTS.defaults.overallExtensionLength

  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  filteredCabinets.forEach((cabinet) => {
    const { left, right } = getCabinetHorizontalEdges(cabinet)
    const y = cabinet.group.position.y
    const height = cabinet.carcass.dimensions.height

    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    maxY = Math.max(maxY, y + height)
  })

  const overallWidth = maxX - minX
  const baseZPos =
    Math.max(...filteredCabinets.map((c) => c.group.position.z + c.carcass.dimensions.depth)) + offset
  
  // Apply 3D offset
  const zPos = baseZPos + offset3D.z
  const dimensionLineY = maxY + offset + offset3D.y

  const extensionLeft = createLine(
    new THREE.Vector3(minX, dimensionLineY - extensionLength, zPos),
    new THREE.Vector3(minX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(extensionLeft)

  const extensionRight = createLine(
    new THREE.Vector3(maxX, dimensionLineY - extensionLength, zPos),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(extensionRight)

  const mainLine = createLine(
    new THREE.Vector3(minX, dimensionLineY, zPos),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(mainLine)

  const arrowLeft = createArrow(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(minX, dimensionLineY, zPos),
    arrowColor,
    arrowHeadLength
  )
  const arrowRight = createArrow(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    arrowColor,
    arrowHeadLength
  )
  group.add(arrowLeft)
  group.add(arrowRight)

  const textSprite = createTextSprite({
    text: `Overall: ${Math.ceil(overallWidth)}mm`,
    position: new THREE.Vector3((minX + maxX) / 2, dimensionLineY + 40, zPos),
    color: DIMENSION_CONSTANTS.colorStrings.overall,
    scale: DIMENSION_CONSTANTS.text.wideScale,
  })
  if (textSprite) group.add(textSprite)

  setDimensionLineMetadata(group, id, "overall-width")
  return group
}

/**
 * Create overall height dimension line for a view
 * Returns null if hidden or no cabinets
 */
export function createOverallHeightDimensionEnhanced(
  cabinets: CabinetData[],
  viewManager: ViewManager,
  wallDimensions?: WallDimensions,
  offsets?: DimensionLineOffsets
): THREE.Group[] {
  const groups: THREE.Group[] = []
  if (cabinets.length === 0) return groups

  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength
  const backWallLength = wallDimensions?.backWallLength ?? wallDimensions?.length ?? 4000
  const leftWallOffset = -250
  const rightWallOffset = backWallLength + 250

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const id = createDimensionLineId("overall-height", viewId)
    
    if (offsets?.isHidden(id)) return
    
    // Get 3D offset - overall height can be offset in X or Z
    const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter(
      (c) => cabinetIds.includes(c.cabinetId) && c.cabinetType !== "kicker"
    )

    if (viewCabinets.length === 0) return

    let maxTopY = -Infinity
    viewCabinets.forEach((cabinet) => {
      const topY = cabinet.group.position.y + cabinet.carcass.dimensions.height
      if (topY > maxTopY) {
        maxTopY = topY
      }
    })

    const overallHeight = maxTopY
    const baseZPos =
      Math.max(...viewCabinets.map((c) => c.group.position.z + c.carcass.dimensions.depth)) + 50
    const zPos = baseZPos + offset3D.z
    const extensionLength = DIMENSION_CONSTANTS.defaults.overallExtensionLength

    const sceneCenterX = backWallLength / 2
    const tallCabinets = viewCabinets.filter((c) => c.cabinetType === "tall")

    let tallCabinetsOnLeft = 0
    let tallCabinetsOnRight = 0

    tallCabinets.forEach((cabinet) => {
      const cabinetCenterX = cabinet.group.position.x + cabinet.carcass.dimensions.width / 2
      if (cabinetCenterX < sceneCenterX) {
        tallCabinetsOnLeft++
      } else {
        tallCabinetsOnRight++
      }
    })

    // Apply X offset
    const baseDimensionX = tallCabinetsOnRight > tallCabinetsOnLeft ? rightWallOffset : leftWallOffset
    const dimensionX = baseDimensionX + offset3D.x
    const isRightWall = baseDimensionX === rightWallOffset

    const group = new THREE.Group()

    const extensionBottom = createLine(
      new THREE.Vector3(dimensionX, 0, zPos),
      new THREE.Vector3(
        isRightWall ? dimensionX - extensionLength : dimensionX + extensionLength,
        0,
        zPos
      ),
      color,
      lineWidth
    )
    group.add(extensionBottom)

    const extensionTop = createLine(
      new THREE.Vector3(dimensionX, overallHeight, zPos),
      new THREE.Vector3(
        isRightWall ? dimensionX - extensionLength : dimensionX + extensionLength,
        overallHeight,
        zPos
      ),
      color,
      lineWidth
    )
    group.add(extensionTop)

    const mainLine = createLine(
      new THREE.Vector3(dimensionX, 0, zPos),
      new THREE.Vector3(dimensionX, overallHeight, zPos),
      color,
      lineWidth
    )
    group.add(mainLine)

    const arrowBottom = createArrow(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(dimensionX, 0, zPos),
      arrowColor,
      arrowHeadLength
    )
    const arrowTop = createArrow(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dimensionX, overallHeight, zPos),
      arrowColor,
      arrowHeadLength
    )
    group.add(arrowBottom)
    group.add(arrowTop)

    const textOffset = isRightWall ? 30 : -30
    const textSprite = createTextSprite({
      text: `Overall: ${Math.ceil(overallHeight)}mm`,
      position: new THREE.Vector3(dimensionX + textOffset, overallHeight / 2, zPos),
      color: DIMENSION_CONSTANTS.colorStrings.overall,
      isVertical: true,
    })
    if (textSprite) group.add(textSprite)

    setDimensionLineMetadata(group, id, "overall-height")
    groups.push(group)
  })

  return groups
}

/**
 * Create base/tall overall width dimension line
 * Returns null if hidden or not needed
 * Base-tall width measures X axis, can be offset in Y or Z
 */
export function createBaseTallOverallWidthDimensionEnhanced(
  cabinets: CabinetData[],
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const baseTallCabinets = cabinets.filter(
    (c) => c.cabinetType === "base" || c.cabinetType === "tall"
  )

  if (baseTallCabinets.length === 0) return null

  const id = createDimensionLineId("base-tall-width", "scene")
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }

  const group = new THREE.Group()
  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const offset = DIMENSION_CONSTANTS.defaults.overallOffset
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity

  baseTallCabinets.forEach((cabinet) => {
    const { left, right } = getCabinetHorizontalEdges(cabinet)
    const y = cabinet.group.position.y

    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    minY = Math.min(minY, y)
  })

  const overallWidth = maxX - minX
  const baseZPos =
    Math.max(...baseTallCabinets.map((c) => c.group.position.z + c.carcass.dimensions.depth)) +
    offset
  const zPos = baseZPos + offset3D.z
  const extensionLength = DIMENSION_CONSTANTS.defaults.overallExtensionLength

  // Apply Y offset
  const dimensionLineY = minY - offset + offset3D.y

  const extensionLeft = createLine(
    new THREE.Vector3(minX, dimensionLineY + extensionLength, zPos),
    new THREE.Vector3(minX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(extensionLeft)

  const extensionRight = createLine(
    new THREE.Vector3(maxX, dimensionLineY + extensionLength, zPos),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(extensionRight)

  const mainLine = createLine(
    new THREE.Vector3(minX, dimensionLineY, zPos),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    color,
    lineWidth
  )
  group.add(mainLine)

  const arrowLeft = createArrow(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(minX, dimensionLineY, zPos),
    arrowColor,
    arrowHeadLength
  )
  const arrowRight = createArrow(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(maxX, dimensionLineY, zPos),
    arrowColor,
    arrowHeadLength
  )
  group.add(arrowLeft)
  group.add(arrowRight)

  const textSprite = createTextSprite({
    text: `Overall: ${Math.ceil(overallWidth)}mm`,
    position: new THREE.Vector3((minX + maxX) / 2, dimensionLineY + 40, zPos),
    color: DIMENSION_CONSTANTS.colorStrings.overall,
    scale: DIMENSION_CONSTANTS.text.extraWideScale,
    canvasWidth: DIMENSION_CONSTANTS.text.wideCanvasWidth,
  })
  if (textSprite) group.add(textSprite)

  setDimensionLineMetadata(group, id, "base-tall-width")
  return group
}

/**
 * Create empty space Y dimension line
 * Returns null if hidden
 * Empty-Y measures Y axis, can be offset in X or Z
 */
export function createEmptySpaceYDimensionEnhanced(
  bottomY: number,
  topY: number,
  height: number,
  x: number,
  z: number,
  viewId: string,
  index: number,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const id = createDimensionLineId("empty-y", `${viewId}-${index}`)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - empty-y can be offset in X or Z
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.emptySpace
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  // Apply X and Z offsets
  const dimensionLineX = -200 + offset3D.x
  const dimensionLineZ = z + offset3D.z

  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(x, bottomY, z),
    extensionStart2: new THREE.Vector3(x, topY, z),
    dimensionPoint1: new THREE.Vector3(dimensionLineX, bottomY, dimensionLineZ),
    dimensionPoint2: new THREE.Vector3(dimensionLineX, topY, dimensionLineZ),
    labelText: `${Math.ceil(height)}mm`,
    labelPosition: new THREE.Vector3(dimensionLineX - 30, bottomY + height / 2, dimensionLineZ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.emptySpace,
    lineWidth,
    isVerticalText: true,
  })

  setDimensionLineMetadata(dimension, id, "empty-y")
  return dimension
}

/**
 * Create empty space X dimension line
 * Returns null if hidden
 * Empty-X measures X axis, can be offset in Y or Z
 */
export function createEmptySpaceXDimensionEnhanced(
  leftX: number,
  rightX: number,
  width: number,
  topY: number,
  leftCabinetType: string,
  rightCabinetType: string,
  baseTopY: number,
  z: number,
  wallOffsetContext: WallOffsetContext,
  viewId: string,
  index: number,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  const id = createDimensionLineId("empty-x", `${viewId}-${index}`)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset - empty-x can be offset in Y or Z
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.emptySpace
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const extensionOffset = DIMENSION_CONSTANTS.defaults.extensionOffset

  const leftXOffset = applyWallOffset(leftX, wallOffsetContext)
  const rightXOffset = applyWallOffset(rightX, wallOffsetContext)

  const isBaseToBase = leftCabinetType === "base" && rightCabinetType === "base"
  const isBaseToTall =
    (leftCabinetType === "base" && rightCabinetType === "tall") ||
    (leftCabinetType === "tall" && rightCabinetType === "base")

  let extensionStartY: number

  if (isBaseToBase) {
    extensionStartY = topY
  } else if (isBaseToTall) {
    extensionStartY = baseTopY
  } else {
    extensionStartY = topY
  }

  // Apply Y and Z offsets
  const dimensionLineY = extensionStartY + extensionOffset + offset3D.y
  const dimensionLineZ = z + offset3D.z

  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(leftXOffset, extensionStartY, z),
    extensionStart2: new THREE.Vector3(rightXOffset, extensionStartY, z),
    dimensionPoint1: new THREE.Vector3(leftXOffset, dimensionLineY, dimensionLineZ),
    dimensionPoint2: new THREE.Vector3(rightXOffset, dimensionLineY, dimensionLineZ),
    labelText: `${Math.ceil(width)}mm`,
    labelPosition: new THREE.Vector3(
      (leftXOffset + rightXOffset) / 2,
      dimensionLineY + 30,
      dimensionLineZ
    ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.emptySpace,
    lineWidth,
  })

  setDimensionLineMetadata(dimension, id, "empty-x")
  return dimension
}

/**
 * Create height from floor dimension line for independent benchtops
 * Shows vertical dimension from floor (Y=0) to benchtop position
 * Returns null if hidden or if benchtop has a parent
 */
export function createBenchtopHeightFromFloorDimension(
  cabinet: CabinetData,
  offsets?: DimensionLineOffsets
): THREE.Group | null {
  // Only for independent benchtops (no parent)
  if (cabinet.cabinetType !== "benchtop" || cabinet.benchtopParentCabinetId) {
    return null
  }

  const id = createDimensionLineId("benchtop-height", cabinet.cabinetId)
  
  if (offsets?.isHidden(id)) return null
  
  // Get 3D offset
  const offset3D = offsets?.getOffset(id) ?? { x: 0, y: 0, z: 0 }
  
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const baseOffset = DIMENSION_CONSTANTS.defaults.offset

  const { width, depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y  // This is the height from floor
  const z = pos.z

  // Dimension line at the front-right edge of the benchtop
  const frontZ = z + depth + baseOffset
  const rightX = x + width

  // Apply offsets
  const dimensionLineX = rightX + baseOffset + offset3D.x
  const dimensionLineZ = frontZ + offset3D.z

  // Create dimension from floor (Y=0) to benchtop Y position
  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(rightX, 0, frontZ),
    extensionStart2: new THREE.Vector3(rightX, y, frontZ),
    dimensionPoint1: new THREE.Vector3(dimensionLineX, 0, dimensionLineZ),
    dimensionPoint2: new THREE.Vector3(dimensionLineX, y, dimensionLineZ),
    labelText: `${Math.ceil(y)}mm`,
    labelPosition: new THREE.Vector3(dimensionLineX + 40, y / 2, dimensionLineZ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.cabinet,
    lineWidth,
    isVerticalText: true,
  })

  setDimensionLineMetadata(dimension, id, "benchtop-height")
  return dimension
}