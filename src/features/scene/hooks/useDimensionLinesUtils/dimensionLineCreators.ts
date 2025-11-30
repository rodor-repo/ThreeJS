import * as THREE from "three"
import type { CabinetData } from "../../types"
import type { ViewManager, ViewId } from "../../../cabinets/ViewManager"
import type { WallDimensions } from "../../types"
import {
  DIMENSION_CONSTANTS,
  createArrow,
  createLine,
  createTextSprite,
  createCompleteDimension,
  applyWallOffset,
  type WallOffsetContext,
} from "./dimensionLineUtils"

/**
 * Check if a dimension line drawn on the left side of a cabinet would penetrate/overlap with another cabinet
 */
export function wouldDimensionLinePenetrate(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  offset: number = 50
): boolean {
  const cabinetX = cabinet.group.position.x
  const cabinetY = cabinet.group.position.y
  const cabinetHeight = cabinet.carcass.dimensions.height
  const cabinetZ = cabinet.group.position.z
  const cabinetDepth = cabinet.carcass.dimensions.depth

  // Dimension line is drawn at x - offset (to the left of the cabinet)
  const dimensionLineX = cabinetX - offset

  // Check if any other cabinet overlaps with the space where the dimension line would be
  for (const other of allCabinets) {
    if (other === cabinet) continue

    const otherX = other.group.position.x
    const otherWidth = other.carcass.dimensions.width
    const otherY = other.group.position.y
    const otherHeight = other.carcass.dimensions.height
    const otherZ = other.group.position.z
    const otherDepth = other.carcass.dimensions.depth

    const otherLeft = otherX
    const otherRight = otherX + otherWidth
    const otherBottom = otherY
    const otherTop = otherY + otherHeight
    const otherFront = otherZ + otherDepth

    // Check if the dimension line X position is within the other cabinet's X range
    const xOverlap = dimensionLineX >= otherLeft && dimensionLineX <= otherRight

    if (xOverlap) {
      // Check if there's vertical overlap (for height dimension) or Z overlap (for depth dimension)
      const heightYOverlap =
        cabinetY < otherTop && cabinetY + cabinetHeight > otherBottom
      const dimensionLineZ = cabinetZ + cabinetDepth + 50
      const depthZOverlap =
        dimensionLineZ >= otherZ && dimensionLineZ <= otherFront

      if (heightYOverlap || depthZOverlap) {
        return true
      }
    }
  }

  return false
}

/**
 * Create dimension line group for a single cabinet
 */
