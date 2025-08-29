import { CarcassMaterial, CarcassMaterialData } from './Material';
import { categoriesData } from '../categoriesData';

export class MaterialLoader {
  /**
   * Load a carcass material by ID from the data file
   * @param materialId - The ID of the material to load
   * @returns The CarcassMaterial instance or null if not found
   */
  static loadMaterialById(materialId: string): CarcassMaterial | null {
    try {
      // Access the carcassMaterials array from the imported data
      const materials = categoriesData.carcassMaterials || [];
      
      const materialData = materials.find((mat: any) => mat.id === materialId);
      
      if (materialData) {
        return CarcassMaterial.fromData(materialData as CarcassMaterialData);
      }
      
      console.warn(`Material with ID '${materialId}' not found. Using default material.`);
      return CarcassMaterial.getDefaultMaterial();
    } catch (error) {
      console.error('Error loading material:', error);
      return CarcassMaterial.getDefaultMaterial();
    }
  }

  /**
   * Get all available material IDs from the data file
   * @returns Array of material IDs
   */
  static getAvailableMaterialIds(): string[] {
    try {
      const materials = categoriesData.carcassMaterials || [];
      return materials.map((mat: any) => mat.id);
    } catch (error) {
      console.error('Error getting material IDs:', error);
      return [];
    }
  }

  /**
   * Get all available materials from the data file
   * @returns Array of CarcassMaterial instances
   */
  static getAllMaterials(): CarcassMaterial[] {
    try {
      const materials = categoriesData.carcassMaterials || [];
      return materials.map((mat: any) => CarcassMaterial.fromData(mat as CarcassMaterialData));
    } catch (error) {
      console.error('Error getting all materials:', error);
      return [CarcassMaterial.getDefaultMaterial()];
    }
  }

  /**
   * Check if a material ID exists in the data file
   * @param materialId - The ID to check
   * @returns True if the material exists, false otherwise
   */
  static materialExists(materialId: string): boolean {
    try {
      const materials = categoriesData.carcassMaterials || [];
      return materials.some((mat: any) => mat.id === materialId);
    } catch (error) {
      console.error('Error checking material existence:', error);
      return false;
    }
  }

  /**
   * Get the Base Rail depth for a specific cabinet type
   * @param cabinetType - The cabinet type ('base', 'top', 'tall')
   * @returns The Base Rail depth in mm, or default 60mm for base cabinets
   */
  static getBaseRailDepth(cabinetType: 'top' | 'base' | 'tall'): number {
    try {
      if (cabinetType === 'base') {
        // Get Base Rail depth from data, fallback to default
        const baseRailSetting = categoriesData.baseRailSetting?.default || 60;
        return baseRailSetting;
      }
      // For non-base cabinets, return 0 (no Base Rail)
      return 0;
    } catch (error) {
      console.error('Error getting Base Rail depth:', error);
      return cabinetType === 'base' ? 60 : 0;
    }
  }

  /**
   * Get the leg height for Base and Tall cabinet types
   * @returns The leg height in mm, or default 100mm
   */
  static getLegHeight(): number {
    try {
      // Get leg height from mutable data (runtime changes) or fallback to static data
      const legHeight = this.mutableData.legHeight || categoriesData.legSettings?.default || 100;
      console.log('Getting leg height:', legHeight);
      return legHeight;
    } catch (error) {
      console.error('Error getting leg height:', error);
      return 100;
    }
  }

  // Mutable data store for runtime changes
  private static mutableData = {
    legHeight: 100
  };

  /**
   * Update the leg height in the data file
   * @param newHeight - The new leg height in mm
   */
  static updateLegHeight(newHeight: number): void {
    try {
      this.mutableData.legHeight = newHeight;
      console.log('Updated leg height in data to:', newHeight);
      console.log('Current data value:', this.mutableData.legHeight);
    } catch (error) {
      console.error('Error updating leg height:', error);
    }
  }
}
