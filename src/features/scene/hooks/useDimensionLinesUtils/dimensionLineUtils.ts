import * as THREE from "three"

/**
 * Constants for dimension line rendering
 */
export const DIMENSION_CONSTANTS = {
  colors: {
    cabinet: 0x0066cc, // Blue for cabinet dimensions
    overall: 0x00aa00, // Green for overall dimensions
    emptySpace: 0xff6600, // Orange for empty space
    arrow: 0x000000, // Black for arrows
  },
  colorStrings: {
    cabinet: "#0066cc",
    overall: "#00aa00",
    emptySpace: "#ff6600",
  },
  defaults: {
    lineWidth: 2,
    offset: 50, // Offset from cabinet edges
    overallOffset: 100, // Offset for overall dimensions
    arrowHeadLength: 30,
    overallArrowHeadLength: 45,
    extensionOffset: 100, // Extension line offset
  },
  text: {
    fontSize: 32,
    fontFamily: "Arial",
    canvasWidth: 256,
    canvasHeight: 64,
    verticalCanvasWidth: 64,
    verticalCanvasHeight: 256,
    wideCanvasWidth: 400, // For longer text like "Overall: 1234mm"
    scale: { width: 300, height: 75 },
    verticalScale: { width: 90, height: 450 },
    wideScale: { width: 450, height: 90 },
    extraWideScale: { width: 600, height: 90 },
  },
} as const

/**
 * Options for creating a text sprite
 */
export interface TextSpriteOptions {
  text: string
  position: THREE.Vector3
  color?: string
  fontSize?: number
  isVertical?: boolean
  scale?: { width: number; height: number }
  canvasWidth?: number
  canvasHeight?: number
}

/**
 * Create a text sprite for dimension labels
 * Handles both horizontal and vertical text orientations
 */