export function createCabinetDimensionLines(
  cabinet: CabinetData,
  wallOffsetContext: WallOffsetContext,
  showHeight: boolean = true,
  showDepth: boolean = true,
  showKickerHeight: boolean = false
): THREE.Group {
  const group = new THREE.Group()
  const color = DIMENSION_CONSTANTS.colors.cabinet
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const offset = DIMENSION_CONSTANTS.defaults.offset

  const { width, height, depth } = cabinet.carcass.dimensions
  const pos = cabinet.group.position
  const x = pos.x
  const y = pos.y
  const z = pos.z

  // Apply wall offsets to X positions for dimension lines
  const xLeft = applyWallOffset(x - offset, wallOffsetContext)
  const xRight = x + width
  const xCabinetLeft = x

  // WIDTH dimension (along X axis) - at top front
  const widthDimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(
      xCabinetLeft,
      y + height,
      z + depth + offset
    ),
    extensionStart2: new THREE.Vector3(xRight, y + height, z + depth + offset),
    dimensionPoint1: new THREE.Vector3(
      xCabinetLeft,
      y + height + offset,
      z + depth + offset
    ),
    dimensionPoint2: new THREE.Vector3(
      xRight,
      y + height + offset,
      z + depth + offset
    ),
    labelText: `${width}mm`,
    labelPosition: new THREE.Vector3(
      (xCabinetLeft + xRight) / 2,
      y + height + offset + 30,
      z + depth + offset
    ),
    color,
    arrowColor,
    lineWidth,
  })
  group.add(widthDimension)

  // HEIGHT dimension (along Y axis) - at left front
  if (showHeight) {
    const heightDimension = createCompleteDimension({
      extensionStart1: new THREE.Vector3(xCabinetLeft, y, z + depth + offset),
      extensionStart2: new THREE.Vector3(
        xCabinetLeft,
        y + height,
        z + depth + offset
      ),
      dimensionPoint1: new THREE.Vector3(xLeft, y, z + depth + offset),
      dimensionPoint2: new THREE.Vector3(xLeft, y + height, z + depth + offset),
      labelText: `${height}mm`,
      labelPosition: new THREE.Vector3(
        xLeft - 30,
        y + height / 2,
        z + depth + offset
      ),
      color,
      arrowColor,
      lineWidth,
      isVerticalText: true,
    })
    group.add(heightDimension)
  }

  // KICKER HEIGHT dimension (base/tall cabinets only)
  if (
    showKickerHeight &&
    (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall")
  ) {
    const kickerHeight = y // Y position equals kicker height for base/tall

    const kickerDimension = createCompleteDimension({
      extensionStart1: new THREE.Vector3(xCabinetLeft, 0, z + depth + offset),
      extensionStart2: new THREE.Vector3(
        xCabinetLeft,
        kickerHeight,
        z + depth + offset
      ),
      dimensionPoint1: new THREE.Vector3(xLeft, 0, z + depth + offset),
      dimensionPoint2: new THREE.Vector3(
        xLeft,
        kickerHeight,
        z + depth + offset
      ),
      labelText: `${kickerHeight.toFixed(0)}mm`,
      labelPosition: new THREE.Vector3(
        xLeft - 30,
        kickerHeight / 2,
        z + depth + offset
      ),
      color,
      arrowColor,
      lineWidth,
      isVerticalText: true,
    })
    group.add(kickerDimension)
  }

  // DEPTH dimension (along Z axis) - at top left
  if (showDepth) {
    const depthDimension = createCompleteDimension({
      extensionStart1: new THREE.Vector3(xLeft, y + height, z),
      extensionStart2: new THREE.Vector3(xLeft, y + height, z + depth),
      dimensionPoint1: new THREE.Vector3(xLeft, y + height + offset, z),
      dimensionPoint2: new THREE.Vector3(xLeft, y + height + offset, z + depth),
      labelText: `${depth}mm`,
      labelPosition: new THREE.Vector3(
        xLeft - 30,
        y + height + offset,
        z + depth / 2
      ),
      color,
      arrowColor,
      lineWidth,
    })
    group.add(depthDimension)
  }

  return group
}

/**
 * Create overall width dimension line across all cabinets
 */
export function createOverallWidthDimension(
  cabinets: CabinetData[]
): THREE.Group | null {
  if (cabinets.length === 0) return null

  const group = new THREE.Group()
  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const offset = DIMENSION_CONSTANTS.defaults.overallOffset
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength

  // Find min and max X positions, and max Y (top) position
  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  cabinets.forEach((cabinet) => {
    const x = cabinet.group.position.x
    const y = cabinet.group.position.y
    const width = cabinet.carcass.dimensions.width
    const height = cabinet.carcass.dimensions.height

    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  })

  const overallWidth = maxX - minX
  const zPos =
    Math.max(
      ...cabinets.map((c) => c.group.position.z + c.carcass.dimensions.depth)
    ) + offset

  // Find the leftmost and rightmost cabinets for extension lines
  let leftmostCabinet: CabinetData | undefined
  let rightmostCabinet: CabinetData | undefined
  let leftmostX = Infinity
  let rightmostX = -Infinity

  cabinets.forEach((cabinet) => {
    const x = cabinet.group.position.x
    const width = cabinet.carcass.dimensions.width

    if (x < leftmostX) {
      leftmostX = x
      leftmostCabinet = cabinet
    }

    if (x + width > rightmostX) {
      rightmostX = x + width
      rightmostCabinet = cabinet
    }
  })

  // Extension lines
  if (leftmostCabinet) {
    const leftCabHeight = leftmostCabinet.carcass.dimensions.height
    const leftCabY = leftmostCabinet.group.position.y
    const extensionLeft = createLine(
      new THREE.Vector3(minX, leftCabY + leftCabHeight, zPos),
      new THREE.Vector3(minX, maxY + offset, zPos),
      color,
      lineWidth
    )
    group.add(extensionLeft)
  }

  if (rightmostCabinet) {
    const rightCabHeight = rightmostCabinet.carcass.dimensions.height
    const rightCabY = rightmostCabinet.group.position.y
    const extensionRight = createLine(
      new THREE.Vector3(maxX, rightCabY + rightCabHeight, zPos),
      new THREE.Vector3(maxX, maxY + offset, zPos),
      color,
      lineWidth
    )
    group.add(extensionRight)
  }

  // Main dimension line
  const mainLine = createLine(
    new THREE.Vector3(minX, maxY + offset, zPos),
    new THREE.Vector3(maxX, maxY + offset, zPos),
    color,
    lineWidth
  )
  group.add(mainLine)

  // Arrows
  const arrowLeft = createArrow(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(minX, maxY + offset, zPos),
    arrowColor,
    arrowHeadLength
  )
  const arrowRight = createArrow(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(maxX, maxY + offset, zPos),
    arrowColor,
    arrowHeadLength
  )
  group.add(arrowLeft)
  group.add(arrowRight)

  // Text label
  const textSprite = createTextSprite({
    text: `Overall: ${overallWidth.toFixed(0)}mm`,
    position: new THREE.Vector3((minX + maxX) / 2, maxY + offset + 40, zPos),
    color: DIMENSION_CONSTANTS.colorStrings.overall,
    scale: DIMENSION_CONSTANTS.text.wideScale,
  })
  if (textSprite) group.add(textSprite)

  return group
}

