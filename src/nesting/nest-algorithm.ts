/**
 * Skyline / Bottom-Left algorithm
 * for 2D sheet nesting with rotation + grain support
 */

import type {
  Part,
  PlacedPart,
  Sheet,
  NestingResult,
  NestingConfig,
} from './nest-types'

type Rotation = 0 | 90 | 180 | 270

interface SkylineNode {
  x: number
  y: number
  width: number
}

interface SkylineSheet extends Sheet {
  skyline: SkylineNode[]
}

/**
 * Rotation + grain rules
 */
function canRotate(
  part: Part,
  rotation: Rotation,
  config: NestingConfig
): boolean {
  // No rotation allowed at all
  if (!config.allowRotation) {
    return rotation === 0
  }

  // Sheet has grain: only 0° and 180° maintain grain
  if (config.grainDirection && config.grainDirection !== 'none') {
    return rotation === 0 || rotation === 180
  }

  // Part has grain: only 0° and 180° maintain grain
  if (part.grainDirection && part.grainDirection !== 'none') {
    return rotation === 0 || rotation === 180
  }

  // Otherwise, all rotations allowed
  return true
}

/**
 * Get rotated dimensions of a rectangle-like object
 */
function getRotatedDimensions(
  item: { width: number; height: number },
  rotation: Rotation
): { width: number; height: number } {
  if (rotation === 0 || rotation === 180) {
    return { width: item.width, height: item.height }
  } else {
    // 90° or 270° swaps width and height
    return { width: item.height, height: item.width }
  }
}

/**
 * Rotated footprint of a placed part on the sheet (what actually touches the sheet).
 * Uses originalWidth/originalHeight to calculate the rotated footprint.
 */
export function getPlacedFootprint(placed: PlacedPart): { width: number; height: number } {
  return getRotatedDimensions(
    { width: placed.originalWidth, height: placed.originalHeight },
    placed.rotation as Rotation
  )
}

/**
 * Rotation priority, filtered by what is actually allowed.
 * Prefers 0° first.
 */
function getRotationPriority(part: Part, config: NestingConfig): Rotation[] {
  const baseOrder: Rotation[] = config.allowRotation ? [0, 180, 90, 270] : [0]
  const allowed = baseOrder.filter(r => canRotate(part, r, config))
  return allowed.length > 0 ? allowed : [0]
}

/**
 * Initialise skyline for a new sheet: one flat segment across whole width.
 */
function initSkyline(sheetWidth: number): SkylineNode[] {
  return [
    {
      x: 0,
      y: 0,
      width: sheetWidth,
    },
  ]
}

/**
 * Find best placement on skyline for a rectangle (width x height).
 * Returns lowest possible y, then leftmost x among those.
 * Uses bottom-left placement strategy.
 * Accounts for cuttingToolsThick spacing between parts and sheet boundaries.
 *
 * Assumes skyline segments:
 * - are sorted by x
 * - do not overlap in x
 */