export function createTextSprite(
  options: TextSpriteOptions
): THREE.Sprite | null {
  const {
    text,
    position,
    color = "black",
    fontSize = DIMENSION_CONSTANTS.text.fontSize,
    isVertical = false,
    scale = isVertical
      ? DIMENSION_CONSTANTS.text.verticalScale
      : DIMENSION_CONSTANTS.text.scale,
    canvasWidth = isVertical
      ? DIMENSION_CONSTANTS.text.verticalCanvasWidth
      : DIMENSION_CONSTANTS.text.canvasWidth,
    canvasHeight = isVertical
      ? DIMENSION_CONSTANTS.text.verticalCanvasHeight
      : DIMENSION_CONSTANTS.text.canvasHeight,
  } = options

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return null

  canvas.width = canvasWidth
  canvas.height = canvasHeight
  context.fillStyle = color
  context.font = `Bold ${fontSize}px ${DIMENSION_CONSTANTS.text.fontFamily}`
  context.textAlign = "center"
  context.textBaseline = "middle"

  if (isVertical) {
    // Rotate the canvas context to write text vertically (bottom to top)
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(-Math.PI / 2) // Rotate -90 degrees for bottom-to-top reading
    context.fillText(text, 0, 0)
    context.restore()
  } else {
    context.fillText(text, canvas.width / 2, canvas.height / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  sprite.position.copy(position)
  sprite.scale.set(scale.width, scale.height, 1)

  return sprite
}

/**
 * Create an arrow helper for dimension lines
 * Arrow head will be positioned at the given position, pointing outward
 * Shaft dimension is zero (no shaft, just arrow head)
 */
export function createArrow(
  direction: THREE.Vector3,
  position: THREE.Vector3,
  color: number = DIMENSION_CONSTANTS.colors.arrow,
  headLength: number = DIMENSION_CONSTANTS.defaults.arrowHeadLength
): THREE.ArrowHelper {
  const shaftLength = 0
  const totalLength = headLength + shaftLength

  // Position arrow so that its HEAD is at the given position
  // ArrowHelper extends FROM origin IN direction, so we need to position it backward
  const arrowOrigin = position
    .clone()
    .add(direction.clone().multiplyScalar(-totalLength))

  const arrow = new THREE.ArrowHelper(
    direction,
    arrowOrigin,
    totalLength,
    color,
    headLength,
    headLength * 0.5
  )
  return arrow
}

/**
 * Create a simple line between two points
 */
export function createLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
  lineWidth: number = DIMENSION_CONSTANTS.defaults.lineWidth
): THREE.Line {
  const geometry = new THREE.BufferGeometry()
  geometry.setFromPoints([start, end])
  const material = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
  return new THREE.Line(geometry, material)
}

/**
 * Create a dimension line with arrows at both ends
 * Returns a group containing the line and two arrows
 */
export function createDimensionLineWithArrows(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
  arrowColor: number = DIMENSION_CONSTANTS.colors.arrow,
  lineWidth: number = DIMENSION_CONSTANTS.defaults.lineWidth,
  arrowHeadLength: number = DIMENSION_CONSTANTS.defaults.arrowHeadLength
): THREE.Group {
  const group = new THREE.Group()

  // Main dimension line
  const line = createLine(start, end, color, lineWidth)
  group.add(line)

  // Calculate direction from start to end
  const direction = end.clone().sub(start).normalize()

  // Arrow at start (pointing outward - opposite direction)
  const arrowStart = createArrow(
    direction.clone().negate(),
    start,
    arrowColor,
    arrowHeadLength
  )
  group.add(arrowStart)

  // Arrow at end (pointing outward - same direction)
  const arrowEnd = createArrow(direction, end, arrowColor, arrowHeadLength)
  group.add(arrowEnd)

  return group
}

/**
 * Create extension lines from cabinet edges to dimension line
 * Returns a group containing both extension lines
 */
export function createExtensionLines(
  cabinetPoint1: THREE.Vector3,
  dimensionPoint1: THREE.Vector3,
  cabinetPoint2: THREE.Vector3,
  dimensionPoint2: THREE.Vector3,
  color: number,
  lineWidth: number = DIMENSION_CONSTANTS.defaults.lineWidth
): THREE.Group {
  const group = new THREE.Group()

  const extensionLine1 = createLine(
    cabinetPoint1,
    dimensionPoint1,
    color,
    lineWidth
  )
  const extensionLine2 = createLine(
    cabinetPoint2,
    dimensionPoint2,
    color,
    lineWidth
  )

  group.add(extensionLine1)
  group.add(extensionLine2)

  return group
}

/**
 * Parameters for creating a complete dimension with extension lines, main line, arrows, and text
 */
export interface CompleteDimensionParams {
  // Extension line start points (on the object being measured)
  extensionStart1: THREE.Vector3
  extensionStart2: THREE.Vector3
  // Dimension line points
  dimensionPoint1: THREE.Vector3
  dimensionPoint2: THREE.Vector3
  // Label
  labelText: string
  labelPosition: THREE.Vector3
  // Options
  color?: number
  arrowColor?: number
  textColor?: string
  lineWidth?: number
  arrowHeadLength?: number
  isVerticalText?: boolean
  textScale?: { width: number; height: number }
}

/**
 * Create a complete dimension group with extension lines, dimension line, arrows, and text label
 * This is the main high-level function for creating dimension lines
 */
export function createCompleteDimension(
  params: CompleteDimensionParams
): THREE.Group {
  const {
    extensionStart1,
    extensionStart2,
    dimensionPoint1,
    dimensionPoint2,
    labelText,
    labelPosition,
    color = DIMENSION_CONSTANTS.colors.cabinet,
    arrowColor = DIMENSION_CONSTANTS.colors.arrow,
    textColor = "black",
    lineWidth = DIMENSION_CONSTANTS.defaults.lineWidth,
    arrowHeadLength = DIMENSION_CONSTANTS.defaults.arrowHeadLength,
    isVerticalText = false,
    textScale,
  } = params

  const group = new THREE.Group()

  // Extension lines
  const extensionLines = createExtensionLines(
    extensionStart1,
    dimensionPoint1,
    extensionStart2,
    dimensionPoint2,
    color,
    lineWidth
  )
  group.add(extensionLines)

  // Dimension line with arrows
  const dimensionLine = createDimensionLineWithArrows(
    dimensionPoint1,
    dimensionPoint2,
    color,
    arrowColor,
    lineWidth,
    arrowHeadLength
  )
  group.add(dimensionLine)

  // Text label
  const textSprite = createTextSprite({
    text: labelText,
    position: labelPosition,
    color: textColor,
    isVertical: isVerticalText,
    scale: textScale,
  })
  if (textSprite) {
    group.add(textSprite)
  }

  return group
}

/**
 * Wall offset calculation utilities
 */
export interface WallOffsetContext {
  leftWallVisible?: boolean
  rightWallVisible?: boolean
  backWallLength?: number
  length?: number
  wallThickness: number
}

/**
 * Check if an X position is inside the left wall and return offset
 */
export function getLeftWallOffset(
  x: number,
  context: WallOffsetContext
): number {
  if (!context.leftWallVisible) return 0
  if (x >= -context.wallThickness && x <= 0) {
    return -100 // Offset -100mm
  }
  return 0
}

/**
 * Check if an X position is inside the right wall and return offset
 */
export function getRightWallOffset(
  x: number,
  context: WallOffsetContext
): number {
  if (!context.rightWallVisible) return 0
  const backWallLength = context.backWallLength ?? context.length ?? 4000
  if (x >= backWallLength && x <= backWallLength + context.wallThickness) {
    return -100 // Offset -100mm
  }
  return 0
}

/**
 * Apply wall offset to an X position if it's inside a wall
 */
export function applyWallOffset(x: number, context: WallOffsetContext): number {
  const leftOffset = getLeftWallOffset(x, context)
  const rightOffset = getRightWallOffset(x, context)
  return x + leftOffset + rightOffset
}

/**
 * Dispose of a THREE.js group and all its children
 * Properly disposes geometries, materials, and textures
 */
export function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose()
      if (child.material instanceof THREE.Material) {
        child.material.dispose()
      }
    } else if (child instanceof THREE.Sprite) {
      if (
        child.material instanceof THREE.SpriteMaterial &&
        child.material.map
      ) {
        child.material.map.dispose()
        child.material.dispose()
      }
    }
    // ArrowHelper cleanup is handled internally by Three.js
  })
}
