/**
 * Part Data Manager
 * Maintains a database of all part dimensions (X, Y, Z) for each cabinet in the scene
 * Updates automatically when cabinets are added, modified, or deleted
 */

import type { CabinetData } from '@/features/scene/types'
import type { CarcassAssembly } from '@/features/carcass/CarcassAssembly'
import { MaterialLoader } from '@/features/carcass/MaterialLoader'
import type { MaterialOptionsResponse, DefaultMaterialSelections } from '@/server/getProductData'
import { cabinetPanelState } from '@/features/cabinets/ui/ProductPanel'

export interface PartData {
  partId: string
  cabinetId: string
  cabinetType: string
  cabinetNumber?: number
  cabinetName: string
  partName: string
  dimX: number // X dimension (width/thickness)
  dimY: number // Y dimension (height)
  dimZ: number // Z dimension (depth/thickness)
  materialId: string
  materialName: string
  materialColor: string
  lastUpdated: number // Timestamp
}

export interface CabinetPartData {
  cabinetId: string
  cabinetType: string
  cabinetNumber?: number
  parts: PartData[]
  lastUpdated: number
}

/**
 * PartDataManager - Manages part dimension database
 */
export class PartDataManager {
  private partDatabase: Map<string, CabinetPartData> = new Map()
  private wsProducts: any = null // WsProducts | null
  // Store materialOptions and defaultMaterialSelections per productId
  private materialOptionsMap: Map<string, MaterialOptionsResponse> = new Map()
  private defaultMaterialSelectionsMap: Map<string, DefaultMaterialSelections> = new Map()
  // Store materialSelections per cabinetId (from ProductPanel)
  private materialSelectionsMap: Map<string, Record<string, { priceRangeId: string, colorId: string, finishId?: string }>> = new Map()

  /**
   * Set wsProducts for product name lookup
   * Updates all existing cabinets with new product names
   */
  public setWsProducts(wsProducts: any): void {
    const wasChanged = this.wsProducts !== wsProducts
    this.wsProducts = wsProducts
    
    // If wsProducts changed, update all existing cabinets to refresh their names
    if (wasChanged) {
      const cabinetIds = Array.from(this.partDatabase.keys())
      // Note: We need the actual CabinetData objects to update, but we only have stored parts
      // So we'll update the stored cabinetName in each part
      this.partDatabase.forEach((cabinetData, cabinetId) => {
        // Try to find product name from wsProducts
        // We need to reconstruct the cabinet info from stored data
        const firstPart = cabinetData.parts[0]
        if (firstPart && wsProducts?.products) {
          // We don't have productId stored, so we can't update names here
          // The names will be updated on the next updateCabinetParts call
        }
      })
    }
  }

  /**
   * Set materialOptions for a productId
   */
  public setMaterialOptions(productId: string, materialOptions: MaterialOptionsResponse): void {
    this.materialOptionsMap.set(productId, materialOptions)
  }

  /**
   * Set defaultMaterialSelections for a productId
   */
  public setDefaultMaterialSelections(productId: string, defaultMaterialSelections: DefaultMaterialSelections): void {
    this.defaultMaterialSelectionsMap.set(productId, defaultMaterialSelections)
  }

  /**
   * Set materialSelections for a cabinetId (from ProductPanel)
   */
  public setMaterialSelections(cabinetId: string, materialSelections: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>): void {
    this.materialSelectionsMap.set(cabinetId, materialSelections)
  }

