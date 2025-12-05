import { CarcassMaterial, CarcassMaterialData } from "./Material"

// Try to import categoriesData - uncomment the line below when data is available
// import { categoriesData } from "../../components/categoriesData"

// Helper function to get materials array - uses the same source as getAvailableMaterialIds
function getMaterialsArray(): any[] {
  try {
    // Access the carcassMaterials array from the imported data
    // Uncomment the line below when categoriesData import is available
    // const materials = (categoriesData as any)?.carcassMaterials || []
    
    // For now, try to access via window if loaded globally, or return empty array
    // This allows the code to work when data is loaded via script tag or other means
    if (typeof window !== 'undefined' && (window as any).categoriesData) {
      return (window as any).categoriesData.carcassMaterials || []
    }
    
    const materials: any[] = []
    return materials
  } catch (error) {
    console.error("Error getting materials array:", error)
    return []
  }
}

// Helper function to get door materials array
function getDoorMaterialsArray(): any[] {
  try {
    // Access doorMaterials from window (loaded globally via script tag)
    if (typeof window !== 'undefined' && (window as any).doorMaterials) {
      return (window as any).doorMaterials || []
    }
    
    const materials: any[] = []
    return materials
  } catch (error) {
    console.error("Error getting door materials array:", error)
    return []
  }
}

export class MaterialLoader {
  /**
   * Load a carcass material by ID from the data file
   * @param materialId - The ID of the material to load
   * @returns The CarcassMaterial instance or null if not found
   */
  static loadMaterialById(materialId: string): CarcassMaterial | null {
    try {
      const materials = getMaterialsArray()
      const materialData = materials.find((mat: any) => mat.id === materialId)

      if (materialData) {
        return CarcassMaterial.fromData(materialData as CarcassMaterialData)
      }

      console.warn(
        `Material with ID '${materialId}' not found. Using default material.`
      )
      return CarcassMaterial.getDefaultMaterial()
    } catch (error) {
      console.error("Error loading material:", error)
      return CarcassMaterial.getDefaultMaterial()
    }
  }

  /**
   * Get all available material IDs from the data file
   * @returns Array of material IDs
   */
  static getAvailableMaterialIds(): string[] {
    try {
      const materials = getMaterialsArray()
      return materials.map((mat: any) => mat.id)
    } catch (error) {
      console.error("Error getting material IDs:", error)
      return []
    }
  }

  /**
   * Get all available materials from the data file
   * @returns Array of CarcassMaterial instances
   */
  static getAllMaterials(): CarcassMaterial[] {
    try {
      const materials = getMaterialsArray()
      return materials.map((mat: any) =>
        CarcassMaterial.fromData(mat as CarcassMaterialData)
      )
    } catch (error) {
      console.error("Error getting all materials:", error)
      return [CarcassMaterial.getDefaultMaterial()]
    }
  }

  /**
   * Get all available materials with their full data including name and id
   * @returns Array of material objects with id, name, and CarcassMaterial instance
   */
  static getAllMaterialsWithNames(): Array<{
    id: string
    name: string
    description?: string
    material: CarcassMaterial
  }> {
    try {
      const materials = getMaterialsArray()
      
      // If materials array is empty, return hardcoded fallback material
      if (materials.length === 0) {
        const fallbackMaterialData: CarcassMaterialData = {
          colour: '#ffffff',
          panelThickness: 16,
          backThickness: 16,
          opacity: 0.9,
          transparent: true
        }
        return [{
          id: 'white-melamine-particleboard-stipple-16mm',
          name: 'White Melamine Particleboard /Stipple -16mm',
          description: 'White Melamine Particleboard with Stipple finish, 16mm thickness',
          material: CarcassMaterial.fromData(fallbackMaterialData)
        }]
      }
      
      return materials.map((mat: any) => ({
        id: mat.id || '',
        name: mat.name || mat.id || 'Unknown Material',
        description: mat.description,
        material: CarcassMaterial.fromData({
          colour: mat.colour || '#ffffff',
          panelThickness: mat.panelThickness || 16,
          backThickness: mat.backThickness || mat.panelThickness || 16,
          opacity: mat.opacity ?? 0.9,
          transparent: mat.transparent ?? true
        } as CarcassMaterialData),
      }))
    } catch (error) {
      console.error("Error getting all materials with names:", error)
      // Return fallback material even on error
      const fallbackMaterialData: CarcassMaterialData = {
        colour: '#ffffff',
        panelThickness: 16,
        backThickness: 16,
        opacity: 0.9,
        transparent: true
      }
      return [{
        id: 'white-melamine-particleboard-stipple-16mm',
        name: 'White Melamine Particleboard /Stipple -16mm',
        description: 'White Melamine Particleboard with Stipple finish, 16mm thickness',
        material: CarcassMaterial.fromData(fallbackMaterialData)
      }]
    }
  }

