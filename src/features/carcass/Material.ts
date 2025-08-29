import * as THREE from 'three';

export interface CarcassMaterialData {
  colour: string;           // Hex color string (e.g., "#8B4513")
  panelThickness: number;   // Panel thickness in mm
  backThickness: number;    // Back panel thickness in mm
  opacity: number;          // Material opacity (0-1)
  transparent: boolean;     // Whether material is transparent
}

export class CarcassMaterial {
  private materialData: CarcassMaterialData;
  private material: THREE.MeshLambertMaterial;

  constructor(data: CarcassMaterialData) {
    this.materialData = data;
    this.material = this.createMaterial();
  }

  private createMaterial(): THREE.MeshLambertMaterial {
    // Convert hex string to number for Three.js
    const color = parseInt(this.materialData.colour.replace('#', ''), 16);
    
    return new THREE.MeshLambertMaterial({
      color: color,
      transparent: this.materialData.transparent,
      opacity: this.materialData.opacity
    });
  }

  public getMaterial(): THREE.MeshLambertMaterial {
    return this.material;
  }

  public getColour(): string {
    return this.materialData.colour;
  }

  public getPanelThickness(): number {
    return this.materialData.panelThickness;
  }

  public getBackThickness(): number {
    // Always return the same value as panel thickness for consistency
    return this.materialData.panelThickness;
  }

  public getThickness(): number {
    // Unified thickness for all panels
    return this.materialData.panelThickness;
  }

  public getOpacity(): number {
    return this.materialData.opacity;
  }

  public isTransparent(): boolean {
    return this.materialData.transparent;
  }

  public updateMaterial(newData: Partial<CarcassMaterialData>): void {
    this.materialData = { ...this.materialData, ...newData };
    
    // Update the material properties
    if (newData.colour) {
      const color = parseInt(this.materialData.colour.replace('#', ''), 16);
      this.material.color.setHex(color);
    }
    
    if (newData.opacity !== undefined) {
      this.material.opacity = this.materialData.opacity;
    }
    
    if (newData.transparent !== undefined) {
      this.material.transparent = this.materialData.transparent;
    }
    
    // Ensure panelThickness and backThickness are always the same
    if (newData.panelThickness !== undefined) {
      this.materialData.backThickness = newData.panelThickness;
    }
    if (newData.backThickness !== undefined) {
      this.materialData.panelThickness = newData.backThickness;
    }
  }

  public dispose(): void {
    this.material.dispose();
  }

  // Static factory method to create material from JSON data
  static fromData(data: CarcassMaterialData): CarcassMaterial {
    return new CarcassMaterial(data);
  }

  // Default material values
  static getDefaultMaterial(): CarcassMaterial {
    return new CarcassMaterial({
      colour: '#ffffff',      // White color
      panelThickness: 16,     // 16mm standard panel thickness
      backThickness: 16,      // 16mm back panel thickness (same as panel thickness)
      opacity: 0.9,           // 90% opacity
      transparent: true       // Transparent material
    });
  }
}