  /**
   * Get door color name from materialOptions using colorId
   * Returns color name if found, otherwise falls back to MaterialLoader lookup
   */
  private getDoorColorName(
    productId: string | undefined,
    cabinetId: string,
    doorMaterialColor: string,
    doorMaterialThickness: number,
    wsProducts?: any
  ): string {
    // Try to get color name from materialOptions
    if (productId) {
      const materialOptions = this.materialOptionsMap.get(productId)
      const defaultMaterialSelections = this.defaultMaterialSelectionsMap.get(productId)
      
      // Get materialSelections from cabinetPanelState (ProductPanel's state)
      const persistedState = cabinetPanelState.get(cabinetId)
      const materialSelections = persistedState?.materialSelections

      if (materialOptions && wsProducts?.products?.[productId]?.materials) {
        // Find door material ID from wsProduct.materials
        // Look for materials with materialType === "Door"
        const productMaterials = wsProducts.products[productId].materials
        let doorMaterialId: string | undefined

        for (const [materialId, material] of Object.entries(productMaterials)) {
          // Check if this material is a door material by materialType
          if ((material as any).materialType === 'Door') {
            doorMaterialId = materialId
            break
          }
        }

        // If we found a door material ID, get its color name
        if (doorMaterialId) {
          const mOpts = materialOptions[doorMaterialId]
          if (mOpts) {
            // Get colorId from materialSelections (user selection) or defaultMaterialSelections (API default)
            const selection = materialSelections?.[doorMaterialId] || defaultMaterialSelections?.[doorMaterialId]
            const colorId = selection?.colorId

            if (colorId) {
              // Find the priceRange containing this colorId
              // First try the priceRangeId from selection, then search all priceRanges
              const priceRangeId = selection?.priceRangeId
              if (priceRangeId && mOpts.priceRanges[priceRangeId]) {
                const priceRange = mOpts.priceRanges[priceRangeId]
                if (colorId in priceRange.colorOptions) {
                  const colorOption = priceRange.colorOptions[colorId]
                  if (colorOption?.color) {
                    return colorOption.color
                  }
                }
              }

              // If not found in specific priceRange, search all priceRanges
              for (const priceRange of Object.values(mOpts.priceRanges)) {
                if (colorId in priceRange.colorOptions) {
                  const colorOption = priceRange.colorOptions[colorId]
                  if (colorOption?.color) {
                    return colorOption.color
                  }
                }
              }
            }
          }
        }
      }
    }

    // Fallback to MaterialLoader lookup by color
    return MaterialLoader.findDoorMaterialNameByColor(doorMaterialColor, doorMaterialThickness)
  }

  /**
   * Get product name from wsProducts or fallback to formatted cabinet type
   */
  private getCabinetName(cabinet: CabinetData): string {
    // Try to get product name from wsProducts
    if (cabinet.productId && this.wsProducts?.products?.[cabinet.productId]) {
      return this.wsProducts.products[cabinet.productId].product
    }
    
    // Fallback to formatted cabinet type
    return this.formatCabinetName(cabinet.cabinetType)
  }

  /**
   * Map part names to standardized export names
   */
  private mapPartName(originalPartName: string): string {
    const nameMap: Record<string, string> = {
      'Left Panel': 'End-L',
      'Right Panel': 'End-R',
      'Back Panel': 'Back',
      'Base Rail': 'Rail',
      'Bottom Panel': 'Bottom',
      'Top Panel': 'Top',
    }
    
    return nameMap[originalPartName] || originalPartName
  }