/**
 * Create overall height dimension line for each view
 */
export function createOverallHeightDimension(
  cabinets: CabinetData[],
  viewManager: ViewManager,
  wallDimensions?: WallDimensions
): THREE.Group[] {
  const groups: THREE.Group[] = []

  if (cabinets.length === 0) return groups

  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength
  const backWallLength =
    wallDimensions?.backWallLength ?? wallDimensions?.length ?? 4000
  const leftWallOffset = -250
  const rightWallOffset = backWallLength + 250

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId)
    )

    if (viewCabinets.length === 0) return

    // Find tallest cabinet
    let tallestCabinet: CabinetData | undefined
    let maxTopY = -Infinity

    viewCabinets.forEach((cabinet) => {
      const topY = cabinet.group.position.y + cabinet.carcass.dimensions.height
      if (topY > maxTopY) {
        maxTopY = topY
        tallestCabinet = cabinet
      }
    })

    if (!tallestCabinet) return

    const overallHeight = maxTopY
    const zPos =
      Math.max(
        ...viewCabinets.map(
          (c) => c.group.position.z + c.carcass.dimensions.depth
        )
      ) + 50
    const tallestCabinetX =
      tallestCabinet.group.position.x +
      tallestCabinet.carcass.dimensions.width / 2

    // Find leftmost X for extension line
    let leftmostX = Infinity
    viewCabinets.forEach((cabinet) => {
      leftmostX = Math.min(leftmostX, cabinet.group.position.x)
    })

    // Count Tall cabinets on left vs right side
    const sceneCenterX = backWallLength / 2
    const tallCabinets = viewCabinets.filter((c) => c.cabinetType === "tall")

    let tallCabinetsOnLeft = 0
    let tallCabinetsOnRight = 0

    tallCabinets.forEach((cabinet) => {
      const cabinetCenterX =
        cabinet.group.position.x + cabinet.carcass.dimensions.width / 2
      if (cabinetCenterX < sceneCenterX) {
        tallCabinetsOnLeft++
      } else {
        tallCabinetsOnRight++
      }
    })

    const dimensionX =
      tallCabinetsOnRight > tallCabinetsOnLeft
        ? rightWallOffset
        : leftWallOffset
    const isRightWall = dimensionX === rightWallOffset

    const group = new THREE.Group()

    // Extension lines
    const extensionBottom = createLine(
      new THREE.Vector3(leftmostX, 0, zPos),
      new THREE.Vector3(dimensionX, 0, zPos),
      color,
      lineWidth
    )
    group.add(extensionBottom)

    const extensionTop = createLine(
      new THREE.Vector3(tallestCabinetX, overallHeight, zPos),
      new THREE.Vector3(dimensionX, overallHeight, zPos),
      color,
      lineWidth
    )
    group.add(extensionTop)

    // Main dimension line
    const mainLine = createLine(
      new THREE.Vector3(dimensionX, 0, zPos),
      new THREE.Vector3(dimensionX, overallHeight, zPos),
      color,
      lineWidth
    )
    group.add(mainLine)

    // Arrows
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

    // Text label
    const textOffset = isRightWall ? 30 : -30
    const textSprite = createTextSprite({
      text: `Overall: ${overallHeight.toFixed(0)}mm`,
      position: new THREE.Vector3(
        dimensionX + textOffset,
        overallHeight / 2,
        zPos
      ),
      color: DIMENSION_CONSTANTS.colorStrings.overall,
      isVertical: true,
    })
    if (textSprite) group.add(textSprite)

    groups.push(group)
  })

  return groups
}

