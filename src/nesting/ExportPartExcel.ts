/**
 * Export nesting parts to Excel/CSV format
 * Exports all parts with detailed information including dimensions
 */

import type { Part, PlacedPart } from './nest-types'
import { MaterialLoader } from '@/features/carcass/MaterialLoader'

export interface ExportPartRow {
  cabinetNumber: string | number
  cabinetName: string
  partName: string
  partHeight: number // Biggest Dimension (X, Y, or Z)
  partDepth: number // Second Biggest Dimension (Either X or Z value)
  partThickness: number // Smallest Dimension (X, Y, or Z)
  materialName: string
}

/**
 * Get original 3D dimensions from part data
 * Uses stored originalDimX, originalDimY, originalDimZ if available
 * Otherwise falls back to reconstruction
 */
function getOriginalDimensions(part: Part): {
  dimX: number
  dimY: number
  dimZ: number
} {
  // If original dimensions are stored, use them
  if (
    part.originalDimX !== undefined &&
    part.originalDimY !== undefined &&
    part.originalDimZ !== undefined
  ) {
    return {
      dimX: part.originalDimX,
      dimY: part.originalDimY,
      dimZ: part.originalDimZ,
    }
  }
  
  // Fallback: reconstruct from width/height (less accurate)
  // Estimate thickness based on common material thicknesses
  const estimatedThickness = Math.min(part.originalWidth, part.originalHeight, 20)
  
  return {
    dimX: part.width,
    dimY: part.height,
    dimZ: estimatedThickness,
  }
}

/**
 * Get material name from MaterialLoader using material color
 * For doors/drawers/kickers, uses door materials; for others, uses carcass materials
 * Falls back to part's materialName if no match found
 */
function getMaterialName(
  materialColor: string,
  materialThickness: number,
  partName?: string,
  fallbackMaterialName?: string
): string {
  try {
    // Determine if this is a door, drawer, or kicker part
    const isDoor = partName?.includes('Door') || false
    const isDrawer = partName?.includes('Drawer') || partName?.includes('Drawer Front') || false
    const isKicker = partName?.includes('Kicker') || false
    
    // For doors, drawers, and kickers, use door materials
    if (isDoor || isDrawer || isKicker) {
      const doorMaterialName = MaterialLoader.findDoorMaterialNameByColor(materialColor, materialThickness)
      // If we found a match (not the default), return it
      if (doorMaterialName !== 'Door Material') {
        return doorMaterialName
      }
      // Otherwise fall back to provided name
      return fallbackMaterialName || doorMaterialName
    }
    
    // For carcass parts, use carcass materials
    const carcassMaterialName = MaterialLoader.findCarcassMaterialNameByColor(materialColor, materialThickness)
    // If we found a match (not the default), return it
    if (carcassMaterialName !== 'Carcass Material') {
      return carcassMaterialName
    }
    // Otherwise fall back to provided name
    return fallbackMaterialName || carcassMaterialName
  } catch (error) {
    console.error('Error getting material name:', error)
    return fallbackMaterialName || 'Unknown Material'
  }
}

/**
 * Convert part to export row format
 */
function partToExportRow(part: Part): ExportPartRow {
  const { dimX, dimY, dimZ } = getOriginalDimensions(part)
  
  // Sort dimensions to easily pick biggest, second biggest, smallest
  const sortedDims = [dimX, dimY, dimZ].sort((a, b) => b - a) // Descending
  
  // Part Height (Column D) = Biggest Dimension of the Part
  const partHeight = sortedDims[0]
  
  // Part Depth = Second Biggest Dimension (of all X, Y, Z)
  const partDepth = sortedDims[1]
  
  // Part Thickness (Column F) = Smallest value of the part Dimensions
  const partThickness = sortedDims[2]
  
  // Estimate material thickness from part dimensions (smallest dimension is usually thickness)
  // Default to 18mm for doors/drawers/kickers, 16mm for carcass parts
  const isDoor = part.partName?.includes('Door') || false
  const isDrawer = part.partName?.includes('Drawer') || part.partName?.includes('Drawer Front') || false
  const isKicker = part.partName?.includes('Kicker') || false
  const estimatedThickness = (isDoor || isDrawer || isKicker) ? 18 : 16
  
  return {
    cabinetNumber: part.cabinetNumber ?? '',
    cabinetName: part.cabinetName || part.cabinetType || 'Unknown Cabinet',
    partName: part.partName || 'Unknown Part',
    partHeight, // Biggest Dimension (X, Y, or Z)
    partDepth, // Second Biggest Dimension (Either X or Z value)
    partThickness, // Smallest Dimension (X, Y, or Z)
    materialName: getMaterialName(part.materialColor, estimatedThickness, part.partName, part.materialName),
  }
}

/**
 * Convert export rows to CSV format
 */
function rowsToCSV(rows: ExportPartRow[]): string {
  // CSV Header
  const headers = [
    'Cabinet Number',
    'Cabinet Name',
    'Part Name',
    'Part Height (Biggest Dimension)',
    'Part Depth (Second Biggest Dimension)',
    'Part Thickness (Smallest Dimension)',
    'Part Materials',
  ]
  
  // Create CSV rows
  const csvRows = [
    headers.join(','), // Header row
    ...rows.map(row => [
      row.cabinetNumber.toString(),
      `"${row.cabinetName.replace(/"/g, '""')}"`, // Escape quotes in CSV
      `"${row.partName.replace(/"/g, '""')}"`,
      row.partHeight.toString(),
      row.partDepth.toString(),
      row.partThickness.toString(),
      `"${row.materialName.replace(/"/g, '""')}"`,
    ].join(',')),
  ]
  
  return csvRows.join('\n')
}

/**
 * Export parts to CSV file
 * @param parts - Array of parts to export
 * @param filename - Optional filename (default: "nesting-parts-{timestamp}.csv")
 */
export function exportPartsToCSV(
  parts: Part[] | PlacedPart[],
  filename?: string
): void {
  // Convert parts to export rows
  const rows = parts.map(part => partToExportRow(part))
  
  // Generate CSV content
  const csvContent = rowsToCSV(rows)
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  // Generate filename if not provided
  const defaultFilename = filename || `nesting-parts-${Date.now()}.csv`
  
  link.setAttribute('href', url)
  link.setAttribute('download', defaultFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up
  URL.revokeObjectURL(url)
}

/**
 * Export parts to Excel format (using CSV format that Excel can open)
 * Note: This creates a CSV file that Excel can open directly
 * For true Excel format (.xlsx), you would need a library like 'xlsx'
 */
export function exportPartsToExcel(
  parts: Part[] | PlacedPart[],
  filename?: string
): void {
  // For now, use CSV format (Excel can open CSV files)
  // If true Excel format is needed, consider using 'xlsx' library
  exportPartsToCSV(parts, filename?.replace('.xlsx', '.csv') || `nesting-parts-${Date.now()}.csv`)
}