  /**
   * Check if a material ID exists in the data file
   * @param materialId - The ID to check
   * @returns True if the material exists, false otherwise
   */
  static materialExists(materialId: string): boolean {
    try {
      const materials = getMaterialsArray()
      return materials.some((mat: any) => mat.id === materialId)
    } catch (error) {
      console.error("Error checking material existence:", error)
      return false
    }
  }

  /**
   * Get the Base Rail depth for a specific cabinet type
   * @param cabinetType - The cabinet type ('base', 'top', 'tall')
   * @returns The Base Rail depth in mm, or default 60mm for base cabinets
   */
  static getBaseRailDepth(cabinetType: "top" | "base" | "tall"): number {
    try {
      if (cabinetType === "base") {
        // Get Base Rail depth from data, fallback to default
        // const baseRailSetting = categoriesData.baseRailSetting?.default || 60
        const baseRailSetting = 60
        return baseRailSetting
      }
      // For non-base cabinets, return 0 (no Base Rail)
      return 0
    } catch (error) {
      console.error("Error getting Base Rail depth:", error)
      return cabinetType === "base" ? 60 : 0
    }
  }

  /**
   * Get the leg height for Base and Tall cabinet types
   * @returns The leg height in mm, or default 100mm
   */
  static getLegHeight(): number {
    try {
      // Get leg height from mutable data (runtime changes) or fallback to static data
      const legHeight = 100
      // this.mutableData.legHeight || categoriesData.legSettings?.default || 100
      return legHeight
    } catch (error) {
      console.error("Error getting leg height:", error)
      return 100
    }
  }

  // Mutable data store for runtime changes
  private static mutableData = {
    legHeight: 100,
  }

  /**
   * Update the leg height in the data file
   * @param newHeight - The new leg height in mm
   */
  static updateLegHeight(newHeight: number): void {
    try {
      this.mutableData.legHeight = newHeight
    } catch (error) {
      console.error("Error updating leg height:", error)
    }
  }

  /**
   * Get all available door materials with their full data including name and id
   * @returns Array of door material objects with id, name, and material data
   */
  static getAllDoorMaterialsWithNames(): Array<{
    id: string
    name: string
    description?: string
    colour: string
    thickness: number
  }> {
    try {
      const doorMaterials = getDoorMaterialsArray()
      
      // If door materials array is empty, return empty array
      if (doorMaterials.length === 0) {
        return []
      }
      
      return doorMaterials.map((mat: any) => ({
        id: mat.id || '',
        name: mat.name || mat.id || 'Unknown Door Material',
        description: mat.description,
        colour: mat.colour || '#ffffff',
        thickness: mat.thickness || 18,
      }))
    } catch (error) {
      console.error("Error getting all door materials with names:", error)
      return []
    }
  }

  /**
   * Find carcass material name by matching color and thickness
   * @param color - Hex color string from CarcassMaterial
   * @param thickness - Thickness from CarcassMaterial
   * @returns Material name if found, otherwise fallback name
   */
  static findCarcassMaterialNameByColor(color: string, thickness: number): string {
    try {
      const materials = this.getAllMaterialsWithNames()
      const normalizedColor = color.toLowerCase().replace('#', '')
      
      // Try to find a material that matches the color (and optionally thickness)
      for (const mat of materials) {
        const matColor = mat.material.getColour().toLowerCase().replace('#', '')
        const matThickness = mat.material.getThickness()
        
        // Match by color (and thickness if close enough - within 2mm tolerance)
        if (matColor === normalizedColor && Math.abs(matThickness - thickness) <= 2) {
          return mat.name
        }
      }
      
      // If no exact match, try matching just by color
      for (const mat of materials) {
        const matColor = mat.material.getColour().toLowerCase().replace('#', '')
        if (matColor === normalizedColor) {
          return mat.name
        }
      }
      
      return 'Carcass Material'
    } catch (error) {
      console.error('Error finding carcass material name by color:', error)
      return 'Carcass Material'
    }
  }

  /**
   * Find door material name by matching color and thickness
   * @param color - Hex color string from DoorMaterial
   * @param thickness - Thickness from DoorMaterial
   * @returns Material name if found, otherwise fallback name
   */
  static findDoorMaterialNameByColor(color: string, thickness: number): string {
    try {
      const doorMaterials = this.getAllDoorMaterialsWithNames()
      const normalizedColor = color.toLowerCase().replace('#', '')
      
      // Try to find a door material that matches the color (and optionally thickness)
      for (const mat of doorMaterials) {
        const matColor = mat.colour.toLowerCase().replace('#', '')
        const matThickness = mat.thickness
        
        // Match by color (and thickness if close enough - within 2mm tolerance)
        if (matColor === normalizedColor && Math.abs(matThickness - thickness) <= 2) {
          return mat.name
        }
      }
      
      // If no exact match, try matching just by color
      for (const mat of doorMaterials) {
        const matColor = mat.colour.toLowerCase().replace('#', '')
        if (matColor === normalizedColor) {
          return mat.name
        }
      }
      
      return 'Door Material'
    } catch (error) {
      console.error('Error finding door material name by color:', error)
      return 'Door Material'
    }
  }
}
