/**
 * Mapper function to extract parts from 3D scene
 * Converts cabinet data into 2D parts for nesting
 * Uses PartDataManager for live cabinets to ensure consistency with export format
 */

import type { CabinetData } from '@/features/scene/types'
import type { Part } from './nest-types'
import type { SerializableCabinet } from './nest-serializer'
import { getPartDataManager } from './PartDataManager'

/**
 * Get the 2 biggest dimensions from 3D part dimensions (X, Y, Z)
 * Returns width (largest) and height (second largest)
 */
function getTwoBiggestDimensions(
  dimX: number,
  dimY: number,
  dimZ: number
): { width: number; height: number } {
  // Sort dimensions in descending order
  const sorted = [dimX, dimY, dimZ].sort((a, b) => b - a)
  // Return the 2 biggest: width (largest) and height (second largest)
  return {
    width: sorted[0],
    height: sorted[1],
  }
}

/**
 * Format cabinet type to a readable name
 */
function formatCabinetName(cabinetType: string): string {
  const typeMap: Record<string, string> = {
    base: 'Base Cabinet',
    top: 'Overhead Cabinet',
    tall: 'Tall Cabinet',
    panel: 'Panel',
    filler: 'Filler',
    wardrobe: 'Wardrobe',
    kicker: 'Kicker',
    bulkhead: 'Bulkhead',
  }
  return typeMap[cabinetType.toLowerCase()] || cabinetType.charAt(0).toUpperCase() + cabinetType.slice(1) + ' Cabinet'
}

/**
 * Extract all parts from cabinets in the scene
 * Accepts either CabinetData[] or SerializableCabinet[]
 */