function findSkylinePosition(
  sheet: SkylineSheet,
  rectWidth: number,
  rectHeight: number,
  cuttingToolsThick: number = 0
): { x: number; y: number } | null {
  const { width: sheetWidth, height: sheetHeight } = sheet
  const skyline = sheet.skyline

  // Account for spacing: effective sheet size is reduced by cuttingToolsThick on all sides
  const effectiveSheetWidth = sheetWidth - 2 * cuttingToolsThick
  const effectiveSheetHeight = sheetHeight - 2 * cuttingToolsThick

  // Edge case: empty skyline
  if (skyline.length === 0) {
    if (rectWidth <= effectiveSheetWidth && rectHeight <= effectiveSheetHeight) {
      return { x: cuttingToolsThick, y: cuttingToolsThick }
    }
    return null
  }

  let bestY = Number.POSITIVE_INFINITY
  let bestX = 0
  let found = false

  // Try each skyline segment as a potential left edge
  for (let i = 0; i < skyline.length; i++) {
    const node = skyline[i]
    // Start position: add spacing from left edge (cuttingToolsThick) or from previous part (node.x + cuttingToolsThick)
    const xStart = Math.max(node.x + cuttingToolsThick, cuttingToolsThick)

    // Check if rect would exceed sheet width (accounting for spacing on right)
    if (xStart + rectWidth > sheetWidth - cuttingToolsThick) continue

    const xEnd = xStart + rectWidth
    // Start Y position: add spacing from bottom (cuttingToolsThick) or from previous part (node.y + cuttingToolsThick)
    let yCandidate = Math.max(node.y + cuttingToolsThick, cuttingToolsThick)
    let widthCovered = 0

    // Since segments are sorted and non-overlapping, only segments from i onwards can overlap
    for (let j = i; j < skyline.length; j++) {
      const seg = skyline[j]
      const segStart = seg.x
      const segEnd = seg.x + seg.width

      // No more overlap possible
      if (segStart >= xEnd) break

      // Skip if this segment is entirely before the rectangle
      if (segEnd <= xStart) continue

      const overlapStart = Math.max(segStart, xStart)
      const overlapEnd = Math.min(segEnd, xEnd)
      const overlapWidth = overlapEnd - overlapStart

      if (overlapWidth > 0) {
        widthCovered += overlapWidth
        // When checking vertical position, account for spacing above the previous part
        // The skyline tracks the top of placed parts, so we add spacing below the new part
        if (seg.y + cuttingToolsThick > yCandidate) {
          yCandidate = seg.y + cuttingToolsThick
        }
      }

      // Early exit: we've covered the full width
      if (widthCovered >= rectWidth) break
    }

    // If we didn't cover full rectWidth, can't place here
    if (widthCovered < rectWidth) continue

    // Check vertical fit (accounting for spacing at top)
    if (yCandidate + rectHeight > sheetHeight - cuttingToolsThick) continue

    // Choose best (lowest y, then leftmost x)
    if (
      yCandidate < bestY ||
      (yCandidate === bestY && xStart < bestX)
    ) {
      bestY = yCandidate
      bestX = xStart
      found = true
    }
  }

  return found ? { x: bestX, y: bestY } : null
}

/**
 * Insert rectangle into skyline and update segments.
 * Splits overlapping segments and merges adjacent segments with same Y.
 * Accounts for cuttingToolsThick spacing when updating skyline.
 */
function addRectToSkyline(
  sheet: SkylineSheet,
  x: number,
  width: number,
  y: number,
  height: number,
  cuttingToolsThick: number = 0
): void {
  const skyline = sheet.skyline
  const xStart = x
  const xEnd = x + width
  // Add spacing below the part when updating skyline
  const newY = y + height + cuttingToolsThick

  const newSkyline: SkylineNode[] = []

  // Process each existing segment
  for (const node of skyline) {
    const nodeStart = node.x
    const nodeEnd = node.x + node.width

    // No overlap with [xStart, xEnd): keep as is
    if (nodeEnd <= xStart || nodeStart >= xEnd) {
      newSkyline.push(node)
      continue
    }

    // Left remainder (part before the placed rectangle)
    if (nodeStart < xStart) {
      newSkyline.push({
        x: nodeStart,
        y: node.y,
        width: xStart - nodeStart,
      })
    }

    // Right remainder (part after the placed rectangle)
    if (nodeEnd > xEnd) {
      newSkyline.push({
        x: xEnd,
        y: node.y,
        width: nodeEnd - xEnd,
      })
    }
    // Overlapped middle is replaced by new node below
  }

  // Add the new node for the placed rectangle (top edge of the rectangle)
  newSkyline.push({
    x: xStart,
    y: newY,
    width,
  })

  // Sort by x coordinate
  newSkyline.sort((a, b) => a.x - b.x)

  // Merge adjacent segments with same Y
  const merged: SkylineNode[] = []
  for (const node of newSkyline) {
    const last = merged[merged.length - 1]
    if (last && last.y === node.y && last.x + last.width === node.x) {
      // Merge with previous segment
      last.width += node.width
    } else {
      // Add as new segment
      merged.push({ ...node })
    }
  }

  sheet.skyline = merged
}