  /**
   * Update part data for a cabinet
   * Extracts actual part dimensions from CarcassAssembly
   */
  public updateCabinetParts(cabinet: CabinetData): void {
    try {
      const carcass = cabinet.carcass
      const partDimensions = carcass.getPartDimensions()
      
      // Get carcass material instance
      const carcassMaterial = carcass.material
      const carcassMaterialColor = carcassMaterial?.getColour() || '#ffffff'
      const carcassMaterialThickness = carcassMaterial?.getThickness() || 16
      
      // Get door material instance for doors/drawers/kickers
      const doorMaterial = carcass.config.doorMaterial
      const doorMaterialColor = doorMaterial?.getColour() || '#ffffff'
      const doorMaterialThickness = doorMaterial?.getThickness() || 18
      
      const parts: PartData[] = partDimensions.map((partDim, index) => {
        // Determine if this is a door, drawer, or kicker part
        const isDoor = partDim.partName.includes('Door')
        const isDrawer = partDim.partName.includes('Drawer') || partDim.partName.includes('Drawer Front')
        const isKicker = partDim.partName.includes('Kicker')
        
        // Use door material for doors/drawers/kickers, carcass material for others
        let materialColor: string
        let materialName: string
        
        if (isDoor || isDrawer || isKicker) {
          // Get material name from DoorMaterial instance
          // First try to get color name from materialOptions using colorId
          // Then fallback to MaterialLoader lookup by color
          materialColor = doorMaterialColor
          materialName = this.getDoorColorName(cabinet.productId, cabinet.cabinetId, doorMaterialColor, doorMaterialThickness, this.wsProducts)
        } else {
          // Get material name from CarcassMaterial instance by matching color
          materialColor = carcassMaterialColor
          materialName = MaterialLoader.findCarcassMaterialNameByColor(carcassMaterialColor, carcassMaterialThickness)
        }

        return {
          partId: `${cabinet.cabinetId}-${partDim.partName.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          cabinetId: cabinet.cabinetId,
          cabinetType: cabinet.cabinetType,
          cabinetNumber: cabinet.sortNumber,
          cabinetName: this.getCabinetName(cabinet),
          partName: this.mapPartName(partDim.partName),
          dimX: partDim.dimX,
          dimY: partDim.dimY,
          dimZ: partDim.dimZ,
          materialId: 'default', // Could be enhanced to use actual material ID
          materialName, // Uses actual material name from MaterialLoader based on color match
          materialColor, // Uses door material color for doors/drawers/kickers, carcass material color for others
          lastUpdated: Date.now(),
        }
      })

      // Store cabinet part data
      this.partDatabase.set(cabinet.cabinetId, {
        cabinetId: cabinet.cabinetId,
        cabinetType: cabinet.cabinetType,
        cabinetNumber: cabinet.sortNumber,
        parts,
        lastUpdated: Date.now(),
      })
    } catch (error) {
      console.error(`Error updating parts for cabinet ${cabinet.cabinetId}:`, error)
    }
  }

  /**
   * Remove cabinet parts from database
   */
  public removeCabinetParts(cabinetId: string): void {
    this.partDatabase.delete(cabinetId)
  }

  /**
   * Get all parts for a specific cabinet
   */
  public getCabinetParts(cabinetId: string): PartData[] {
    const cabinetData = this.partDatabase.get(cabinetId)
    return cabinetData?.parts || []
  }

  /**
   * Get all parts from all cabinets
   */
  public getAllParts(): PartData[] {
    const allParts: PartData[] = []
    this.partDatabase.forEach((cabinetData) => {
      allParts.push(...cabinetData.parts)
    })
    return allParts
  }

  /**
   * Update all cabinets in the scene
   */
  public updateAllCabinets(cabinets: CabinetData[]): void {
    // Update existing cabinets
    cabinets.forEach((cabinet) => {
      this.updateCabinetParts(cabinet)
    })

    // Remove cabinets that no longer exist
    const currentCabinetIds = new Set(cabinets.map((c) => c.cabinetId))
    const cabinetsToRemove: string[] = []
    this.partDatabase.forEach((_, cabinetId) => {
      if (!currentCabinetIds.has(cabinetId)) {
        cabinetsToRemove.push(cabinetId)
      }
    })
    cabinetsToRemove.forEach((cabinetId) => {
      this.removeCabinetParts(cabinetId)
    })
  }

  /**
   * Clear all part data
   */
  public clear(): void {
    this.partDatabase.clear()
  }

  /**
   * Get database statistics
   */
  public getStats(): {
    totalCabinets: number
    totalParts: number
    lastUpdated: number | null
  } {
    let totalParts = 0
    let lastUpdated: number | null = null

    this.partDatabase.forEach((cabinetData) => {
      totalParts += cabinetData.parts.length
      if (!lastUpdated || cabinetData.lastUpdated > lastUpdated) {
        lastUpdated = cabinetData.lastUpdated
      }
    })

    return {
      totalCabinets: this.partDatabase.size,
      totalParts,
      lastUpdated,
    }
  }

  /**
   * Format cabinet type to readable name
   */
  private formatCabinetName(cabinetType: string): string {
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
    return typeMap[cabinetType.toLowerCase()] || 
           cabinetType.charAt(0).toUpperCase() + cabinetType.slice(1) + ' Cabinet'
  }

  /**
   * Export database to JSON (for debugging/persistence)
   */
  public exportToJSON(): string {
    const data: Record<string, CabinetPartData> = {}
    this.partDatabase.forEach((cabinetData, cabinetId) => {
      data[cabinetId] = cabinetData
    })
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import database from JSON (for debugging/persistence)
   */
  public importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as Record<string, CabinetPartData>
      this.partDatabase.clear()
      Object.entries(data).forEach(([cabinetId, cabinetData]) => {
        this.partDatabase.set(cabinetId, cabinetData)
      })
    } catch (error) {
      console.error('Error importing part data from JSON:', error)
    }
  }
}

// Singleton instance
let partDataManagerInstance: PartDataManager | null = null

/**
 * Get the singleton PartDataManager instance
 */
export function getPartDataManager(): PartDataManager {
  if (!partDataManagerInstance) {
    partDataManagerInstance = new PartDataManager()
  }
  return partDataManagerInstance
}