/**
 * Create overall width dimension line for base and tall cabinets only
 */
export function createBaseTallOverallWidthDimension(
  cabinets: CabinetData[]
): THREE.Group | null {
  const baseTallCabinets = cabinets.filter(
    (c) => c.cabinetType === "base" || c.cabinetType === "tall"
  )

  if (baseTallCabinets.length === 0) return null

  const group = new THREE.Group()
  const color = DIMENSION_CONSTANTS.colors.overall
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = 3
  const offset = DIMENSION_CONSTANTS.defaults.overallOffset
  const arrowHeadLength = DIMENSION_CONSTANTS.defaults.overallArrowHeadLength

  // Find min and max X positions, and min Y (bottom) position
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity

  baseTallCabinets.forEach((cabinet) => {
    const x = cabinet.group.position.x
    const y = cabinet.group.position.y
    const width = cabinet.carcass.dimensions.width

    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + width)
    minY = Math.min(minY, y)
  })

  const overallWidth = maxX - minX
  const zPos =
    Math.max(
      ...baseTallCabinets.map(
        (c) => c.group.position.z + c.carcass.dimensions.depth
      )
    ) + offset

  // Find leftmost and rightmost cabinets
  let leftmostCabinet: CabinetData | undefined
  let rightmostCabinet: CabinetData | undefined
  let leftmostX = Infinity
  let rightmostX = -Infinity

  baseTallCabinets.forEach((cabinet) => {
    const x = cabinet.group.position.x
    const width = cabinet.carcass.dimensions.width

    if (x < leftmostX) {
      leftmostX = x
      leftmostCabinet = cabinet
    }

    if (x + width > rightmostX) {
      rightmostX = x + width
      rightmostCabinet = cabinet
    }
  })

  // Extension lines
  if (leftmostCabinet) {
    const extensionLeft = createLine(
      new THREE.Vector3(minX, leftmostCabinet.group.position.y, zPos),
      new THREE.Vector3(minX, minY - offset, zPos),
      color,
      lineWidth
    )
    group.add(extensionLeft)
  }

  if (rightmostCabinet) {
    const extensionRight = createLine(
      new THREE.Vector3(maxX, rightmostCabinet.group.position.y, zPos),
      new THREE.Vector3(maxX, minY - offset, zPos),
      color,
      lineWidth
    )
    group.add(extensionRight)
  }

  // Main dimension line
  const mainLine = createLine(
    new THREE.Vector3(minX, minY - offset, zPos),
    new THREE.Vector3(maxX, minY - offset, zPos),
    color,
    lineWidth
  )
  group.add(mainLine)

  // Arrows
  const arrowLeft = createArrow(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(minX, minY - offset, zPos),
    arrowColor,
    arrowHeadLength
  )
  const arrowRight = createArrow(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(maxX, minY - offset, zPos),
    arrowColor,
    arrowHeadLength
  )
  group.add(arrowLeft)
  group.add(arrowRight)

  // Text label
  const textSprite = createTextSprite({
    text: `Overall: ${overallWidth.toFixed(0)}mm`,
    position: new THREE.Vector3((minX + maxX) / 2, minY - offset + 40, zPos),
    color: DIMENSION_CONSTANTS.colorStrings.overall,
    scale: DIMENSION_CONSTANTS.text.extraWideScale,
    canvasWidth: DIMENSION_CONSTANTS.text.wideCanvasWidth,
  })
  if (textSprite) group.add(textSprite)

  return group
}

// ==================== Empty Space Detection ====================

export interface EmptySpaceY {
  bottomY: number
  topY: number
  height: number
  leftmostX: number
  viewId: ViewId
}

