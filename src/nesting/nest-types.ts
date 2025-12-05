/**
 * Core types for 2D sheet nesting system
 */

export interface SheetSize {
  width: number
  height: number
  label: string
}

export interface Part {
  id: string
  label: string // Kept for backward compatibility, but not displayed
  width: number
  height: number
  materialId: string
  materialName: string
  materialColor: string
  grainDirection?: 'horizontal' | 'vertical' | 'none' // Timber materials have grain direction
  cabinetId?: string
  cabinetType?: string
  cabinetNumber?: number // Cabinet number from sortNumber
  cabinetName?: string // Formatted cabinet name (e.g., "Base Cabinet", "Tall Cabinet")
  partName?: string // Part name (e.g., "Left Panel", "Top Panel", "Door 1")
  originalWidth: number
  originalHeight: number
  // Original 3D dimensions (X, Y, Z) before taking 2 biggest
  originalDimX?: number // Original X dimension (width or thickness)
  originalDimY?: number // Original Y dimension (height)
  originalDimZ?: number // Original Z dimension (depth or thickness)
}

export interface PlacedPart extends Part {
  x: number
  y: number
  rotation: 0 | 90 | 180 | 270
  sheetIndex: number
}

export interface Sheet {
  index: number
  width: number
  height: number
  parts: PlacedPart[]
  shelves: Shelf[]
}

export interface Shelf {
  y: number
  height: number
  width: number
  parts: PlacedPart[]
}

export interface NestingResult {
  sheets: Sheet[]
  totalSheets: number
  materialWaste: number
  materialEfficiency: number
  totalParts: number
  placedParts: number
}

export interface NestingConfig {
  sheetSize: SheetSize
  materialId: string
  materialName: string
  allowRotation: boolean
  grainDirection?: 'horizontal' | 'vertical' | 'none'
  /**
   * How to sort parts before nesting:
   * - 'height'  (default): by original height, descending
   * - 'maxSide': by max(width, height), descending
   * - 'area':    by area (width*height), descending
   */
  sortStrategy?: 'height' | 'maxSide' | 'area'
  /**
   * Cutting tools thickness (spacing between parts and sheet boundaries)
   * Default: 10mm
   */
  cuttingToolsThick?: number
}

