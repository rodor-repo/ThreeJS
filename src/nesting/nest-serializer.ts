/**
 * Serialization utilities for nesting
 * Converts CabinetData to serializable format for URL transmission
 */

import type { CabinetData } from '@/features/scene/types'
import type { PartData } from './PartDataManager'
import { getPartDataManager } from './PartDataManager'
import type { WsProducts } from '@/types/erpTypes'

export interface SerializableCabinet {
  cabinetId: string
  cabinetType: string
  subcategoryId: string
  productId?: string
  viewId?: string
  sortNumber?: number // Cabinet number for labeling
  cabinetName?: string // Product name from wsProducts
  dimensions: {
    width: number
    height: number
    depth: number
  }
  materialColor?: string
  materialThickness?: number
  doorEnabled?: boolean
  doorCount?: number
  drawerEnabled?: boolean
  drawerQuantity?: number
  shelfCount?: number
  parts?: PartData[] // Include part data with standardized names
}

/**
 * Serialize CabinetData to a format that can be JSON stringified
 * Includes part data from PartDataManager with standardized names and product names
 */
export function serializeCabinetsForNesting(
  cabinets: CabinetData[],
  wsProducts?: WsProducts | null
): SerializableCabinet[] {
  const partDataManager = getPartDataManager()
  
  // Set wsProducts in PartDataManager if provided
  if (wsProducts) {
    partDataManager.setWsProducts(wsProducts)
    // Ensure all cabinets are updated with latest wsProducts
    partDataManager.updateAllCabinets(cabinets)
  }
  
  return cabinets.map((cabinet) => {
    const carcass = cabinet.carcass
    const dimensions = carcass.dimensions
    const material = carcass.material
    const config = (carcass as any).config || {}
    
    // Get part data from PartDataManager (includes standardized names and product names)
    const cabinetParts = partDataManager.getCabinetParts(cabinet.cabinetId)
    
    // Get product name from wsProducts if available
    let cabinetName: string | undefined
    if (cabinet.productId && wsProducts?.products?.[cabinet.productId]) {
      cabinetName = wsProducts.products[cabinet.productId].product
    }

    return {
      cabinetId: cabinet.cabinetId,
      cabinetType: cabinet.cabinetType,
      subcategoryId: cabinet.subcategoryId,
      productId: cabinet.productId,
      viewId: cabinet.viewId,
      sortNumber: cabinet.sortNumber, // Include cabinet number
      cabinetName: cabinetName, // Include product name from wsProducts
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
        depth: dimensions.depth,
      },
      materialColor: material?.getColour(),
      materialThickness: material?.getThickness(),
      doorEnabled: config.doorEnabled,
      doorCount: config.doorCount,
      drawerEnabled: config.drawerEnabled,
      drawerQuantity: config.drawerQuantity,
      shelfCount: config.shelfCount || 0,
      parts: cabinetParts.length > 0 ? cabinetParts : undefined, // Include part data with standardized names
    }
  })
}

/**
 * Convert serialized cabinets back to a format usable by the mapper
 */
export function deserializeCabinetsForNesting(
  serialized: SerializableCabinet[]
): any[] {
  // Return as-is since mapper will work with the serialized format
  return serialized as any[]
}