export interface EmptySpaceX {
  leftX: number
  rightX: number
  width: number
  topY: number
  y: number
  leftCabinetType: string
  rightCabinetType: string
  baseTopY: number
  viewId: ViewId
}

export interface EmptySpaceXOverhead {
  leftX: number
  rightX: number
  width: number
  topY: number
  viewId: ViewId
}

/**
 * Detect empty spaces in Y-axis (height) between cabinets in the same view
 */
export function detectEmptySpacesY(
  cabinets: CabinetData[],
  viewManager: ViewManager
): EmptySpaceY[] {
  const emptySpaces: EmptySpaceY[] = []

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId)
    )

    if (viewCabinets.length < 2) return

    // Group cabinets by X position ranges for vertical gaps
    const xRanges: Array<{
      minX: number
      maxX: number
      cabinets: CabinetData[]
    }> = []

    viewCabinets.forEach((cabinet) => {
      const x = cabinet.group.position.x
      const width = cabinet.carcass.dimensions.width
      const minX = x
      const maxX = x + width

      let foundRange = false
      for (const range of xRanges) {
        if (!(maxX < range.minX || minX > range.maxX)) {
          range.minX = Math.min(range.minX, minX)
          range.maxX = Math.max(range.maxX, maxX)
          range.cabinets.push(cabinet)
          foundRange = true
          break
        }
      }

      if (!foundRange) {
        xRanges.push({ minX, maxX, cabinets: [cabinet] })
      }
    })

    // Find vertical gaps in each X range
    xRanges.forEach((range) => {
      const sortedCabinets = [...range.cabinets].sort(
        (a, b) => a.group.position.y - b.group.position.y
      )

      for (let i = 0; i < sortedCabinets.length - 1; i++) {
        const lowerCabinet = sortedCabinets[i]
        const upperCabinet = sortedCabinets[i + 1]

        const lowerType = lowerCabinet.cabinetType
        const upperType = upperCabinet.cabinetType

        const isBaseOrTall = lowerType === "base" || lowerType === "tall"
        const isTop = upperType === "top"

        if (isBaseOrTall && isTop) {
          const lowerTop =
            lowerCabinet.group.position.y +
            lowerCabinet.carcass.dimensions.height
          const upperBottom = upperCabinet.group.position.y

          if (upperBottom > lowerTop) {
            const gapHeight = upperBottom - lowerTop

            if (gapHeight <= 0.1) continue

            const topCabinetsInRange = range.cabinets.filter(
              (c) => c.cabinetType === "top"
            )
            if (topCabinetsInRange.length > 0) {
              let minTopX = Infinity
              let maxTopX = -Infinity
              topCabinetsInRange.forEach((cab) => {
                minTopX = Math.min(minTopX, cab.group.position.x)
                maxTopX = Math.max(
                  maxTopX,
                  cab.group.position.x + cab.carcass.dimensions.width
                )
              })
              const centerX = (minTopX + maxTopX) / 2

              emptySpaces.push({
                bottomY: lowerTop,
                topY: upperBottom,
                height: gapHeight,
                leftmostX: centerX,
                viewId,
              })
            }
          }
        }
      }
    })

    // Check Base/Tall-Top gaps without X overlap requirement
    const baseTallCabinets = viewCabinets.filter(
      (c) => c.cabinetType === "base" || c.cabinetType === "tall"
    )
    const topCabinetsForSplashback = viewCabinets.filter(
      (c) => c.cabinetType === "top"
    )

    baseTallCabinets.forEach((baseTallCabinet) => {
      topCabinetsForSplashback.forEach((topCabinet) => {
        const baseTallTop =
          baseTallCabinet.group.position.y +
          baseTallCabinet.carcass.dimensions.height
        const topBottom = topCabinet.group.position.y

        if (topBottom > baseTallTop) {
          const gapHeight = topBottom - baseTallTop

          if (gapHeight <= 0.1) return

          const alreadyDetected = emptySpaces.some(
            (space) =>
              space.viewId === viewId &&
              Math.abs(space.bottomY - baseTallTop) < 0.1 &&
              Math.abs(space.topY - topBottom) < 0.1 &&
              Math.abs(space.height - gapHeight) < 0.1
          )

          if (alreadyDetected) return

          let centerX: number
          if (topCabinetsForSplashback.length > 0) {
            let minTopX = Infinity
            let maxTopX = -Infinity
            topCabinetsForSplashback.forEach((cab) => {
              minTopX = Math.min(minTopX, cab.group.position.x)
              maxTopX = Math.max(
                maxTopX,
                cab.group.position.x + cab.carcass.dimensions.width
              )
            })
            centerX = (minTopX + maxTopX) / 2
          } else {
            const baseTallCenterX =
              baseTallCabinet.group.position.x +
              baseTallCabinet.carcass.dimensions.width / 2
            const topCenterX =
              topCabinet.group.position.x +
              topCabinet.carcass.dimensions.width / 2
            centerX = (baseTallCenterX + topCenterX) / 2
          }

          emptySpaces.push({
            bottomY: baseTallTop,
            topY: topBottom,
            height: gapHeight,
            leftmostX: centerX,
            viewId,
          })
        }
      })
    })

    // Check Top-Tall gaps
    const topCabinets = viewCabinets.filter((c) => c.cabinetType === "top")
    const tallCabinets = viewCabinets.filter((c) => c.cabinetType === "tall")

    topCabinets.forEach((topCabinet) => {
      tallCabinets.forEach((tallCabinet) => {
        const topCabTop =
          topCabinet.group.position.y + topCabinet.carcass.dimensions.height
        const tallCabTop =
          tallCabinet.group.position.y + tallCabinet.carcass.dimensions.height

        const gapHeight = Math.abs(tallCabTop - topCabTop)

        if (gapHeight <= 0.1) return

        const centerX =
          topCabinet.group.position.x + topCabinet.carcass.dimensions.width / 2
        const bottomY = Math.min(topCabTop, tallCabTop)
        const topY = Math.max(topCabTop, tallCabTop)

        emptySpaces.push({
          bottomY,
          topY,
          height: gapHeight,
          leftmostX: centerX,
          viewId,
        })
      })
    })
  })

  return emptySpaces
}