/**
 * Try to place a part on a sheet using skyline packing.
 */
function tryPlaceOnSheet(
  part: Part,
  sheet: SkylineSheet,
  config: NestingConfig
): PlacedPart | null {
  // Rotations are already filtered by canRotate in getRotationPriority
  const rotations = getRotationPriority(part, config)
  const cuttingToolsThick = config.cuttingToolsThick ?? 10 // Default 10mm

  for (const rotation of rotations) {
    const { width, height } = getRotatedDimensions(part, rotation)
    const position = findSkylinePosition(sheet, width, height, cuttingToolsThick)

    if (!position) continue

    // IMPORTANT:
    // Override width/height on the placed part with the *oriented* dimensions.
    // This is what your renderer should use to draw the rectangle.
    const placedPart: PlacedPart = {
      ...part,
      width,           // oriented width
      height,          // oriented height
      x: position.x,
      y: position.y,
      rotation,
      sheetIndex: sheet.index,
    }

    // Update skyline using the same oriented dimensions and spacing
    addRectToSkyline(sheet, position.x, width, position.y, height, cuttingToolsThick)

    return placedPart
  }

  return null
}

/**
 * Compute a sort key for a part based on the chosen strategy.
 */
function getPartSortKey(part: Part, strategy: 'height' | 'maxSide' | 'area'): number {
  switch (strategy) {
    case 'maxSide':
      return Math.max(part.width, part.height)
    case 'area':
      return part.width * part.height
    case 'height':
    default:
      return part.height
  }
}

/**
 * Sort parts using the configured strategy (descending).
 */
function sortParts(parts: Part[], config: NestingConfig): Part[] {
  const strategy = config.sortStrategy ?? 'height'
  return [...parts].sort(
    (a, b) => getPartSortKey(b, strategy) - getPartSortKey(a, strategy)
  )
}

/**
 * Main Skyline nesting algorithm
 */
export function nestParts(
  parts: Part[],
  config: NestingConfig
): NestingResult {
  const sortedParts = sortParts(parts, config)

  const sheets: SkylineSheet[] = []
  const placedParts: PlacedPart[] = []
  const unplacedParts: Part[] = []

  for (const part of sortedParts) {
    let placed = false

    // Try existing sheets
    for (const sheet of sheets) {
      const placedPart = tryPlaceOnSheet(part, sheet, config)
      if (placedPart) {
        sheet.parts.push(placedPart)
        placedParts.push(placedPart)
        placed = true
        break
      }
    }

    // If not placed, try a new sheet
    if (!placed) {
      const newSheet: SkylineSheet = {
        index: sheets.length,
        width: config.sheetSize.width,
        height: config.sheetSize.height,
        parts: [],
        shelves: [], // Empty for skyline algorithm, kept for type compatibility
        skyline: initSkyline(config.sheetSize.width),
      }

      const placedPart = tryPlaceOnSheet(part, newSheet, config)
      if (placedPart) {
        newSheet.parts.push(placedPart)
        placedParts.push(placedPart)
        sheets.push(newSheet)
        placed = true
      } else {
        // Too big for sheet size
        unplacedParts.push(part)
      }
    }
  }

  // Calculate material usage and efficiency
  const totalSheetArea = sheets.reduce(
    (sum, sheet) => sum + sheet.width * sheet.height,
    0
  )

  // Area uses original part dims; rotation does not change area
  const totalUsedArea = placedParts.reduce(
    (sum, part) => sum + part.width * part.height,
    0
  )

  const materialWaste = totalSheetArea - totalUsedArea
  const materialEfficiency =
    totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0

  return {
    sheets, // SkylineSheet[] is compatible with Sheet[]
    totalSheets: sheets.length,
    materialWaste,
    materialEfficiency,
    totalParts: parts.length,
    placedParts: placedParts.length,
    // If you want to expose for debugging:
    // unplacedParts,
  }
}
