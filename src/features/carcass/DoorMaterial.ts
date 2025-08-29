import * as THREE from 'three';

export interface DoorMaterialData {
  colour: string;           // Hex color string (e.g., "#8B4513")
  thickness: number;        // Door thickness in mm
  opacity: number;          // Material opacity (0-1)
  transparent: boolean;     // Whether material is transparent
}

export class DoorMaterial {
  private materialData: DoorMaterialData;
  private material: THREE.MeshLambertMaterial;

  constructor(data: DoorMaterialData) {
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

  public getThickness(): number {
    return this.materialData.thickness;
  }

  public getOpacity(): number {
    return this.materialData.opacity;
  }

  public isTransparent(): boolean {
    return this.materialData.transparent;
  }

  public updateMaterial(newData: Partial<DoorMaterialData>): void {
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
  }

  public dispose(): void {
    this.material.dispose();
  }

  // Static factory method to create material from JSON data
  static fromData(data: DoorMaterialData): DoorMaterial {
    return new DoorMaterial(data);
  }

  // Default door material values
  static getDefaultMaterial(): DoorMaterial {
    return new DoorMaterial({
      colour: '#ffffff',     // White color
      thickness: 18,         // 18mm standard door thickness
      opacity: 0.9,          // 90% opacity
      transparent: true       // Transparent material
    });
  }
}