/**
 * Detect empty spaces in X-axis between overhead and tall cabinets
 */
export function detectEmptySpacesXOverhead(
  cabinets: CabinetData[],
  viewManager: ViewManager
): EmptySpaceXOverhead[] {
  const emptySpaces: EmptySpaceXOverhead[] = []

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId)
    )

    const topCabinets = viewCabinets.filter((c) => c.cabinetType === "top")
    const tallCabinets = viewCabinets.filter((c) => c.cabinetType === "tall")
    const topAndTallCabinets = [...topCabinets, ...tallCabinets]

    if (topAndTallCabinets.length < 2) return

    // Group by Y position ranges
    const yRanges: Array<{
      minY: number
      maxY: number
      cabinets: CabinetData[]
    }> = []

    topAndTallCabinets.forEach((cabinet) => {
      const y = cabinet.group.position.y
      const height = cabinet.carcass.dimensions.height
      const minY = y
      const maxY = y + height

      let foundRange = false
      for (const range of yRanges) {
        if (!(maxY < range.minY || minY > range.maxY)) {
          range.minY = Math.min(range.minY, minY)
          range.maxY = Math.max(range.maxY, maxY)
          range.cabinets.push(cabinet)
          foundRange = true
          break
        }
      }

      if (!foundRange) {
        yRanges.push({ minY, maxY, cabinets: [cabinet] })
      }
    })

    // Find horizontal gaps in each Y range
    yRanges.forEach((range) => {
      const sortedCabinets = [...range.cabinets].sort(
        (a, b) => a.group.position.x - b.group.position.x
      )

      for (let i = 0; i < sortedCabinets.length - 1; i++) {
        const leftCabinet = sortedCabinets[i]
        const rightCabinet = sortedCabinets[i + 1]

        const leftType = leftCabinet.cabinetType
        const rightType = rightCabinet.cabinetType

        if (
          (leftType !== "top" && leftType !== "tall") ||
          (rightType !== "top" && rightType !== "tall")
        ) {
          continue
        }

        const leftRight =
          leftCabinet.group.position.x + leftCabinet.carcass.dimensions.width
        const rightLeft = rightCabinet.group.position.x

        if (rightLeft > leftRight) {
          const gapWidth = rightLeft - leftRight

          if (gapWidth <= 0.1) continue

          const leftTopY =
            leftCabinet.group.position.y + leftCabinet.carcass.dimensions.height
          const rightTopY =
            rightCabinet.group.position.y +
            rightCabinet.carcass.dimensions.height
          const topY = Math.max(leftTopY, rightTopY)

          emptySpaces.push({
            leftX: leftRight,
            rightX: rightLeft,
            width: gapWidth,
            topY,
            viewId,
          })
        }
      }
    })
  })

  return emptySpaces
}