export function extractPartsFromScene(
  cabinets: CabinetData[] | SerializableCabinet[]
): Part[] {
  const parts: Part[] = []

  for (const cabinet of cabinets) {
    if (!cabinet) {
      console.warn('Skipping null/undefined cabinet')
      continue
    }

    // Handle both CabinetData and SerializableCabinet formats
    // Check if it's serialized by looking for dimensions property and absence of carcass/group
    const isSerialized = 
      typeof cabinet === 'object' && 
      'dimensions' in cabinet && 
      !('carcass' in cabinet) &&
      !('group' in cabinet)
    
    let dimensions: { width: number; height: number; depth: number }
    let materialColor: string
    let materialThickness: number
    let doorEnabled: boolean | undefined
    let doorCount: number | undefined
    let drawerEnabled: boolean | undefined
    let drawerQuantity: number | undefined
    let shelfCount: number
    let cabinetNumber: number | undefined
    let cabinetName: string

    try {
      if (isSerialized) {
        const serializedCabinet = cabinet as SerializableCabinet
        dimensions = serializedCabinet.dimensions
        materialColor = serializedCabinet.materialColor || '#ffffff'
        materialThickness = serializedCabinet.materialThickness || 16
        doorEnabled = serializedCabinet.doorEnabled
        doorCount = serializedCabinet.doorCount
        drawerEnabled = serializedCabinet.drawerEnabled
        drawerQuantity = serializedCabinet.drawerQuantity
        shelfCount = serializedCabinet.shelfCount || 0
        cabinetNumber = serializedCabinet.sortNumber
        // Use product name from serialized data if available, otherwise fallback to formatted type
        cabinetName = serializedCabinet.cabinetName || formatCabinetName(serializedCabinet.cabinetType)
      } else {
        const cabinetData = cabinet as CabinetData
        const carcass = cabinetData.carcass
        dimensions = carcass.dimensions
        const config = carcass.config
        const material = config.material
        materialColor = material?.getColour() || '#ffffff'
        materialThickness = material?.getThickness() || 16
        doorEnabled = config.doorEnabled
        doorCount = config.doorCount
        drawerEnabled = config.drawerEnabled
        drawerQuantity = config.drawerQuantity
        shelfCount = config.shelfCount || 0
        cabinetNumber = cabinetData.sortNumber
        cabinetName = formatCabinetName(cabinetData.cabinetType)
      }

      // Validate dimensions
      if (!dimensions || 
          !dimensions.width || dimensions.width <= 0 ||
          !dimensions.height || dimensions.height <= 0 ||
          !dimensions.depth || dimensions.depth <= 0) {
        console.warn(`Skipping cabinet ${cabinet.cabinetId} - invalid dimensions:`, dimensions)
        continue
      }

      // Validate cabinet has required properties
      if (!cabinet.cabinetId || !cabinet.cabinetType) {
        console.warn('Skipping cabinet - missing cabinetId or cabinetType:', cabinet)
        continue
      }
    } catch (error) {
      console.error(`Error processing cabinet ${cabinet.cabinetId ?? 'unknown'}:`, error)
      continue
    }

    // Determine if material has grain direction (timber materials)
    // This is a simplified check - you may need to enhance this based on your material data
    const hasGrainDirection = materialColor !== '#ffffff' && materialColor !== '#000000'
    const grainDirection: 'horizontal' | 'vertical' | 'none' = hasGrainDirection
      ? 'horizontal'
      : 'none'

    // If we have access to the actual CarcassAssembly (not serialized), use PartDataManager
    // This ensures we use the same standardized names and dimensions as the export (Excel columns D & E)
    if (!isSerialized) {
      const cabinetData = cabinet as CabinetData
      const partDataManager = getPartDataManager()
      const cabinetParts = partDataManager.getCabinetParts(cabinet.cabinetId)
      
      // If PartDataManager has data for this cabinet, use it (includes standardized names)
      if (cabinetParts.length > 0) {
        for (const partData of cabinetParts) {
          // Calculate Part Height (biggest dimension) and Part Depth (second biggest dimension)
          // Same as Excel columns D and E
          const sortedDims = [partData.dimX, partData.dimY, partData.dimZ].sort((a, b) => b - a)
          const partHeight = sortedDims[0] // Biggest dimension (Column D - Part Height)
          const partDepth = sortedDims[1] // Second biggest dimension (Column E - Part Depth)
          
          // Determine grain direction
          const hasGrainDirection = partData.materialColor !== '#ffffff' && partData.materialColor !== '#000000'
          const partGrainDirection: 'horizontal' | 'vertical' | 'none' = hasGrainDirection
            ? 'horizontal'
            : 'none'
          
          parts.push({
            id: partData.partId,
            label: `${cabinet.cabinetType} ${cabinet.cabinetId} - ${partData.partName}`,
            width: partHeight, // Use Part Height (biggest dimension) as width for nesting
            height: partDepth, // Use Part Depth (second biggest dimension) as height for nesting
            materialId: partData.materialId,
            materialName: partData.materialName,
            materialColor: partData.materialColor,
            grainDirection: partData.partName.includes('Door') || partData.partName.includes('Drawer')
              ? 'none'
              : partGrainDirection,
            cabinetId: partData.cabinetId,
            cabinetType: partData.cabinetType,
            cabinetNumber: partData.cabinetNumber,
            cabinetName: partData.cabinetName, // Uses product name from wsProducts
            partName: partData.partName, // Uses standardized names (End-L, End-R, Back, Rail, Bottom, Top)
            originalWidth: partHeight,
            originalHeight: partDepth,
            originalDimX: partData.dimX,
            originalDimY: partData.dimY,
            originalDimZ: partData.dimZ,
          })
        }
        continue // Skip the old calculation method for non-serialized cabinets
      }
      
      // Fallback: if PartDataManager doesn't have data yet, use direct calculation
      // This can happen if cabinets are being processed before PartDataManager is updated
      const carcass = cabinetData.carcass
      const partDimensions = carcass.getPartDimensions()
      
      // Create parts from actual part dimensions
      for (const partDim of partDimensions) {
        const partDims = getTwoBiggestDimensions(partDim.dimX, partDim.dimY, partDim.dimZ)
        parts.push({
          id: `${cabinet.cabinetId}-${partDim.partName.toLowerCase().replace(/\s+/g, '-')}`,
          label: `${cabinet.cabinetType} ${cabinet.cabinetId} - ${partDim.partName}`,
          width: partDims.width,
          height: partDims.height,
          materialId: 'default',
          materialName: partDim.partName.includes('Door') || partDim.partName.includes('Drawer') 
            ? 'Door Material' 
            : 'Carcass Material',
          materialColor,
          grainDirection: partDim.partName.includes('Door') || partDim.partName.includes('Drawer')
            ? 'none'
            : grainDirection,
          cabinetId: cabinet.cabinetId,
          cabinetType: cabinet.cabinetType,
          cabinetNumber,
          cabinetName,
          partName: partDim.partName,
          originalWidth: partDims.width,
          originalHeight: partDims.height,
          originalDimX: partDim.dimX,
          originalDimY: partDim.dimY,
          originalDimZ: partDim.dimZ,
        })
      }
      continue // Skip the old calculation method for non-serialized cabinets
    }

    // For serialized cabinets, check if we have part data from PartDataManager
    // If available, use it (includes standardized names and correct dimensions)
    if (isSerialized) {
      const serializedCabinet = cabinet as SerializableCabinet
      
      // If serialized cabinet has parts data, use it (preferred method)
      if (serializedCabinet.parts && serializedCabinet.parts.length > 0) {
        for (const partData of serializedCabinet.parts) {
          // Calculate Part Height (biggest dimension) and Part Depth (second biggest dimension)
          // Same as Excel columns D and E
          const sortedDims = [partData.dimX, partData.dimY, partData.dimZ].sort((a, b) => b - a)
          const partHeight = sortedDims[0] // Biggest dimension (Column D - Part Height)
          const partDepth = sortedDims[1] // Second biggest dimension (Column E - Part Depth)
          
          // Determine grain direction
          const hasGrainDirection = partData.materialColor !== '#ffffff' && partData.materialColor !== '#000000'
          const partGrainDirection: 'horizontal' | 'vertical' | 'none' = hasGrainDirection
            ? 'horizontal'
            : 'none'
          
          parts.push({
            id: partData.partId,
            label: `${cabinet.cabinetType} ${cabinet.cabinetId} - ${partData.partName}`,
            width: partHeight, // Use Part Height (biggest dimension) as width for nesting
            height: partDepth, // Use Part Depth (second biggest dimension) as height for nesting
            materialId: partData.materialId,
            materialName: partData.materialName,
            materialColor: partData.materialColor,
            grainDirection: partData.partName.includes('Door') || partData.partName.includes('Drawer')
              ? 'none'
              : partGrainDirection,
            cabinetId: partData.cabinetId,
            cabinetType: partData.cabinetType,
            cabinetNumber: partData.cabinetNumber,
            cabinetName: partData.cabinetName, // Uses product name from wsProducts
            partName: partData.partName, // Uses standardized names (End-L, End-R, Back, Rail, Bottom, Top)
            originalWidth: partHeight,
            originalHeight: partDepth,
            originalDimX: partData.dimX,
            originalDimY: partData.dimY,
            originalDimZ: partData.dimZ,
          })
        }
        continue // Skip the old calculation method
      }
    }
    
    // For serialized cabinets without part data, use calculated dimensions (fallback)
    // Extract panels from the cabinet
    // Use the 2 biggest dimensions from each part's 3D dimensions (X, Y, Z)
    
    // 1. Left panel: depth (Z) x height (Y) x thickness (X = materialThickness)
    const leftPanelDims = getTwoBiggestDimensions(
      materialThickness,
      dimensions.height,
      dimensions.depth
    )
    parts.push({
      id: `${cabinet.cabinetId}-left-panel`,
      label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Left Panel`, // Kept for backward compatibility
      width: leftPanelDims.width,
      height: leftPanelDims.height,
      materialId: 'default',
      materialName: 'Carcass Material',
      materialColor,
      grainDirection,
      cabinetId: cabinet.cabinetId,
      cabinetType: cabinet.cabinetType,
      cabinetNumber,
      cabinetName,
      partName: 'Left Panel',
      originalWidth: leftPanelDims.width,
      originalHeight: leftPanelDims.height,
      originalDimX: materialThickness, // X = thickness
      originalDimY: dimensions.height, // Y = height
      originalDimZ: dimensions.depth, // Z = depth
    })

    // 2. Right panel: depth (Z) x height (Y) x thickness (X = materialThickness)
    const rightPanelDims = getTwoBiggestDimensions(
      materialThickness,
      dimensions.height,
      dimensions.depth
    )
    parts.push({
      id: `${cabinet.cabinetId}-right-panel`,
      label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Right Panel`, // Kept for backward compatibility
      width: rightPanelDims.width,
      height: rightPanelDims.height,
      materialId: 'default',
      materialName: 'Carcass Material',
      materialColor,
      grainDirection,
      cabinetId: cabinet.cabinetId,
      cabinetType: cabinet.cabinetType,
      cabinetNumber,
      cabinetName,
      partName: 'Right Panel',
      originalWidth: rightPanelDims.width,
      originalHeight: rightPanelDims.height,
      originalDimX: materialThickness, // X = thickness
      originalDimY: dimensions.height, // Y = height
      originalDimZ: dimensions.depth, // Z = depth
    })

    // 3. Top panel: width (X) x depth (Z) x thickness (Y = materialThickness)
    const topPanelDims = getTwoBiggestDimensions(
      dimensions.width,
      materialThickness,
      dimensions.depth
    )
    parts.push({
      id: `${cabinet.cabinetId}-top-panel`,
      label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Top Panel`, // Kept for backward compatibility
      width: topPanelDims.width,
      height: topPanelDims.height,
      materialId: 'default',
      materialName: 'Carcass Material',
      materialColor,
      grainDirection,
      cabinetId: cabinet.cabinetId,
      cabinetType: cabinet.cabinetType,
      cabinetNumber,
      cabinetName,
      partName: 'Top Panel',
      originalWidth: topPanelDims.width,
      originalHeight: topPanelDims.height,
      originalDimX: dimensions.width, // X = width
      originalDimY: materialThickness, // Y = thickness
      originalDimZ: dimensions.depth, // Z = depth
    })

    // 4. Bottom panel (for base/tall/wardrobe cabinets): width (X) x depth (Z) x thickness (Y = materialThickness)
    if (cabinet.cabinetType === 'base' || cabinet.cabinetType === 'tall' || cabinet.cabinetType === 'wardrobe') {
      const bottomPanelDims = getTwoBiggestDimensions(
        dimensions.width,
        materialThickness,
        dimensions.depth
      )
      parts.push({
        id: `${cabinet.cabinetId}-bottom-panel`,
        label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Bottom Panel`, // Kept for backward compatibility
        width: bottomPanelDims.width,
        height: bottomPanelDims.height,
        materialId: 'default',
        materialName: 'Carcass Material',
        materialColor,
        grainDirection,
        cabinetId: cabinet.cabinetId,
        cabinetType: cabinet.cabinetType,
        cabinetNumber,
        cabinetName,
        partName: 'Bottom Panel',
        originalWidth: bottomPanelDims.width,
        originalHeight: bottomPanelDims.height,
        originalDimX: dimensions.width, // X = width
        originalDimY: materialThickness, // Y = thickness
        originalDimZ: dimensions.depth, // Z = depth
      })
    }

    // 5. Back panel: width (X) x height (Y) x thickness (Z = materialThickness)
    const backPanelDims = getTwoBiggestDimensions(
      dimensions.width,
      dimensions.height,
      materialThickness
    )
    parts.push({
      id: `${cabinet.cabinetId}-back-panel`,
      label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Back Panel`, // Kept for backward compatibility
      width: backPanelDims.width,
      height: backPanelDims.height,
      materialId: 'default',
      materialName: 'Carcass Material',
      materialColor,
      grainDirection,
      cabinetId: cabinet.cabinetId,
      cabinetType: cabinet.cabinetType,
      cabinetNumber,
      cabinetName,
      partName: 'Back Panel',
      originalWidth: backPanelDims.width,
      originalHeight: backPanelDims.height,
      originalDimX: dimensions.width, // X = width
      originalDimY: dimensions.height, // Y = height
      originalDimZ: materialThickness, // Z = thickness
    })

    // 6. Shelves (if any): width (X) x depth (Z) x thickness (Y = materialThickness)
    for (let i = 0; i < shelfCount; i++) {
      const shelfWidth = dimensions.width - materialThickness * 2 // Account for side panels
      const shelfDims = getTwoBiggestDimensions(
        shelfWidth,
        materialThickness,
        dimensions.depth
      )
      parts.push({
        id: `${cabinet.cabinetId}-shelf-${i}`,
        label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Shelf ${i + 1}`, // Kept for backward compatibility
        width: shelfDims.width,
        height: shelfDims.height,
        materialId: 'default',
        materialName: 'Carcass Material',
        materialColor,
        grainDirection,
        cabinetId: cabinet.cabinetId,
        cabinetType: cabinet.cabinetType,
        cabinetNumber,
        cabinetName,
        partName: `Shelf ${i + 1}`,
        originalWidth: shelfDims.width,
        originalHeight: shelfDims.height,
        originalDimX: shelfWidth, // X = width
        originalDimY: materialThickness, // Y = thickness
        originalDimZ: dimensions.depth, // Z = depth
      })
    }

    // 7. Doors (if enabled): width (X) x height (Y) x thickness (Z = door thickness, typically ~20mm)
    if (doorEnabled && doorCount) {
      const doorWidth = dimensions.width / doorCount
      const doorThickness = 20 // Typical door thickness
      const doorDims = getTwoBiggestDimensions(
        doorWidth,
        dimensions.height,
        doorThickness
      )
      for (let i = 0; i < doorCount; i++) {
        parts.push({
          id: `${cabinet.cabinetId}-door-${i}`,
          label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Door ${i + 1}`, // Kept for backward compatibility
          width: doorDims.width,
          height: doorDims.height,
          materialId: 'default', // Door material ID if available
          materialName: 'Door Material',
          materialColor: materialColor,
          grainDirection: 'none', // Doors typically don't have grain restrictions
          cabinetId: cabinet.cabinetId,
          cabinetType: cabinet.cabinetType,
          cabinetNumber,
          cabinetName,
          partName: `Door ${i + 1}`,
          originalWidth: doorDims.width,
          originalHeight: doorDims.height,
          originalDimX: doorWidth, // X = width
          originalDimY: dimensions.height, // Y = height
          originalDimZ: doorThickness, // Z = thickness
        })
      }
    }

    // 8. Drawer fronts (if enabled): width (X) x height (Y) x thickness (Z = drawer front thickness, typically ~20mm)
    if (drawerEnabled && drawerQuantity) {
      const drawerFrontThickness = 20 // Typical drawer front thickness
      for (let i = 0; i < drawerQuantity; i++) {
        const drawerHeight = dimensions.height / drawerQuantity
        const drawerDims = getTwoBiggestDimensions(
          dimensions.width,
          drawerHeight,
          drawerFrontThickness
        )
        parts.push({
          id: `${cabinet.cabinetId}-drawer-front-${i}`,
          label: `${cabinet.cabinetType} ${cabinet.cabinetId} - Drawer Front ${i + 1}`, // Kept for backward compatibility
          width: drawerDims.width,
          height: drawerDims.height,
          materialId: 'default', // Drawer material ID if available
          materialName: 'Drawer Material',
          materialColor: materialColor,
          grainDirection: 'none',
          cabinetId: cabinet.cabinetId,
          cabinetType: cabinet.cabinetType,
          cabinetNumber,
          cabinetName,
          partName: `Drawer Front ${i + 1}`,
          originalWidth: drawerDims.width,
          originalHeight: drawerDims.height,
          originalDimX: dimensions.width, // X = width
          originalDimY: drawerHeight, // Y = height
          originalDimZ: drawerFrontThickness, // Z = thickness
        })
      }
    }
  }

  console.log(`Extracted ${parts.length} parts from ${cabinets.length} cabinets`)
  // Debug: Check if cabinet numbers are being extracted
  const partsWithNumbers = parts.filter(p => p.cabinetNumber !== undefined)
  const partsWithoutNumbers = parts.filter(p => p.cabinetNumber === undefined)
  if (partsWithoutNumbers.length > 0) {
    console.warn(`Warning: ${partsWithoutNumbers.length} parts missing cabinetNumber. Sample:`, partsWithoutNumbers[0])
  }
  if (partsWithNumbers.length > 0) {
    console.log(`Parts with cabinet numbers: ${partsWithNumbers.length}. Sample:`, {
      cabinetNumber: partsWithNumbers[0].cabinetNumber,
      cabinetName: partsWithNumbers[0].cabinetName,
      partName: partsWithNumbers[0].partName
    })
  }
  return parts
}

