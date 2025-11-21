import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import type { CabinetData } from "../types"
import type { ViewManager } from "../../cabinets/ViewManager"
import type { ViewId } from "../../cabinets/ViewManager"
import type { WallDimensions } from "../types"
import { WALL_THICKNESS } from "../lib/sceneUtils"

/**
 * Hook for managing dimension lines that show cabinet measurements
 * Creates dimension lines with arrows and text labels for Height, Width, and Depth
 * Also shows dimension lines for empty spaces between cabinets in the same view
 */
export const useDimensionLines = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  cabinets: CabinetData[],
  visible: boolean = true,
  viewManager?: ViewManager,
  wallDimensions?: WallDimensions
) => {
  const dimensionLinesRef = useRef<THREE.Group[]>([])

  /**
   * Check if an X position is inside the left wall and return offset
   * Left wall: from X = -WALL_THICKNESS to X = 0
   */
  const getLeftWallOffset = (x: number): number => {
    if (!wallDimensions?.leftWallVisible) return 0
    if (x >= -WALL_THICKNESS && x <= 0) {
      return -100 // Offset -100mm
    }
    return 0
  }

  /**
   * Check if an X position is inside the right wall and return offset
   * Right wall: from X = backWallLength to X = backWallLength + WALL_THICKNESS
   */
  const getRightWallOffset = (x: number): number => {
    if (!wallDimensions?.rightWallVisible) return 0
    const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length
    if (x >= backWallLength && x <= backWallLength + WALL_THICKNESS) {
      return -100 // Offset -100mm
    }
    return 0
  }

  /**
   * Apply wall offset to an X position if it's inside a wall
   */
  const applyWallOffset = (x: number): number => {
    const leftOffset = getLeftWallOffset(x)
    const rightOffset = getRightWallOffset(x)
    return x + leftOffset + rightOffset
  }

  /**
   * Check if a dimension line drawn on the left side of a cabinet would penetrate/overlap with another cabinet
   * @param cabinet - The cabinet to check
   * @param allCabinets - All cabinets in the scene
   * @param offset - The offset distance from the cabinet edge where dimension line is drawn
   * @returns true if dimension line would penetrate another cabinet
   */
  const wouldDimensionLinePenetrate = (
    cabinet: CabinetData,
    allCabinets: CabinetData[],
    offset: number = 50
  ): boolean => {
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
      const otherBack = otherZ
      const otherFront = otherZ + otherDepth

      // Check if the dimension line space (at x - offset) would be inside another cabinet
      // The dimension line is a vertical line at x - offset, extending from cabinetY to cabinetY + cabinetHeight
      // We need to check if this line space would be inside another cabinet's bounding box
      
      // Check if the dimension line X position is within the other cabinet's X range
      const xOverlap = dimensionLineX >= otherLeft && dimensionLineX <= otherRight

      if (xOverlap) {
        // Check if there's vertical overlap (for height dimension) or Z overlap (for depth dimension)
        // Height dimension: check if the dimension line Y range overlaps with the other cabinet's Y range
        // The dimension line goes from cabinetY to cabinetY + cabinetHeight
        const heightYOverlap = cabinetY < otherTop && (cabinetY + cabinetHeight) > otherBottom
        // Depth dimension: check if the dimension line Z position overlaps with the other cabinet's Z range
        // The dimension line is at z + depth + offset
        const dimensionLineZ = cabinetZ + cabinetDepth + 50 // offset is 50
        const depthZOverlap = dimensionLineZ >= otherBack && dimensionLineZ <= otherFront

        // If either height or depth dimension would overlap, return true
        if (heightYOverlap || depthZOverlap) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Create an arrow helper for dimension lines
   * Arrow head will be positioned at the given position, pointing outward
   * Shaft dimension is zero (no shaft, just arrow head)
   * Arrow head is half the previous size
   */
  const createArrow = (
    direction: THREE.Vector3,
    position: THREE.Vector3,
    color: number = 0x000000,
    headLength: number = 30 // Arrow head length (half of 60)
  ): THREE.ArrowHelper => {
    // Shaft length is zero
    const shaftLength = 0
    const totalLength = headLength + shaftLength
    
    // Position arrow so that its HEAD is at the given position
    // ArrowHelper extends FROM origin IN direction, so we need to position it backward
    const arrowOrigin = position.clone().add(direction.clone().multiplyScalar(-totalLength))
    
    const arrow = new THREE.ArrowHelper(direction, arrowOrigin, totalLength, color, headLength, headLength * 0.5)
    return arrow
  }

  /**
   * Create dimension line group for a single cabinet
   * @param cabinet - The cabinet to create dimension lines for
   * @param showHeight - Whether to show the height dimension line (only show for leftmost cabinet of each height)
   * @param showDepth - Whether to show the depth dimension line (only show for leftmost cabinet of each depth)
   * @param showKickerHeight - Whether to show the kicker height dimension line (only show for leftmost cabinet of each kicker height, base/tall only)
   */
  const createCabinetDimensionLines = (cabinet: CabinetData, showHeight: boolean = true, showDepth: boolean = true, showKickerHeight: boolean = false): THREE.Group => {
    const group = new THREE.Group()
    const color = 0x0066cc // Blue color for dimension lines
    const arrowColor = 0x000000 // Black color for arrows
    const lineWidth = 2
    const offset = 50 // Offset from cabinet edges

    const { width, height, depth } = cabinet.carcass.dimensions
    const pos = cabinet.group.position
    const x = pos.x
    const y = pos.y
    const z = pos.z

    // Apply wall offsets to X positions for dimension lines (only for height/depth, NOT width)
    const xLeft = applyWallOffset(x - offset) // For height/depth dimension lines on left
    const xRight = x + width // For width dimension line right edge (NO offset)
    const xCabinetLeft = x // For width dimension line left edge (NO offset)

    // WIDTH dimension (along X axis) - at top front
    // Extension lines from cabinet edges to dimension line
    const widthExtensionLeftGeometry = new THREE.BufferGeometry()
    const widthExtensionLeftPoints = [
        new THREE.Vector3(xCabinetLeft, y + height, z + depth + offset), // Top left edge of cabinet
        new THREE.Vector3(xCabinetLeft, y + height + offset, z + depth + offset), // Dimension line position
    ]
    widthExtensionLeftGeometry.setFromPoints(widthExtensionLeftPoints)
    const widthExtensionLeft = new THREE.Line(widthExtensionLeftGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(widthExtensionLeft)

    const widthExtensionRightGeometry = new THREE.BufferGeometry()
    const widthExtensionRightPoints = [
        new THREE.Vector3(xRight, y + height, z + depth + offset), // Top right edge of cabinet
        new THREE.Vector3(xRight, y + height + offset, z + depth + offset), // Dimension line position
    ]
    widthExtensionRightGeometry.setFromPoints(widthExtensionRightPoints)
    const widthExtensionRight = new THREE.Line(widthExtensionRightGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(widthExtensionRight)

    // Width dimension line
    const widthLineGeometry = new THREE.BufferGeometry()
    const widthLinePoints = [
      new THREE.Vector3(xCabinetLeft, y + height + offset, z + depth + offset),
      new THREE.Vector3(xRight, y + height + offset, z + depth + offset),
    ]
    widthLineGeometry.setFromPoints(widthLinePoints)
    const widthLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const widthLine = new THREE.Line(widthLineGeometry, widthLineMaterial)
    group.add(widthLine)

    // Width arrows - head at dimension line endpoint, pointing outward
    const widthArrowLeft = createArrow(
      new THREE.Vector3(-1, 0, 0), // Point left (outward from center)
      new THREE.Vector3(xCabinetLeft, y + height + offset, z + depth + offset), // Head at left endpoint
      arrowColor
    )
    const widthArrowRight = createArrow(
      new THREE.Vector3(1, 0, 0), // Point right (outward from center)
      new THREE.Vector3(xRight, y + height + offset, z + depth + offset), // Head at right endpoint
      arrowColor
    )
    group.add(widthArrowLeft)
    group.add(widthArrowRight)

    // HEIGHT dimension (along Y axis) - at left front (only show if showHeight is true)
    if (showHeight) {
      // Extension lines from cabinet edges to dimension line
      const heightExtensionBottomGeometry = new THREE.BufferGeometry()
      const heightExtensionBottomPoints = [
        new THREE.Vector3(xCabinetLeft, y, z + depth + offset), // Bottom left edge of cabinet
        new THREE.Vector3(xLeft, y, z + depth + offset), // Dimension line position
      ]
      heightExtensionBottomGeometry.setFromPoints(heightExtensionBottomPoints)
      const heightExtensionBottom = new THREE.Line(heightExtensionBottomGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(heightExtensionBottom)

      const heightExtensionTopGeometry = new THREE.BufferGeometry()
      const heightExtensionTopPoints = [
        new THREE.Vector3(xCabinetLeft, y + height, z + depth + offset), // Top left edge of cabinet
        new THREE.Vector3(xLeft, y + height, z + depth + offset), // Dimension line position
      ]
      heightExtensionTopGeometry.setFromPoints(heightExtensionTopPoints)
      const heightExtensionTop = new THREE.Line(heightExtensionTopGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(heightExtensionTop)

      // Height dimension line
      const heightLineGeometry = new THREE.BufferGeometry()
      const heightLinePoints = [
        new THREE.Vector3(xLeft, y, z + depth + offset),
        new THREE.Vector3(xLeft, y + height, z + depth + offset),
      ]
      heightLineGeometry.setFromPoints(heightLinePoints)
      const heightLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
      const heightLine = new THREE.Line(heightLineGeometry, heightLineMaterial)
      group.add(heightLine)

      // Height arrows - head at dimension line endpoint, pointing outward
      const heightArrowBottom = createArrow(
        new THREE.Vector3(0, -1, 0), // Point down (outward from center)
        new THREE.Vector3(xLeft, y, z + depth + offset), // Head at bottom endpoint
        arrowColor
      )
      const heightArrowTop = createArrow(
        new THREE.Vector3(0, 1, 0), // Point up (outward from center)
        new THREE.Vector3(xLeft, y + height, z + depth + offset), // Head at top endpoint
        arrowColor
      )
      group.add(heightArrowBottom)
      group.add(heightArrowTop)
    }

    // KICKER HEIGHT dimension (along Y axis) - aligned with height dimension (base/tall cabinets only)
    if (showKickerHeight && (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall")) {
      const kickerHeight = y // For base/tall cabinets, Y position equals kicker height
      
      // Extension lines from ground to kicker height
      const kickerExtensionBottomGeometry = new THREE.BufferGeometry()
      const kickerExtensionBottomPoints = [
        new THREE.Vector3(xCabinetLeft, 0, z + depth + offset), // Ground level at left edge
        new THREE.Vector3(xLeft, 0, z + depth + offset), // Dimension line position at ground
      ]
      kickerExtensionBottomGeometry.setFromPoints(kickerExtensionBottomPoints)
      const kickerExtensionBottom = new THREE.Line(kickerExtensionBottomGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(kickerExtensionBottom)

      const kickerExtensionTopGeometry = new THREE.BufferGeometry()
      const kickerExtensionTopPoints = [
        new THREE.Vector3(xCabinetLeft, kickerHeight, z + depth + offset), // Kicker height at left edge
        new THREE.Vector3(xLeft, kickerHeight, z + depth + offset), // Dimension line position at kicker height
      ]
      kickerExtensionTopGeometry.setFromPoints(kickerExtensionTopPoints)
      const kickerExtensionTop = new THREE.Line(kickerExtensionTopGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(kickerExtensionTop)

      // Kicker height dimension line
      const kickerLineGeometry = new THREE.BufferGeometry()
      const kickerLinePoints = [
        new THREE.Vector3(xLeft, 0, z + depth + offset),
        new THREE.Vector3(xLeft, kickerHeight, z + depth + offset),
      ]
      kickerLineGeometry.setFromPoints(kickerLinePoints)
      const kickerLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
      const kickerLine = new THREE.Line(kickerLineGeometry, kickerLineMaterial)
      group.add(kickerLine)

      // Kicker height arrows - head at dimension line endpoint, pointing outward
      const kickerArrowBottom = createArrow(
        new THREE.Vector3(0, -1, 0), // Point down (outward from center)
        new THREE.Vector3(xLeft, 0, z + depth + offset), // Head at bottom endpoint
        arrowColor
      )
      const kickerArrowTop = createArrow(
        new THREE.Vector3(0, 1, 0), // Point up (outward from center)
        new THREE.Vector3(xLeft, kickerHeight, z + depth + offset), // Head at top endpoint
        arrowColor
      )
      group.add(kickerArrowBottom)
      group.add(kickerArrowTop)
    }

    // DEPTH dimension (along Z axis) - at top left (only show if showDepth is true)
    if (showDepth) {
      // Extension lines from cabinet edges to dimension line
      const depthExtensionBackGeometry = new THREE.BufferGeometry()
      const depthExtensionBackPoints = [
        new THREE.Vector3(xLeft, y + height, z), // Top back edge of cabinet
        new THREE.Vector3(xLeft, y + height + offset, z), // Dimension line position
      ]
      depthExtensionBackGeometry.setFromPoints(depthExtensionBackPoints)
      const depthExtensionBack = new THREE.Line(depthExtensionBackGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(depthExtensionBack)

      const depthExtensionFrontGeometry = new THREE.BufferGeometry()
      const depthExtensionFrontPoints = [
        new THREE.Vector3(xLeft, y + height, z + depth), // Top front edge of cabinet
        new THREE.Vector3(xLeft, y + height + offset, z + depth), // Dimension line position
      ]
      depthExtensionFrontGeometry.setFromPoints(depthExtensionFrontPoints)
      const depthExtensionFront = new THREE.Line(depthExtensionFrontGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(depthExtensionFront)

      // Depth dimension line
      const depthLineGeometry = new THREE.BufferGeometry()
      const depthLinePoints = [
        new THREE.Vector3(xLeft, y + height + offset, z),
        new THREE.Vector3(xLeft, y + height + offset, z + depth),
      ]
      depthLineGeometry.setFromPoints(depthLinePoints)
      const depthLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
      const depthLine = new THREE.Line(depthLineGeometry, depthLineMaterial)
      group.add(depthLine)

      // Depth arrows - head at dimension line endpoint, pointing outward
      const depthArrowBack = createArrow(
        new THREE.Vector3(0, 0, -1), // Point backward (outward from center)
        new THREE.Vector3(xLeft, y + height + offset, z), // Head at back endpoint
        arrowColor
      )
      const depthArrowFront = createArrow(
        new THREE.Vector3(0, 0, 1), // Point forward (outward from center)
        new THREE.Vector3(xLeft, y + height + offset, z + depth), // Head at front endpoint
        arrowColor
      )
      group.add(depthArrowBack)
      group.add(depthArrowFront)
    }

    // Text labels using sprites (simpler than CSS2DRenderer)
    // Note: For better text rendering, consider using CSS2DRenderer in the future
    const createTextSprite = (text: string, position: THREE.Vector3, rotation: THREE.Euler) => {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (!context) return null

      canvas.width = 256
      canvas.height = 64
      // No background fill - transparent background
      context.fillStyle = "black" // Text color
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(text, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1 // Only render pixels with alpha > 0.1
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.copy(position)
      sprite.rotation.copy(rotation)
      sprite.scale.set(300, 75, 1) // Scale to appropriate size (3x bigger: 100*3, 25*3)

      return sprite
    }

    // Width text (aligned with X axis) - positioned above the line
    const widthTextPos = new THREE.Vector3((xCabinetLeft + xRight) / 2, y + height + offset + 30, z + depth + offset)
    const widthText = createTextSprite(
      `${width}mm`,
      widthTextPos,
      new THREE.Euler(0, 0, 0) // Horizontal text
    )
    if (widthText) group.add(widthText)

    // Height text (aligned with Y axis - vertical, bottom to top) - only show if showHeight is true
    if (showHeight) {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (context) {
        // Make canvas taller for vertical text
        canvas.width = 64
        canvas.height = 256
        context.fillStyle = "black"
        context.font = "Bold 32px Arial"
        context.textAlign = "center"
        context.textBaseline = "middle"
        
        // Rotate the canvas context to write text vertically (bottom to top)
        context.save()
        context.translate(canvas.width / 2, canvas.height / 2)
        context.rotate(-Math.PI / 2) // Rotate -90 degrees for bottom-to-top reading
        context.fillText(`${height}mm`, 0, 0)
        context.restore()

        const texture = new THREE.CanvasTexture(canvas)
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.1,
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        sprite.position.set(xLeft - 30, y + height / 2, z + depth + offset)
        // No rotation needed since text is already vertical on canvas
        sprite.scale.set(90, 450, 1) // Swapped scale values to match new canvas dimensions
        group.add(sprite)
      }
    }

    // Depth text (aligned with Z axis) - positioned at top (only show if showDepth is true)
    if (showDepth) {
      const depthTextPos = new THREE.Vector3(xLeft - 30, y + height + offset, z + depth / 2)
      const depthText = createTextSprite(
        `${depth}mm`,
        depthTextPos,
        new THREE.Euler(Math.PI / 2, 0, 0) // Text along Z axis
      )
      if (depthText) group.add(depthText)
    }

    // Kicker height text (aligned with Y axis - vertical, bottom to top) - only show if showKickerHeight is true
    if (showKickerHeight && (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall")) {
      const kickerHeight = y // For base/tall cabinets, Y position equals kicker height
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (context) {
        // Make canvas taller for vertical text
        canvas.width = 64
        canvas.height = 256
        context.fillStyle = "black"
        context.font = "Bold 32px Arial"
        context.textAlign = "center"
        context.textBaseline = "middle"
        
        // Rotate the canvas context to write text vertically (bottom to top)
        context.save()
        context.translate(canvas.width / 2, canvas.height / 2)
        context.rotate(-Math.PI / 2) // Rotate -90 degrees for bottom-to-top reading
        context.fillText(`${kickerHeight.toFixed(0)}mm`, 0, 0)
        context.restore()

        const texture = new THREE.CanvasTexture(canvas)
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.1,
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        sprite.position.set(xLeft - 30, kickerHeight / 2, z + depth + offset)
        // No rotation needed since text is already vertical on canvas
        sprite.scale.set(90, 450, 1) // Swapped scale values to match new canvas dimensions
        group.add(sprite)
      }
    }

    return group
  }

  /**
   * Create overall width dimension line across all cabinets
   */
  const createOverallWidthDimension = (cabinets: CabinetData[]): THREE.Group | null => {
    if (cabinets.length === 0) return null

    const group = new THREE.Group()
    const color = 0x00aa00 // Green color for overall dimension
    const lineWidth = 3
    const offset = 100 // Offset below all cabinets

    // Find min and max X positions, and max Y (top) position
    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    cabinets.forEach((cabinet) => {
      const x = cabinet.group.position.x
      const y = cabinet.group.position.y
      const width = cabinet.carcass.dimensions.width
      const height = cabinet.carcass.dimensions.height
      const depth = cabinet.carcass.dimensions.depth

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    })

    const overallWidth = maxX - minX
    const zPos = Math.max(...cabinets.map(c => c.group.position.z + c.carcass.dimensions.depth)) + offset
    const overallArrowColor = 0x000000 // Black color for overall dimension arrows

    // Find the leftmost and rightmost cabinet edges for extension lines
    let leftmostCabinet: CabinetData | undefined = undefined
    let rightmostCabinet: CabinetData | undefined = undefined
    let leftmostX = Infinity
    let rightmostX = -Infinity

    cabinets.forEach((cabinet) => {
      const x = cabinet.group.position.x
      const width = cabinet.carcass.dimensions.width

      // Check if this cabinet has the leftmost edge
      if (x < leftmostX) {
        leftmostX = x
        leftmostCabinet = cabinet
      }

      // Check if this cabinet has the rightmost edge
      if (x + width > rightmostX) {
        rightmostX = x + width
        rightmostCabinet = cabinet
      }
    })

    // Overall width extension lines - from leftmost and rightmost cabinet edges (parallel to Y axis)
    if (leftmostCabinet) {
      const leftCab: CabinetData = leftmostCabinet
      const leftCabHeight = leftCab.carcass.dimensions.height
      const leftCabY = leftCab.group.position.y
      
      const overallExtensionLeftGeometry = new THREE.BufferGeometry()
      const overallExtensionLeftPoints = [
        new THREE.Vector3(minX, leftCabY + leftCabHeight, zPos), // Top left edge of leftmost cabinet (at zPos)
        new THREE.Vector3(minX, maxY + offset, zPos), // Dimension line position
      ]
      overallExtensionLeftGeometry.setFromPoints(overallExtensionLeftPoints)
      const overallExtensionLeft = new THREE.Line(overallExtensionLeftGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(overallExtensionLeft)
    }

    if (rightmostCabinet) {
      const rightCab: CabinetData = rightmostCabinet
      const rightCabHeight = rightCab.carcass.dimensions.height
      const rightCabY = rightCab.group.position.y
      
      const overallExtensionRightGeometry = new THREE.BufferGeometry()
      const overallExtensionRightPoints = [
        new THREE.Vector3(maxX, rightCabY + rightCabHeight, zPos), // Top right edge of rightmost cabinet (at zPos)
        new THREE.Vector3(maxX, maxY + offset, zPos), // Dimension line position
      ]
      overallExtensionRightGeometry.setFromPoints(overallExtensionRightPoints)
      const overallExtensionRight = new THREE.Line(overallExtensionRightGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(overallExtensionRight)
    }

    // Overall width line - at top of cabinets
    const overallLineGeometry = new THREE.BufferGeometry()
    const overallLinePoints = [
      new THREE.Vector3(minX, maxY + offset, zPos),
      new THREE.Vector3(maxX, maxY + offset, zPos),
    ]
    overallLineGeometry.setFromPoints(overallLinePoints)
    const overallLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const overallLine = new THREE.Line(overallLineGeometry, overallLineMaterial)
    group.add(overallLine)

    // Overall width arrows (half of 90 = 45) - head at dimension line endpoint, pointing outward
    const overallArrowLeft = createArrow(
      new THREE.Vector3(-1, 0, 0), // Point left (outward from center)
      new THREE.Vector3(minX, maxY + offset, zPos), // Head at left endpoint
      overallArrowColor,
      45
    )
    const overallArrowRight = createArrow(
      new THREE.Vector3(1, 0, 0), // Point right (outward from center)
      new THREE.Vector3(maxX, maxY + offset, zPos), // Head at right endpoint
      overallArrowColor,
      45
    )
    group.add(overallArrowLeft)
    group.add(overallArrowRight)

    // Overall width text
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (context) {
      canvas.width = 256
      canvas.height = 64
      // No background fill - transparent background
      context.fillStyle = "#00aa00" // Green text color for overall dimension
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(`Overall: ${overallWidth.toFixed(0)}mm`, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1 // Only render pixels with alpha > 0.1
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set((minX + maxX) / 2, maxY + offset + 40, zPos) // Positioned above the line at top
      sprite.scale.set(450, 90, 1) // 3x bigger: 150*3, 30*3
      group.add(sprite)
    }

    return group
  }

  /**
   * Create overall height dimension line for each view
   * Shows height from floor to top of tallest cabinet in the view
   * Positioned at -250mm from left wall, or +250mm from right wall if more Tall cabinets on right
   */
  const createOverallHeightDimension = (cabinets: CabinetData[], viewManager?: ViewManager): THREE.Group[] => {
    const groups: THREE.Group[] = []
    
    if (!viewManager || cabinets.length === 0) return groups

    const color = 0x00aa00 // Green color for overall dimension
    const lineWidth = 3
    const offset = 50 // X offset from wall
    const backWallLength = wallDimensions?.backWallLength ?? wallDimensions?.length ?? 4000
    const leftWallOffset = -250 // -250mm from left wall
    const rightWallOffset = backWallLength + 250 // +250mm from right wall

    // Get all active views
    const activeViews = viewManager.getActiveViews()

    activeViews.forEach((view) => {
      const viewId = view.id
      if (viewId === 'none') return

      // Get all cabinets in this view
      const cabinetIds = viewManager.getCabinetsInView(viewId)
      const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))
      
      if (viewCabinets.length === 0) return

      // Find the tallest cabinet in the view
      let tallestCabinet: CabinetData | undefined = undefined
      let maxTopY = -Infinity

      viewCabinets.forEach((cabinet) => {
        const topY = cabinet.group.position.y + cabinet.carcass.dimensions.height
        if (topY > maxTopY) {
          maxTopY = topY
          tallestCabinet = cabinet
        }
      })

      if (!tallestCabinet) return

      // Assign to const to help TypeScript with type narrowing
      const tallestCabinetData: CabinetData = tallestCabinet

      const overallHeight = maxTopY
      const zPos = Math.max(...viewCabinets.map(c => c.group.position.z + c.carcass.dimensions.depth)) + 50

      // Store tallest cabinet's X position for extension line
      const tallestCabinetX = tallestCabinetData.group.position.x + tallestCabinetData.carcass.dimensions.width / 2

      // Find leftmost and rightmost X positions of cabinets in the view
      let leftmostX = Infinity
      let rightmostX = -Infinity
      viewCabinets.forEach((cabinet) => {
        const cabX = cabinet.group.position.x
        const cabRightX = cabX + cabinet.carcass.dimensions.width
        leftmostX = Math.min(leftmostX, cabX)
        rightmostX = Math.max(rightmostX, cabRightX)
      })

      // Count Tall cabinets on left vs right side
      // Divide scene in half at the center X
      const sceneCenterX = backWallLength / 2
      const tallCabinets = viewCabinets.filter(c => c.cabinetType === 'tall')
      
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

      // Determine X position: use right side if more Tall cabinets on right, otherwise use left
      const dimensionX = tallCabinetsOnRight > tallCabinetsOnLeft ? rightWallOffset : leftWallOffset
      const isRightWall = dimensionX === rightWallOffset

      const group = new THREE.Group()
      const overallArrowColor = 0x000000 // Black color for overall dimension arrows

      // Extension lines - connect from cabinets to dimension line
      // Bottom extension line: from leftmost cabinet to dimension line at floor level
      const extensionBottomGeometry = new THREE.BufferGeometry()
      const extensionBottomPoints = [
        new THREE.Vector3(leftmostX, 0, zPos), // Start at leftmost cabinet at floor level
        new THREE.Vector3(dimensionX, 0, zPos), // End at dimension line at floor level
      ]
      extensionBottomGeometry.setFromPoints(extensionBottomPoints)
      const extensionBottom = new THREE.Line(extensionBottomGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(extensionBottom)

      // Top extension line: from tallest cabinet's X position to dimension line at top
      const extensionTopGeometry = new THREE.BufferGeometry()
      const extensionTopPoints = [
        new THREE.Vector3(tallestCabinetX, overallHeight, zPos), // Start at tallest cabinet's center X at top
        new THREE.Vector3(dimensionX, overallHeight, zPos), // End at dimension line at top
      ]
      extensionTopGeometry.setFromPoints(extensionTopPoints)
      const extensionTop = new THREE.Line(extensionTopGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(extensionTop)

      // Overall height dimension line - vertical line from floor to top of tallest cabinet
      const overallLineGeometry = new THREE.BufferGeometry()
      const overallLinePoints = [
        new THREE.Vector3(dimensionX, 0, zPos), // Floor level
        new THREE.Vector3(dimensionX, overallHeight, zPos), // Top of tallest cabinet
      ]
      overallLineGeometry.setFromPoints(overallLinePoints)
      const overallLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
      const overallLine = new THREE.Line(overallLineGeometry, overallLineMaterial)
      group.add(overallLine)

      // Overall height arrows - head at dimension line endpoints
      const overallArrowBottom = createArrow(
        new THREE.Vector3(0, -1, 0), // Point down (outward from center)
        new THREE.Vector3(dimensionX, 0, zPos), // Head at bottom endpoint
        overallArrowColor,
        45
      )
      const overallArrowTop = createArrow(
        new THREE.Vector3(0, 1, 0), // Point up (outward from center)
        new THREE.Vector3(dimensionX, overallHeight, zPos), // Head at top endpoint
        overallArrowColor,
        45
      )
      group.add(overallArrowBottom)
      group.add(overallArrowTop)

      // Overall height text - oriented vertically bottom to top
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      if (context) {
        // Make canvas taller for vertical text
        canvas.width = 64
        canvas.height = 256
        context.fillStyle = "#00aa00" // Green text color for overall dimension
        context.font = "Bold 32px Arial"
        context.textAlign = "center"
        context.textBaseline = "middle"
        
        // Rotate the canvas context to write text vertically (bottom to top)
        context.save()
        context.translate(canvas.width / 2, canvas.height / 2)
        context.rotate(-Math.PI / 2) // Rotate -90 degrees for bottom-to-top reading
        context.fillText(`Overall: ${overallHeight.toFixed(0)}mm`, 0, 0)
        context.restore()

        const texture = new THREE.CanvasTexture(canvas)
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.1,
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        // Position: right of line if on right wall, left of line if on left wall
        const textOffset = isRightWall ? 30 : -30
        sprite.position.set(dimensionX + textOffset, overallHeight / 2, zPos) // Positioned at middle height
        // No rotation needed since text is already vertical on canvas
        sprite.scale.set(90, 450, 1) // Swapped scale values to match new canvas dimensions
        group.add(sprite)
      }

      groups.push(group)
    })

    return groups
  }

  /**
   * Create overall width dimension line for base and tall cabinets only (positioned at bottom)
   */
  const createBaseTallOverallWidthDimension = (cabinets: CabinetData[]): THREE.Group | null => {
    // Filter to only base and tall cabinets
    const baseTallCabinets = cabinets.filter(c => c.cabinetType === "base" || c.cabinetType === "tall")
    
    if (baseTallCabinets.length === 0) return null

    const group = new THREE.Group()
    const color = 0x00aa00 // Green color for overall dimension
    const lineWidth = 3
    const offset = 100 // Offset below cabinets

    // Find min and max X positions for base/tall cabinets, and min Y (bottom) position
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
    const zPos = Math.max(...baseTallCabinets.map(c => c.group.position.z + c.carcass.dimensions.depth)) + offset
    const overallArrowColor = 0x000000 // Black color for overall dimension arrows

    // Find the leftmost and rightmost base/tall cabinet edges for extension lines
    let leftmostCabinet: CabinetData | undefined = undefined
    let rightmostCabinet: CabinetData | undefined = undefined
    let leftmostX = Infinity
    let rightmostX = -Infinity

    baseTallCabinets.forEach((cabinet) => {
      const x = cabinet.group.position.x
      const width = cabinet.carcass.dimensions.width

      // Check if this cabinet has the leftmost edge
      if (x < leftmostX) {
        leftmostX = x
        leftmostCabinet = cabinet
      }

      // Check if this cabinet has the rightmost edge
      if (x + width > rightmostX) {
        rightmostX = x + width
        rightmostCabinet = cabinet
      }
    })

    // Overall width extension lines - from leftmost and rightmost cabinet edges (parallel to Y axis, at bottom)
    if (leftmostCabinet) {
      const leftCab: CabinetData = leftmostCabinet
      const leftCabY = leftCab.group.position.y
      
      const overallExtensionLeftGeometry = new THREE.BufferGeometry()
      const overallExtensionLeftPoints = [
        new THREE.Vector3(minX, leftCabY, zPos), // Bottom left edge of leftmost cabinet (at zPos)
        new THREE.Vector3(minX, minY - offset, zPos), // Dimension line position at bottom
      ]
      overallExtensionLeftGeometry.setFromPoints(overallExtensionLeftPoints)
      const overallExtensionLeft = new THREE.Line(overallExtensionLeftGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(overallExtensionLeft)
    }

    if (rightmostCabinet) {
      const rightCab: CabinetData = rightmostCabinet
      const rightCabY = rightCab.group.position.y
      
      const overallExtensionRightGeometry = new THREE.BufferGeometry()
      const overallExtensionRightPoints = [
        new THREE.Vector3(maxX, rightCabY, zPos), // Bottom right edge of rightmost cabinet (at zPos)
        new THREE.Vector3(maxX, minY - offset, zPos), // Dimension line position at bottom
      ]
      overallExtensionRightGeometry.setFromPoints(overallExtensionRightPoints)
      const overallExtensionRight = new THREE.Line(overallExtensionRightGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
      group.add(overallExtensionRight)
    }

    // Overall width line - at bottom of base/tall cabinets
    const overallLineGeometry = new THREE.BufferGeometry()
    const overallLinePoints = [
      new THREE.Vector3(minX, minY - offset, zPos),
      new THREE.Vector3(maxX, minY - offset, zPos),
    ]
    overallLineGeometry.setFromPoints(overallLinePoints)
    const overallLineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const overallLine = new THREE.Line(overallLineGeometry, overallLineMaterial)
    group.add(overallLine)

    // Overall width arrows (half of 90 = 45) - head at dimension line endpoint, pointing outward
    const overallArrowLeft = createArrow(
      new THREE.Vector3(-1, 0, 0), // Point left (outward from center)
      new THREE.Vector3(minX, minY - offset, zPos), // Head at left endpoint
      overallArrowColor,
      45
    )
    const overallArrowRight = createArrow(
      new THREE.Vector3(1, 0, 0), // Point right (outward from center)
      new THREE.Vector3(maxX, minY - offset, zPos), // Head at right endpoint
      overallArrowColor,
      45
    )
    group.add(overallArrowLeft)
    group.add(overallArrowRight)

    // Overall width text
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (context) {
      canvas.width = 400 // Extended width to accommodate full text
      canvas.height = 64
      // No background fill - transparent background
      context.fillStyle = "#00aa00" // Green text color for overall dimension
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(`Overall: ${overallWidth.toFixed(0)}mm`, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1 // Only render pixels with alpha > 0.1
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set((minX + maxX) / 2, minY - offset + 40, zPos) // Positioned above the line at bottom
      sprite.scale.set(600, 90, 1) // Wider to accommodate longer text
      group.add(sprite)
    }

    return group
  }

  /**
   * Detect empty spaces in Y-axis (height) between cabinets in the same view
   * Returns array of empty space info: { bottomY, topY, height, leftmostX, viewId }
   */
  const detectEmptySpacesY = (cabinets: CabinetData[], viewManager?: ViewManager): Array<{
    bottomY: number
    topY: number
    height: number
    leftmostX: number
    viewId: ViewId
  }> => {
    if (!viewManager) {
      console.log('detectEmptySpacesY: viewManager not available')
      return []
    }

    const emptySpaces: Array<{
      bottomY: number
      topY: number
      height: number
      leftmostX: number
      viewId: ViewId
    }> = []

    // Get all active views
    const activeViews = viewManager.getActiveViews()
    console.log('detectEmptySpacesY: Active views:', activeViews.length)

    activeViews.forEach((view) => {
      const viewId = view.id
      if (viewId === 'none') return

      // Get all cabinets in this view
      const cabinetIds = viewManager.getCabinetsInView(viewId)
      const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))
      console.log(`detectEmptySpacesY: View ${viewId} has ${viewCabinets.length} cabinets`)

      if (viewCabinets.length < 2) return // Need at least 2 cabinets to have a gap

      // Group cabinets by their X position ranges to find vertical gaps
      // For each X range, find cabinets that overlap horizontally
      const xRanges: Array<{ minX: number; maxX: number; cabinets: CabinetData[] }> = []

      viewCabinets.forEach((cabinet) => {
        const x = cabinet.group.position.x
        const width = cabinet.carcass.dimensions.width
        const minX = x
        const maxX = x + width

        // Find if this cabinet overlaps with any existing X range
        let foundRange = false
        for (const range of xRanges) {
          // Check if there's horizontal overlap
          if (!(maxX < range.minX || minX > range.maxX)) {
            // Overlaps - merge into this range
            range.minX = Math.min(range.minX, minX)
            range.maxX = Math.max(range.maxX, maxX)
            range.cabinets.push(cabinet)
            foundRange = true
            break
          }
        }

        if (!foundRange) {
          // Create new X range
          xRanges.push({ minX, maxX, cabinets: [cabinet] })
        }
      })

      // For each X range, find vertical gaps between cabinets
      xRanges.forEach((range) => {
        // Sort cabinets by Y position (bottom to top)
        const sortedCabinets = [...range.cabinets].sort((a, b) => {
          const aY = a.group.position.y
          const bY = b.group.position.y
          return aY - bY
        })

        // Find gaps between consecutive cabinets
        for (let i = 0; i < sortedCabinets.length - 1; i++) {
          const lowerCabinet = sortedCabinets[i]
          const upperCabinet = sortedCabinets[i + 1]

          const lowerType = lowerCabinet.cabinetType
          const upperType = upperCabinet.cabinetType

          // Show vertical gaps between:
          // 1. Base/Tall and Top cabinets (existing behavior - requires X overlap)
          const isBaseOrTall = lowerType === 'base' || lowerType === 'tall'
          const isTop = upperType === 'top'
          
          if (isBaseOrTall && isTop) {
            // Base/Tall-Top gaps (requires X overlap, which is already ensured by being in same range)
            const lowerTop = lowerCabinet.group.position.y + lowerCabinet.carcass.dimensions.height
            const upperBottom = upperCabinet.group.position.y

            // Check if there's a gap (and it's not zero)
            if (upperBottom > lowerTop) {
              const gapHeight = upperBottom - lowerTop
              
              // Skip zero-height gaps
              if (gapHeight <= 0.1) {
                continue
              }
              
              // For Base/Tall-Top gaps, use the center X of top cabinets in this range
              const topCabinetsInRange = range.cabinets.filter(c => c.cabinetType === 'top')
              if (topCabinetsInRange.length > 0) {
                let minTopX = Infinity
                let maxTopX = -Infinity
                topCabinetsInRange.forEach(cab => {
                  const cabX = cab.group.position.x
                  const cabWidth = cab.carcass.dimensions.width
                  minTopX = Math.min(minTopX, cabX)
                  maxTopX = Math.max(maxTopX, cabX + cabWidth)
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

      // Additionally, check for Base/Tall-Top gaps WITHOUT requiring X overlap
      // This ensures splashback measurements are always displayed
      const baseTallCabinets = viewCabinets.filter(c => c.cabinetType === 'base' || c.cabinetType === 'tall')
      const topCabinetsForSplashback = viewCabinets.filter(c => c.cabinetType === 'top')
      
      // Check all Base/Tall-Top combinations for vertical gaps
      baseTallCabinets.forEach((baseTallCabinet) => {
        topCabinetsForSplashback.forEach((topCabinet) => {
          // Calculate gap from top of base/tall cabinet to bottom of top cabinet
          const baseTallY = baseTallCabinet.group.position.y
          const baseTallHeight = baseTallCabinet.carcass.dimensions.height
          const baseTallTop = baseTallY + baseTallHeight
          
          const topY = topCabinet.group.position.y
          const topBottom = topY
          
          // Check if there's a vertical gap (top cabinet is above base/tall)
          if (topBottom > baseTallTop) {
            const gapHeight = topBottom - baseTallTop
            
            // Skip zero-height gaps
            if (gapHeight <= 0.1) {
              return
            }
            
            // Check if this gap was already detected in the X overlap section
            // We only want to add it if it wasn't already added
            const alreadyDetected = emptySpaces.some(space => 
              space.viewId === viewId &&
              Math.abs(space.bottomY - baseTallTop) < 0.1 &&
              Math.abs(space.topY - topBottom) < 0.1 &&
              Math.abs(space.height - gapHeight) < 0.1
            )
            
            if (alreadyDetected) {
              return // Skip if already detected with X overlap
            }
            
            // Position is on the center X of the top cabinets in the view
            // Use the center X of all top cabinets for consistency
            let centerX: number
            if (topCabinetsForSplashback.length > 0) {
              let minTopX = Infinity
              let maxTopX = -Infinity
              topCabinetsForSplashback.forEach(cab => {
                const cabX = cab.group.position.x
                const cabWidth = cab.carcass.dimensions.width
                minTopX = Math.min(minTopX, cabX)
                maxTopX = Math.max(maxTopX, cabX + cabWidth)
              })
              centerX = (minTopX + maxTopX) / 2
            } else {
              // Fallback to center between base/tall and top cabinet
              const baseTallX = baseTallCabinet.group.position.x
              const baseTallWidth = baseTallCabinet.carcass.dimensions.width
              const topX = topCabinet.group.position.x
              const topWidth = topCabinet.carcass.dimensions.width
              const baseTallCenterX = baseTallX + baseTallWidth / 2
              const topCenterX = topX + topWidth / 2
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

      // Additionally, check for Top-Tall gaps WITHOUT requiring X overlap
      // Get all Top and Tall cabinets in the view
      const topCabinets = viewCabinets.filter(c => c.cabinetType === 'top')
      const tallCabinets = viewCabinets.filter(c => c.cabinetType === 'tall')
      
      // Check all Top-Tall combinations for vertical gaps
      topCabinets.forEach((topCabinet) => {
        tallCabinets.forEach((tallCabinet) => {
          // Calculate gap from top of Top cabinet to top of Tall cabinet
          const topCabY = topCabinet.group.position.y
          const topCabHeight = topCabinet.carcass.dimensions.height
          const topCabTop = topCabY + topCabHeight
          
          const tallCabY = tallCabinet.group.position.y
          const tallCabHeight = tallCabinet.carcass.dimensions.height
          const tallCabTop = tallCabY + tallCabHeight
          
          // Gap is the difference between top of Top cabinet and top of Tall cabinet
          const gapHeight = Math.abs(tallCabTop - topCabTop)
          
          // Skip zero-height gaps
          if (gapHeight <= 0.1) {
            return
          }
          
          // Position is always on top of the Top cabinet (center X of Top cabinet)
          const topCabX = topCabinet.group.position.x
          const topCabWidth = topCabinet.carcass.dimensions.width
          const centerX = topCabX + topCabWidth / 2
          
          // For the dimension line, we need bottomY and topY
          // bottomY is the lower of the two tops, topY is the higher
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
   * Detect empty spaces in X-axis (width) between overhead (top) cabinets and between Top and Tall cabinets in the same view
   * Returns array of empty space info: { leftX, rightX, width, topY, viewId }
   * Positioned on the back edge, on top of overhead cabinets, offset 30mm from wall in positive Z
   */
  const detectEmptySpacesXOverhead = (cabinets: CabinetData[], viewManager?: ViewManager): Array<{
    leftX: number
    rightX: number
    width: number
    topY: number
    viewId: ViewId
  }> => {
    if (!viewManager) {
      console.log('detectEmptySpacesXOverhead: viewManager not available')
      return []
    }

    const emptySpaces: Array<{
      leftX: number
      rightX: number
      width: number
      topY: number
      viewId: ViewId
    }> = []

    // Get all active views
    const activeViews = viewManager.getActiveViews()
    console.log('detectEmptySpacesXOverhead: Active views:', activeViews.length)

    activeViews.forEach((view) => {
      const viewId = view.id
      if (viewId === 'none') return

      // Get all cabinets in this view
      const cabinetIds = viewManager.getCabinetsInView(viewId)
      const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))
      
      // Filter to overhead (top) and tall cabinets (for Top-to-Tall gaps)
      const topCabinets = viewCabinets.filter(c => c.cabinetType === 'top')
      const tallCabinets = viewCabinets.filter(c => c.cabinetType === 'tall')
      const topAndTallCabinets = [...topCabinets, ...tallCabinets]
      console.log(`detectEmptySpacesXOverhead: View ${viewId} has ${topCabinets.length} top cabinets and ${tallCabinets.length} tall cabinets`)

      if (topAndTallCabinets.length < 2) return // Need at least 2 cabinets to have a gap

      // Group by Y position ranges to find cabinets that overlap vertically
      const yRanges: Array<{ minY: number; maxY: number; cabinets: CabinetData[] }> = []

      topAndTallCabinets.forEach((cabinet) => {
        const y = cabinet.group.position.y
        const height = cabinet.carcass.dimensions.height
        const minY = y
        const maxY = y + height

        // Find if this cabinet overlaps with any existing Y range
        let foundRange = false
        for (const range of yRanges) {
          // Check if there's vertical overlap
          if (!(maxY < range.minY || minY > range.maxY)) {
            // Overlaps - merge into this range
            range.minY = Math.min(range.minY, minY)
            range.maxY = Math.max(range.maxY, maxY)
            range.cabinets.push(cabinet)
            foundRange = true
            break
          }
        }

        if (!foundRange) {
          // Create new Y range
          yRanges.push({ minY, maxY, cabinets: [cabinet] })
        }
      })

      // For each Y range, find horizontal gaps between cabinets
      yRanges.forEach((range) => {
        // Sort cabinets by X position (left to right)
        const sortedCabinets = [...range.cabinets].sort((a, b) => {
          const aX = a.group.position.x
          const bX = b.group.position.x
          return aX - bX
        })

        // Find gaps between consecutive cabinets
        for (let i = 0; i < sortedCabinets.length - 1; i++) {
          const leftCabinet = sortedCabinets[i]
          const rightCabinet = sortedCabinets[i + 1]

          // Only detect gaps between Top-Top, Top-Tall, or Tall-Top combinations
          const leftType = leftCabinet.cabinetType
          const rightType = rightCabinet.cabinetType
          
          // Skip if not a valid combination (shouldn't happen, but just in case)
          if ((leftType !== 'top' && leftType !== 'tall') || 
              (rightType !== 'top' && rightType !== 'tall')) {
            continue
          }

          const leftRight = leftCabinet.group.position.x + leftCabinet.carcass.dimensions.width
          const rightLeft = rightCabinet.group.position.x

          // Check if there's a gap (and it's not zero)
          if (rightLeft > leftRight) {
            const gapWidth = rightLeft - leftRight
            
            // Skip zero-width gaps
            if (gapWidth <= 0.1) {
              continue
            }
            
            // Get the top Y position (top of the overhead/tall cabinets)
            // Use the tallest cabinet's top Y (Top-to-Top, Top-to-Tall, Tall-to-Top)
            const leftTopY = leftCabinet.group.position.y + leftCabinet.carcass.dimensions.height
            const rightTopY = rightCabinet.group.position.y + rightCabinet.carcass.dimensions.height
            const topY = Math.max(leftTopY, rightTopY) // Tallest one

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
   * Detect empty spaces in X-axis (width) between cabinets in the same view
   * Returns array of empty space info: { leftX, rightX, width, topY, y, leftCabinetType, rightCabinetType, baseTopY, viewId }
   * Positioned on the back edge, on top of cabinets, offset 30mm from wall in positive Z
   */
  const detectEmptySpacesX = (cabinets: CabinetData[], viewManager?: ViewManager): Array<{
    leftX: number
    rightX: number
    width: number
    topY: number
    y: number
    leftCabinetType: string
    rightCabinetType: string
    baseTopY: number
    viewId: ViewId
  }> => {
    if (!viewManager) {
      console.log('detectEmptySpacesX: viewManager not available')
      return []
    }

    const emptySpaces: Array<{
      leftX: number
      rightX: number
      width: number
      topY: number
      y: number
      leftCabinetType: string
      rightCabinetType: string
      baseTopY: number
      viewId: ViewId
    }> = []

    // Get all active views
    const activeViews = viewManager.getActiveViews()
    console.log('detectEmptySpacesX: Active views:', activeViews.length)

    activeViews.forEach((view) => {
      const viewId = view.id
      if (viewId === 'none') return

      // Get all cabinets in this view
      const cabinetIds = viewManager.getCabinetsInView(viewId)
      const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))
      console.log(`detectEmptySpacesX: View ${viewId} has ${viewCabinets.length} cabinets`)

      if (viewCabinets.length < 2) return // Need at least 2 cabinets to have a gap

      // Group cabinets by their Y position ranges to find horizontal gaps
      // For each Y range, find cabinets that overlap vertically
      const yRanges: Array<{ minY: number; maxY: number; cabinets: CabinetData[] }> = []

      viewCabinets.forEach((cabinet) => {
        const y = cabinet.group.position.y
        const height = cabinet.carcass.dimensions.height
        const minY = y
        const maxY = y + height

        // Find if this cabinet overlaps with any existing Y range
        let foundRange = false
        for (const range of yRanges) {
          // Check if there's vertical overlap
          if (!(maxY < range.minY || minY > range.maxY)) {
            // Overlaps - merge into this range
            range.minY = Math.min(range.minY, minY)
            range.maxY = Math.max(range.maxY, maxY)
            range.cabinets.push(cabinet)
            foundRange = true
            break
          }
        }

        if (!foundRange) {
          // Create new Y range
          yRanges.push({ minY, maxY, cabinets: [cabinet] })
        }
      })

      // For each Y range, find horizontal gaps between cabinets
      yRanges.forEach((range) => {
        // Sort cabinets by X position (left to right)
        const sortedCabinets = [...range.cabinets].sort((a, b) => {
          const aX = a.group.position.x
          const bX = b.group.position.x
          return aX - bX
        })

        // Find gaps between consecutive cabinets
        for (let i = 0; i < sortedCabinets.length - 1; i++) {
          const leftCabinet = sortedCabinets[i]
          const rightCabinet = sortedCabinets[i + 1]

          // Get cabinet types
          const leftCabinetType = leftCabinet.cabinetType
          const rightCabinetType = rightCabinet.cabinetType
          
          // Skip Base-to-Top combinations (don't show gaps between Base and Top)
          if ((leftCabinetType === 'base' && rightCabinetType === 'top') ||
              (leftCabinetType === 'top' && rightCabinetType === 'base')) {
            continue
          }
          
          // Skip Top-to-Base combinations (already handled above, but for clarity)
          // Only process: Base-to-Base, Base-to-Tall, Tall-to-Base, Tall-to-Tall
          
          const leftRight = leftCabinet.group.position.x + leftCabinet.carcass.dimensions.width
          const rightLeft = rightCabinet.group.position.x

          // Check if there's a gap (and it's not zero)
          if (rightLeft > leftRight) {
            const gapWidth = rightLeft - leftRight
            
            // Skip zero-width gaps
            if (gapWidth <= 0.1) {
              continue
            }
            
            // Get the top Y positions
            const leftTopY = leftCabinet.group.position.y + leftCabinet.carcass.dimensions.height
            const rightTopY = rightCabinet.group.position.y + rightCabinet.carcass.dimensions.height
            
            let topY: number
            let baseTopY: number
            
            if (leftCabinetType === 'base' && rightCabinetType === 'base') {
              // Base-to-Base: use the tallest Base cabinet's top Y
              // Filter the range to only base cabinets to get accurate topY
              const baseCabinetsInRange = range.cabinets.filter(c => c.cabinetType === 'base')
              if (baseCabinetsInRange.length > 0) {
                const baseTopYs = baseCabinetsInRange.map(c => 
                  c.group.position.y + c.carcass.dimensions.height
                )
                topY = Math.max(...baseTopYs) // Tallest Base
                baseTopY = topY
              } else {
                // Fallback to the two cabinets
                topY = Math.max(leftTopY, rightTopY)
                baseTopY = topY
              }
            } else if ((leftCabinetType === 'base' && rightCabinetType === 'tall') || 
                       (leftCabinetType === 'tall' && rightCabinetType === 'base')) {
              // Base-to-Tall: use the base cabinet's top Y
              topY = Math.max(leftTopY, rightTopY) // Overall max for reference
              if (leftCabinetType === 'base') {
                baseTopY = leftTopY
              } else {
                baseTopY = rightTopY
              }
            } else {
              // Tall-to-Tall or other combinations: use the maximum top Y
              topY = Math.max(leftTopY, rightTopY)
              baseTopY = topY
            }
            
            // Get the Y position (bottom) of the cabinets
            const leftY = leftCabinet.group.position.y
            const rightY = rightCabinet.group.position.y
            const y = Math.min(leftY, rightY) // Use the lower Y position

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

  /**
   * Create dimension line for empty space in Y-axis (height)
   */
  const createEmptySpaceYDimension = (
    bottomY: number,
    topY: number,
    height: number,
    x: number,
    z: number
  ): THREE.Group => {
    const group = new THREE.Group()
    const color = 0xff6600 // Orange color for empty space dimensions
    const arrowColor = 0x000000
    const lineWidth = 2
    // Position dimension line at left wall, offset by 200mm from boundary wall toward negative X
    const dimensionLineX = -200 // Fixed at left wall, 200mm offset from boundary (X=0)

    // Extension lines - extend from cabinet's X position to the dimension line at left wall
    // z position is already set correctly (at back wall with 30mm offset)
    const extensionBottomGeometry = new THREE.BufferGeometry()
    const extensionBottomPoints = [
      new THREE.Vector3(x, bottomY, z),
      new THREE.Vector3(dimensionLineX, bottomY, z),
    ]
    extensionBottomGeometry.setFromPoints(extensionBottomPoints)
    const extensionBottom = new THREE.Line(extensionBottomGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionBottom)

    const extensionTopGeometry = new THREE.BufferGeometry()
    const extensionTopPoints = [
      new THREE.Vector3(x, topY, z),
      new THREE.Vector3(dimensionLineX, topY, z),
    ]
    extensionTopGeometry.setFromPoints(extensionTopPoints)
    const extensionTop = new THREE.Line(extensionTopGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionTop)

    // Dimension line - z position is already set correctly (at back wall with 30mm offset)
    const lineGeometry = new THREE.BufferGeometry()
    const linePoints = [
      new THREE.Vector3(dimensionLineX, bottomY, z),
      new THREE.Vector3(dimensionLineX, topY, z),
    ]
    lineGeometry.setFromPoints(linePoints)
    const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const line = new THREE.Line(lineGeometry, lineMaterial)
    group.add(line)

    // Arrows
    const arrowBottom = createArrow(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(dimensionLineX, bottomY, z),
      arrowColor
    )
    const arrowTop = createArrow(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dimensionLineX, topY, z),
      arrowColor
    )
    group.add(arrowBottom)
    group.add(arrowTop)

    // Text label - oriented vertically bottom to top
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (context) {
      // Make canvas taller for vertical text
      canvas.width = 64
      canvas.height = 256
      context.fillStyle = "#ff6600"
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      
      // Rotate the canvas context to write text vertically (bottom to top)
      context.save()
      context.translate(canvas.width / 2, canvas.height / 2)
      context.rotate(-Math.PI / 2) // Rotate -90 degrees for bottom-to-top reading
      context.fillText(`${height.toFixed(0)}mm`, 0, 0)
      context.restore()

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set(dimensionLineX - 30, bottomY + height / 2, z)
      // No rotation needed since text is already vertical on canvas
      sprite.scale.set(90, 450, 1) // Swapped scale values to match new canvas dimensions
      group.add(sprite)
    }

    return group
  }

  /**
   * Create dimension line for empty space in X-axis (width) between overhead cabinets
   * Positioned on the back edge, on top of the tallest cabinet, offset 30mm from wall in positive Z
   * Extension line is 100mm
   */
  const createEmptySpaceXOverheadDimension = (
    leftX: number,
    rightX: number,
    width: number,
    topY: number,
    z: number
  ): THREE.Group => {
    const group = new THREE.Group()
    const color = 0xff6600 // Orange color for empty space dimensions
    const arrowColor = 0x000000
    const lineWidth = 2
    const extensionOffset = 100 // Y offset above the top of cabinets (100mm)
    const leftXOffset = applyWallOffset(leftX) // Apply wall offset if inside wall
    const rightXOffset = applyWallOffset(rightX) // Apply wall offset if inside wall

    // Extension lines - from the back edge of cabinets to the dimension line
    // Positioned on top of the tallest cabinet (Top or Tall)
    const extensionLeftGeometry = new THREE.BufferGeometry()
    const extensionLeftPoints = [
      new THREE.Vector3(leftXOffset, topY, z), // Back edge at top of left cabinet
      new THREE.Vector3(leftXOffset, topY + extensionOffset, z), // Dimension line position
    ]
    extensionLeftGeometry.setFromPoints(extensionLeftPoints)
    const extensionLeft = new THREE.Line(extensionLeftGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionLeft)

    const extensionRightGeometry = new THREE.BufferGeometry()
    const extensionRightPoints = [
      new THREE.Vector3(rightXOffset, topY, z), // Back edge at top of right cabinet
      new THREE.Vector3(rightXOffset, topY + extensionOffset, z), // Dimension line position
    ]
    extensionRightGeometry.setFromPoints(extensionRightPoints)
    const extensionRight = new THREE.Line(extensionRightGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionRight)

    // Dimension line - positioned on top of tallest cabinet, at back wall with 30mm offset
    const lineGeometry = new THREE.BufferGeometry()
    const linePoints = [
      new THREE.Vector3(leftXOffset, topY + extensionOffset, z),
      new THREE.Vector3(rightXOffset, topY + extensionOffset, z),
    ]
    lineGeometry.setFromPoints(linePoints)
    const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const line = new THREE.Line(lineGeometry, lineMaterial)
    group.add(line)

    // Arrows
    const arrowLeft = createArrow(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(leftXOffset, topY + extensionOffset, z),
      arrowColor
    )
    const arrowRight = createArrow(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(rightXOffset, topY + extensionOffset, z),
      arrowColor
    )
    group.add(arrowLeft)
    group.add(arrowRight)

    // Text label
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (context) {
      canvas.width = 256
      canvas.height = 64
      context.fillStyle = "#ff6600"
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(`${width.toFixed(0)}mm`, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set((leftXOffset + rightXOffset) / 2, topY + extensionOffset + 30, z)
      sprite.scale.set(300, 75, 1)
      group.add(sprite)
    }

    return group
  }

  /**
   * Create dimension line for empty space in X-axis (width)
   * Positioned on the back edge, on top of cabinets, offset 30mm from wall in positive Z
   * Positioning rules:
   * - Between 2 Base cabinets: display on top of Base cabinets + 100mm extension
   * - Between Base and Tall cabinets: display at Base cabinet's highest Y + 100mm extension
   */
  const createEmptySpaceXDimension = (
    leftX: number,
    rightX: number,
    width: number,
    topY: number,
    y: number,
    leftCabinetType: string,
    rightCabinetType: string,
    baseTopY: number,
    z: number
  ): THREE.Group => {
    const group = new THREE.Group()
    const color = 0xff6600 // Orange color for empty space dimensions
    const arrowColor = 0x000000
    const lineWidth = 2
    const extensionOffset = 100 // Extension line offset (100mm)
    const leftXOffset = applyWallOffset(leftX) // Apply wall offset if inside wall
    const rightXOffset = applyWallOffset(rightX) // Apply wall offset if inside wall

    // Determine positioning based on cabinet types
    const isBaseToBase = leftCabinetType === 'base' && rightCabinetType === 'base'
    const isBaseToTall = (leftCabinetType === 'base' && rightCabinetType === 'tall') || 
                         (leftCabinetType === 'tall' && rightCabinetType === 'base')
    
    let dimensionLineY: number
    let extensionStartY: number
    
    if (isBaseToBase) {
      // Between 2 Base cabinets: display on top of Base cabinets + 100mm extension
      dimensionLineY = topY + extensionOffset
      extensionStartY = topY
    } else if (isBaseToTall) {
      // Between Base and Tall cabinets: display at Base cabinet's highest Y + 100mm extension
      dimensionLineY = baseTopY + extensionOffset
      extensionStartY = baseTopY
    } else {
      // Default: on top of cabinets
      dimensionLineY = topY + extensionOffset
      extensionStartY = topY
    }

    // Extension lines - from the back edge of cabinets to the dimension line
    // All extension lines are 100mm
    const extensionLeftGeometry = new THREE.BufferGeometry()
    const extensionLeftPoints = [
      new THREE.Vector3(leftXOffset, extensionStartY, z), // Back edge at start position
      new THREE.Vector3(leftXOffset, dimensionLineY, z), // Dimension line position
    ]
    extensionLeftGeometry.setFromPoints(extensionLeftPoints)
    const extensionLeft = new THREE.Line(extensionLeftGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionLeft)

    const extensionRightGeometry = new THREE.BufferGeometry()
    const extensionRightPoints = [
      new THREE.Vector3(rightXOffset, extensionStartY, z), // Back edge at start position
      new THREE.Vector3(rightXOffset, dimensionLineY, z), // Dimension line position
    ]
    extensionRightGeometry.setFromPoints(extensionRightPoints)
    const extensionRight = new THREE.Line(extensionRightGeometry, new THREE.LineBasicMaterial({ color, linewidth: lineWidth }))
    group.add(extensionRight)

    // Dimension line - positioned at calculated Y, at back wall with 30mm offset
    const lineGeometry = new THREE.BufferGeometry()
    const linePoints = [
      new THREE.Vector3(leftXOffset, dimensionLineY, z),
      new THREE.Vector3(rightXOffset, dimensionLineY, z),
    ]
    lineGeometry.setFromPoints(linePoints)
    const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth })
    const line = new THREE.Line(lineGeometry, lineMaterial)
    group.add(line)

    // Arrows
    const arrowLeft = createArrow(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(leftXOffset, dimensionLineY, z),
      arrowColor
    )
    const arrowRight = createArrow(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(rightXOffset, dimensionLineY, z),
      arrowColor
    )
    group.add(arrowLeft)
    group.add(arrowRight)

    // Text label
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (context) {
      canvas.width = 256
      canvas.height = 64
      context.fillStyle = "#ff6600"
      context.font = "Bold 32px Arial"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(`${width.toFixed(0)}mm`, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set((leftXOffset + rightXOffset) / 2, dimensionLineY + 30, z)
      sprite.scale.set(300, 75, 1)
      group.add(sprite)
    }

    return group
  }

  /**
   * Update dimension lines for all cabinets
   */
  const updateDimensionLines = useCallback(() => {
    if (!sceneRef.current) return

    // Clear existing dimension lines
    dimensionLinesRef.current.forEach((group) => {
      sceneRef.current!.remove(group)
      // Dispose of geometries and materials
      group.traverse((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        } else if (child instanceof THREE.ArrowHelper) {
          // ArrowHelper cleanup - remove from parent
          // ArrowHelper doesn't have dispose, but its line and cone geometries are managed internally
        } else if (child instanceof THREE.Sprite) {
          if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
            child.material.map.dispose()
            child.material.dispose()
          }
        }
      })
    })
    dimensionLinesRef.current = []

    // If not visible, don't create dimension lines
    if (!visible) {
      return
    }

    // Group cabinets by height to determine which ones should show height dimension
    const cabinetsByHeight = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      const height = cabinet.carcass.dimensions.height
      if (!cabinetsByHeight.has(height)) {
        cabinetsByHeight.set(height, [])
      }
      cabinetsByHeight.get(height)!.push(cabinet)
    })

    // Find leftmost and rightmost cabinets for each height
    const selectedByHeight = new Map<number, string>() // height -> cabinetId
    cabinetsByHeight.forEach((cabs, height) => {
      const leftmost = cabs.reduce((prev, curr) => 
        curr.group.position.x < prev.group.position.x ? curr : prev
      )
      
      // Check if dimension line on leftmost cabinet would penetrate another cabinet
      if (wouldDimensionLinePenetrate(leftmost, cabinets, 50)) {
        // If yes, use rightmost cabinet instead
        const rightmost = cabs.reduce((prev, curr) => 
          curr.group.position.x > prev.group.position.x ? curr : prev
        )
        selectedByHeight.set(height, rightmost.cabinetId)
      } else {
        // If no, use leftmost cabinet
        selectedByHeight.set(height, leftmost.cabinetId)
      }
    })

    // Group cabinets by depth to determine which ones should show depth dimension
    const cabinetsByDepth = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      const depth = cabinet.carcass.dimensions.depth
      if (!cabinetsByDepth.has(depth)) {
        cabinetsByDepth.set(depth, [])
      }
      cabinetsByDepth.get(depth)!.push(cabinet)
    })

    // Find leftmost and rightmost cabinets for each depth
    const selectedByDepth = new Map<number, string>() // depth -> cabinetId
    cabinetsByDepth.forEach((cabs, depth) => {
      const leftmost = cabs.reduce((prev, curr) => 
        curr.group.position.x < prev.group.position.x ? curr : prev
      )
      
      // Check if dimension line on leftmost cabinet would penetrate another cabinet
      if (wouldDimensionLinePenetrate(leftmost, cabinets, 50)) {
        // If yes, use rightmost cabinet instead
        const rightmost = cabs.reduce((prev, curr) => 
          curr.group.position.x > prev.group.position.x ? curr : prev
        )
        selectedByDepth.set(depth, rightmost.cabinetId)
      } else {
        // If no, use leftmost cabinet
        selectedByDepth.set(depth, leftmost.cabinetId)
      }
    })

    // Group cabinets by kicker height to determine which ones should show kicker height dimension (base/tall only)
    const cabinetsByKickerHeight = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      // Only base and tall cabinets have kicker height
      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        const kickerHeight = cabinet.group.position.y // Y position equals kicker height for base/tall
        if (!cabinetsByKickerHeight.has(kickerHeight)) {
          cabinetsByKickerHeight.set(kickerHeight, [])
        }
        cabinetsByKickerHeight.get(kickerHeight)!.push(cabinet)
      }
    })

    // Find leftmost cabinet for each kicker height (always use leftmost, no penetration check)
    const selectedByKickerHeight = new Map<number, string>() // kickerHeight -> cabinetId
    cabinetsByKickerHeight.forEach((cabs, kickerHeight) => {
      const leftmost = cabs.reduce((prev, curr) => 
        curr.group.position.x < prev.group.position.x ? curr : prev
      )
      // Always use leftmost cabinet for kicker height dimension
      selectedByKickerHeight.set(kickerHeight, leftmost.cabinetId)
    })

    // Create dimension lines for each cabinet
    cabinets.forEach((cabinet) => {
      const height = cabinet.carcass.dimensions.height
      const depth = cabinet.carcass.dimensions.depth
      const isSelectedForHeight = selectedByHeight.get(height) === cabinet.cabinetId
      const isSelectedForDepth = selectedByDepth.get(depth) === cabinet.cabinetId
      
      // Check if this cabinet should show kicker height dimension (base/tall only)
      let isSelectedForKickerHeight = false
      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        const kickerHeight = cabinet.group.position.y
        isSelectedForKickerHeight = selectedByKickerHeight.get(kickerHeight) === cabinet.cabinetId
      }
      
      const dimensionGroup = createCabinetDimensionLines(cabinet, isSelectedForHeight, isSelectedForDepth, isSelectedForKickerHeight)
      sceneRef.current!.add(dimensionGroup)
      dimensionLinesRef.current.push(dimensionGroup)
    })

    // Create overall width dimension line (includes all cabinets)
    const overallDimension = createOverallWidthDimension(cabinets)
    if (overallDimension) {
      sceneRef.current!.add(overallDimension)
      dimensionLinesRef.current.push(overallDimension)
    }

    // Check if we need an additional overall width dimension for base/tall cabinets only
    const hasTopCabinets = cabinets.some(c => c.cabinetType === "top")
    
    if (hasTopCabinets) {
      // Calculate overall width including all cabinets
      let allMinX = Infinity
      let allMaxX = -Infinity
      cabinets.forEach((cabinet) => {
        const x = cabinet.group.position.x
        const width = cabinet.carcass.dimensions.width
        allMinX = Math.min(allMinX, x)
        allMaxX = Math.max(allMaxX, x + width)
      })
      const overallWidthAll = allMaxX - allMinX

      // Calculate overall width excluding top cabinets (base/tall only)
      const baseTallCabinets = cabinets.filter(c => c.cabinetType === "base" || c.cabinetType === "tall")
      let baseTallMinX = Infinity
      let baseTallMaxX = -Infinity
      baseTallCabinets.forEach((cabinet) => {
        const x = cabinet.group.position.x
        const width = cabinet.carcass.dimensions.width
        baseTallMinX = Math.min(baseTallMinX, x)
        baseTallMaxX = Math.max(baseTallMaxX, x + width)
      })
      const overallWidthBaseTall = baseTallMaxX - baseTallMinX

      // Only create additional dimension if widths are different
      if (Math.abs(overallWidthAll - overallWidthBaseTall) > 0.1) {
        const baseTallOverallDimension = createBaseTallOverallWidthDimension(cabinets)
        if (baseTallOverallDimension) {
          sceneRef.current!.add(baseTallOverallDimension)
          dimensionLinesRef.current.push(baseTallOverallDimension)
        }
      }
    }

    // Create overall height dimension for each view
    if (viewManager) {
      const overallHeightDimensions = createOverallHeightDimension(cabinets, viewManager)
      overallHeightDimensions.forEach((dimension) => {
        sceneRef.current!.add(dimension)
        dimensionLinesRef.current.push(dimension)
      })
    }

    // Create dimension lines for empty spaces between cabinets in the same view
    if (viewManager) {
      // Detect empty spaces in Y-axis (height)
      const emptySpacesY = detectEmptySpacesY(cabinets, viewManager)
      console.log('Empty spaces Y detected:', emptySpacesY.length, emptySpacesY)
      
      // Group by similar heights (within 1mm tolerance) and only show leftmost for each group
      const heightGroups = new Map<number, Array<typeof emptySpacesY[0]>>()
      const SIMILAR_HEIGHT_TOLERANCE = 1 // 1mm tolerance for "similar" heights
      
      emptySpacesY.forEach((space) => {
        // Find if there's a similar height group
        let foundGroup = false
        for (const [groupHeight, spaces] of Array.from(heightGroups.entries())) {
          if (Math.abs(space.height - groupHeight) <= SIMILAR_HEIGHT_TOLERANCE) {
            spaces.push(space)
            foundGroup = true
            break
          }
        }
        
        if (!foundGroup) {
          // Create new group
          heightGroups.set(space.height, [space])
        }
      })
      
      // For each height group, only show the leftmost dimension
      heightGroups.forEach((spaces) => {
        // Find the leftmost space (smallest leftmostX)
        const leftmostSpace = spaces.reduce((prev, curr) => 
          curr.leftmostX < prev.leftmostX ? curr : prev
        )
        
        // Get the Z position - position at back wall with 30mm offset (positive Z direction)
        // Find a cabinet in the same view to get the Z position
        const viewCabinetIds = viewManager.getCabinetsInView(leftmostSpace.viewId)
        const viewCabinets = cabinets.filter(c => viewCabinetIds.includes(c.cabinetId))
        if (viewCabinets.length > 0) {
          // Position at back wall (z = 0) with 30mm offset in positive Z direction
          const zPos = 30
          
          console.log('Creating Y-axis empty space dimension:', {
            ...leftmostSpace,
            zPos,
            viewCabinetsCount: viewCabinets.length
          })
          const emptySpaceYDimension = createEmptySpaceYDimension(
            leftmostSpace.bottomY,
            leftmostSpace.topY,
            leftmostSpace.height,
            leftmostSpace.leftmostX,
            zPos
          )
          sceneRef.current!.add(emptySpaceYDimension)
          dimensionLinesRef.current.push(emptySpaceYDimension)
        } else {
          console.warn('No cabinets found for view:', leftmostSpace.viewId)
        }
      })

      // Detect empty spaces in X-axis (width) between all cabinets
      const emptySpacesX = detectEmptySpacesX(cabinets, viewManager)
      console.log('Empty spaces X detected:', emptySpacesX.length, emptySpacesX)
      
      // Create dimension lines for all X-axis empty spaces
      // Positioned on the back edge, on top of cabinets, offset 30mm from wall in positive Z
      emptySpacesX.forEach((space) => {
        // Position at back wall (z = 0) with 30mm offset in positive Z direction
        const zPos = 30
        
        console.log('Creating X-axis empty space dimension:', {
          ...space,
          zPos
        })
        const emptySpaceXDimension = createEmptySpaceXDimension(
          space.leftX,
          space.rightX,
          space.width,
          space.topY,
          space.y,
          space.leftCabinetType,
          space.rightCabinetType,
          space.baseTopY,
          zPos
        )
        sceneRef.current!.add(emptySpaceXDimension)
        dimensionLinesRef.current.push(emptySpaceXDimension)
      })
    } else {
      console.log('viewManager is not available for empty space detection')
    }
  }, [sceneRef, cabinets, visible, viewManager])

  // Store cabinets ref and previous positions to track changes
  const cabinetsRef = useRef<CabinetData[]>([])
  const previousPositionsRef = useRef<Map<string, { x: number; y: number; z: number; width: number; height: number; depth: number }>>(new Map())
  const animationFrameRef = useRef<number | null>(null)

  // Update dimension lines when visibility changes
  useEffect(() => {
    updateDimensionLines()
  }, [visible, updateDimensionLines])

  // Update dimension lines when cabinets array changes (add/remove)
  useEffect(() => {
    cabinetsRef.current = cabinets
    updateDimensionLines()
    // Update previous positions
    previousPositionsRef.current.clear()
    cabinets.forEach((cab) => {
      previousPositionsRef.current.set(cab.cabinetId, {
        x: cab.group.position.x,
        y: cab.group.position.y,
        z: cab.group.position.z,
        width: cab.carcass.dimensions.width,
        height: cab.carcass.dimensions.height,
        depth: cab.carcass.dimensions.depth,
      })
    })
  }, [cabinets.length, updateDimensionLines])

  // Update dimension lines continuously in animation loop to track position changes
  useEffect(() => {
    const updateLoop = () => {
      let needsUpdate = false
      
      // Check if number of cabinets changed
      if (cabinetsRef.current.length !== previousPositionsRef.current.size) {
        needsUpdate = true
      } else {
        // Check if any cabinet position or dimension has changed
        for (const cabinet of cabinetsRef.current) {
          const prev = previousPositionsRef.current.get(cabinet.cabinetId)
          
          if (!prev) {
            needsUpdate = true
            break
          }
          
          const current = {
            x: cabinet.group.position.x,
            y: cabinet.group.position.y,
            z: cabinet.group.position.z,
            width: cabinet.carcass.dimensions.width,
            height: cabinet.carcass.dimensions.height,
            depth: cabinet.carcass.dimensions.depth,
          }
          
          // Check if position or dimensions changed
          if (
            Math.abs(prev.x - current.x) > 0.1 ||
            Math.abs(prev.y - current.y) > 0.1 ||
            Math.abs(prev.z - current.z) > 0.1 ||
            Math.abs(prev.width - current.width) > 0.1 ||
            Math.abs(prev.height - current.height) > 0.1 ||
            Math.abs(prev.depth - current.depth) > 0.1
          ) {
            needsUpdate = true
            // Update stored position
            previousPositionsRef.current.set(cabinet.cabinetId, current)
          }
        }
      }
      
      if (needsUpdate) {
        updateDimensionLines()
        // Update all positions after update
        cabinetsRef.current.forEach((cab) => {
          previousPositionsRef.current.set(cab.cabinetId, {
            x: cab.group.position.x,
            y: cab.group.position.y,
            z: cab.group.position.z,
            width: cab.carcass.dimensions.width,
            height: cab.carcass.dimensions.height,
            depth: cab.carcass.dimensions.depth,
          })
        })
      }
      
      animationFrameRef.current = requestAnimationFrame(updateLoop)
    }
    
    animationFrameRef.current = requestAnimationFrame(updateLoop)
    
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [updateDimensionLines])

  return {
    updateDimensionLines,
  }
}