/**
 * Detect empty spaces in X-axis between cabinets
 */
export function detectEmptySpacesX(
  cabinets: CabinetData[],
  viewManager: ViewManager
): EmptySpaceX[] {
  const emptySpaces: EmptySpaceX[] = []

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId)
    )

    if (viewCabinets.length < 2) return

    // Group cabinets by Y position ranges
    const yRanges: Array<{
      minY: number
      maxY: number
      cabinets: CabinetData[]
    }> = []

    viewCabinets.forEach((cabinet) => {
      const y = cabinet.group.position.y
      const height = cabinet.carcass.dimensions.height
      const minY = y
      const maxY = y + height

      let foundRange = false
      for (const range of yRanges) {
        if (!(maxY < range.minY || minY > range.maxY)) {
          range.minY = Math.min(range.minY, minY)
          range.maxY = Math.max(range.maxY, maxY)
          range.cabinets.push(cabinet)
          foundRange = true
          break
        }
      }

      if (!foundRange) {
        yRanges.push({ minY, maxY, cabinets: [cabinet] })
      }
    })

    // Find horizontal gaps in each Y range
    yRanges.forEach((range) => {
      const sortedCabinets = [...range.cabinets].sort(
        (a, b) => a.group.position.x - b.group.position.x
      )

      for (let i = 0; i < sortedCabinets.length - 1; i++) {
        const leftCabinet = sortedCabinets[i]
        const rightCabinet = sortedCabinets[i + 1]

        const leftCabinetType = leftCabinet.cabinetType
        const rightCabinetType = rightCabinet.cabinetType

        // Skip Base-to-Top combinations
        if (
          (leftCabinetType === "base" && rightCabinetType === "top") ||
          (leftCabinetType === "top" && rightCabinetType === "base")
        ) {
          continue
        }

        const leftRight =
          leftCabinet.group.position.x + leftCabinet.carcass.dimensions.width
        const rightLeft = rightCabinet.group.position.x

        if (rightLeft > leftRight) {
          const gapWidth = rightLeft - leftRight

          if (gapWidth <= 0.1) continue

          const leftTopY =
            leftCabinet.group.position.y + leftCabinet.carcass.dimensions.height
          const rightTopY =
            rightCabinet.group.position.y +
            rightCabinet.carcass.dimensions.height

          let topY: number
          let baseTopY: number

          const isBaseToBase =
            leftCabinetType === "base" && rightCabinetType === "base"
          const isBaseToTall =
            (leftCabinetType === "base" && rightCabinetType === "tall") ||
            (leftCabinetType === "tall" && rightCabinetType === "base")

          if (isBaseToBase) {
            const baseCabinetsInRange = range.cabinets.filter(
              (c) => c.cabinetType === "base"
            )
            if (baseCabinetsInRange.length > 0) {
              const baseTopYs = baseCabinetsInRange.map(
                (c) => c.group.position.y + c.carcass.dimensions.height
              )
              topY = Math.max(...baseTopYs)
              baseTopY = topY
            } else {
              topY = Math.max(leftTopY, rightTopY)
              baseTopY = topY
            }
          } else if (isBaseToTall) {
            topY = Math.max(leftTopY, rightTopY)
            baseTopY = leftCabinetType === "base" ? leftTopY : rightTopY
          } else {
            topY = Math.max(leftTopY, rightTopY)
            baseTopY = topY
          }

          const leftY = leftCabinet.group.position.y
          const rightY = rightCabinet.group.position.y
          const y = Math.min(leftY, rightY)

          emptySpaces.push({
            leftX: leftRight,
            rightX: rightLeft,
            width: gapWidth,
            topY,
            y,
            leftCabinetType,
            rightCabinetType,
            baseTopY,
            viewId,
          })
        }
      }
    })
  })

  return emptySpaces
}

// ==================== Empty Space Dimension Creation ====================

/**
 * Create dimension line for empty space in Y-axis (height)
 */
export function createEmptySpaceYDimension(
  bottomY: number,
  topY: number,
  height: number,
  x: number,
  z: number
): THREE.Group {
  const color = DIMENSION_CONSTANTS.colors.emptySpace
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const dimensionLineX = -200 // Fixed at left wall, 200mm offset

  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(x, bottomY, z),
    extensionStart2: new THREE.Vector3(x, topY, z),
    dimensionPoint1: new THREE.Vector3(dimensionLineX, bottomY, z),
    dimensionPoint2: new THREE.Vector3(dimensionLineX, topY, z),
    labelText: `${height.toFixed(0)}mm`,
    labelPosition: new THREE.Vector3(
      dimensionLineX - 30,
      bottomY + height / 2,
      z
    ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.emptySpace,
    lineWidth,
    isVerticalText: true,
  })

  return dimension
}

/**
 * Create dimension line for empty space in X-axis between overhead cabinets
 */
export function createEmptySpaceXOverheadDimension(
  leftX: number,
  rightX: number,
  width: number,
  topY: number,
  z: number,
  wallOffsetContext: WallOffsetContext
): THREE.Group {
  const color = DIMENSION_CONSTANTS.colors.emptySpace
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const extensionOffset = DIMENSION_CONSTANTS.defaults.extensionOffset

  const leftXOffset = applyWallOffset(leftX, wallOffsetContext)
  const rightXOffset = applyWallOffset(rightX, wallOffsetContext)

  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(leftXOffset, topY, z),
    extensionStart2: new THREE.Vector3(rightXOffset, topY, z),
    dimensionPoint1: new THREE.Vector3(leftXOffset, topY + extensionOffset, z),
    dimensionPoint2: new THREE.Vector3(rightXOffset, topY + extensionOffset, z),
    labelText: `${width.toFixed(0)}mm`,
    labelPosition: new THREE.Vector3(
      (leftXOffset + rightXOffset) / 2,
      topY + extensionOffset + 30,
      z
    ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.emptySpace,
    lineWidth,
  })

  return dimension
}

/**
 * Create dimension line for empty space in X-axis
 */
export function createEmptySpaceXDimension(
  leftX: number,
  rightX: number,
  width: number,
  topY: number,
  leftCabinetType: string,
  rightCabinetType: string,
  baseTopY: number,
  z: number,
  wallOffsetContext: WallOffsetContext
): THREE.Group {
  const color = DIMENSION_CONSTANTS.colors.emptySpace
  const arrowColor = DIMENSION_CONSTANTS.colors.arrow
  const lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth
  const extensionOffset = DIMENSION_CONSTANTS.defaults.extensionOffset

  const leftXOffset = applyWallOffset(leftX, wallOffsetContext)
  const rightXOffset = applyWallOffset(rightX, wallOffsetContext)

  // Determine positioning based on cabinet types
  const isBaseToBase = leftCabinetType === "base" && rightCabinetType === "base"
  const isBaseToTall =
    (leftCabinetType === "base" && rightCabinetType === "tall") ||
    (leftCabinetType === "tall" && rightCabinetType === "base")

  let dimensionLineY: number
  let extensionStartY: number

  if (isBaseToBase) {
    dimensionLineY = topY + extensionOffset
    extensionStartY = topY
  } else if (isBaseToTall) {
    dimensionLineY = baseTopY + extensionOffset
    extensionStartY = baseTopY
  } else {
    dimensionLineY = topY + extensionOffset
    extensionStartY = topY
  }

  const dimension = createCompleteDimension({
    extensionStart1: new THREE.Vector3(leftXOffset, extensionStartY, z),
    extensionStart2: new THREE.Vector3(rightXOffset, extensionStartY, z),
    dimensionPoint1: new THREE.Vector3(leftXOffset, dimensionLineY, z),
    dimensionPoint2: new THREE.Vector3(rightXOffset, dimensionLineY, z),
    labelText: `${width.toFixed(0)}mm`,
    labelPosition: new THREE.Vector3(
      (leftXOffset + rightXOffset) / 2,
      dimensionLineY + 30,
      z
    ),
    color,
    arrowColor,
    textColor: DIMENSION_CONSTANTS.colorStrings.emptySpace,
    lineWidth,
  })

  return dimension
}
