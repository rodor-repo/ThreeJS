import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry } from '../utils/meshUtils';
import { createHorizontalPanelGeometry, createBoxGeometry } from '../utils/geometryUtils';
import { disposeMeshAndGroup } from '../utils/disposeUtils';

export interface CarcassTopProps {
  depth: number;       // Depth of the cabinet (Z Axes)
  width: number;       // Width between the two ends (Width - 2x Thickness)
  thickness: number;   // Thickness of the top panel (Y Axes)
  height: number;      // Height of the cabinet (Y Axes) - for positioning
  leftEndThickness: number; // Thickness of the left end panel for positioning
  backThickness: number;    // Thickness of the back panel for positioning
  material?: THREE.Material;
  cabinetType?: 'top' | 'base' | 'tall';  // Cabinet type to determine if Base Rail applies
  baseRailDepth?: number;   // Base Rail depth for Base cabinets (default: 60mm)
  isDrawerBase?: boolean;   // Whether this is a Drawer Base cabinet (affects positioning)
}

export class CarcassTop {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public depth: number;
  public width: number;
  public thickness: number;
  public height: number;
  public leftEndThickness: number;
  public backThickness: number;
  public cabinetType: 'top' | 'base' | 'tall';
  public baseRailDepth: number;
  public isDrawerBase: boolean;

  constructor(props: CarcassTopProps) {
    this.depth = props.depth;
    this.width = props.width;
    this.thickness = props.thickness;
    this.height = props.height;
    this.leftEndThickness = props.leftEndThickness;
    this.backThickness = props.backThickness;
    this.cabinetType = props.cabinetType || 'base';
    this.baseRailDepth = props.baseRailDepth || 60; // Default Base Rail depth is 60mm
    this.isDrawerBase = props.isDrawerBase || false; // Default to Standard Base (not Drawer Base)

    // Create geometry for top panel
    const geometry = this.createGeometry();

    // Create mesh group with default material config
    const meshGroup = createMeshGroup(geometry, props.material, {
      color: 0x8B4513, // Brown color for wood
      transparent: true,
      opacity: 0.9
    });

    this.mesh = meshGroup.mesh;
    this.group = meshGroup.group;

    // Position the top panel according to new logic
    this.updatePosition();
  }

  private createGeometry(): THREE.BoxGeometry {
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning
        return createHorizontalPanelGeometry({
          width: this.width,
          thickness: this.thickness,
          depth: this.depth,
          backThickness: this.backThickness
        });
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        return createBoxGeometry(this.width, this.baseRailDepth, this.thickness);
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning
      return createHorizontalPanelGeometry({
        width: this.width,
        thickness: this.thickness,
        depth: this.depth,
        backThickness: this.backThickness
      });
    }
  }

  private updatePosition(): void {
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning:
        // Position at the front edge of end panels (Z = 0)
        // Standard horizontal positioning like other cabinet types
        this.group.position.set(
          this.leftEndThickness + this.width / 2,                    // X: left end thickness + center of width
          this.height - this.thickness / 2,                          // Y: height - thickness/2 (at the top)
          0                                                           // Z: 0 (front edge of end panels)
        );
      } else {
        // For Standard Base cabinets - VERTICAL positioning:
        // Move in Z-axis by Carcass Depth (full depth)
        // Move in Y-axis by half rail height (30mm from top)
        // Width: Carcass Width - 2×CarcassThickness (X axis positive)
        // Depth: CarcassThickness (Z axis)
        
        this.group.position.set(
          this.leftEndThickness + this.width / 2,                    // X: left end thickness + center of width
          this.height - this.baseRailDepth / 2,                      // Y: height - baseRailDepth/2 (30mm from top)
          this.depth                                                   // Z: full carcass depth
        );
      }
    } else {
      // For other cabinet types, use standard horizontal positioning
      const zPosition = this.backThickness + this.depth / 2;
      
      this.group.position.set(
        this.leftEndThickness + this.width / 2,                    // X: left end thickness + center of width
        this.height - this.thickness / 2,                          // Y: height - thickness/2 (at the top)
        zPosition                                                   // Z: calculated based on cabinet type
      );
    }
  }

  public updateDimensions(depth: number, width: number, thickness: number, leftEndThickness: number, backThickness: number): void {
    this.depth = depth;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;
    this.backThickness = backThickness;

    // Update geometry based on cabinet type
    const newGeometry = this.createGeometry();
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public updateHeight(height: number): void {
    this.height = height;
    // Update position when height changes
    this.updatePosition();
  }

  public updateBaseRailSettings(cabinetType: 'top' | 'base' | 'tall', baseRailDepth?: number): void {
    this.cabinetType = cabinetType;
    if (baseRailDepth !== undefined) {
      this.baseRailDepth = baseRailDepth;
    }
    
    // Recreate geometry with new Base Rail settings
    const newGeometry = this.createGeometry();
    updateMeshGeometry(this.mesh, this.group, newGeometry);
    
    // Update position
    this.updatePosition();
  }

  /**
   * Update whether this is a Drawer Base cabinet
   * This affects both geometry and positioning
   */
  public updateDrawerBaseSetting(isDrawerBase: boolean): void {
    this.isDrawerBase = isDrawerBase;
    
    // Recreate geometry based on new setting
    const newGeometry = this.createGeometry();
    updateMeshGeometry(this.mesh, this.group, newGeometry);
    
    // Update position
    this.updatePosition();
  }


  /**
   * Get positioning information for debugging
   */
  public getPositioningInfo(): string {
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        return `Drawer Base Rail (Horizontal)\nHeight: ${this.thickness}mm\nWidth: ${this.width}mm\nDepth: ${this.depth - this.backThickness}mm\nPosition: Front Edge (Z=0)`;
      } else {
        return `Standard Base Rail (Vertical)\nHeight: ${this.baseRailDepth}mm\nWidth: ${this.width}mm\nDepth: ${this.thickness}mm\nPosition: Z=${this.depth}mm (Carcass Depth), Y=${this.height - this.baseRailDepth / 2}mm (Half Rail Height)`;
      }
    } else {
      return `Top Panel (Horizontal)\nHeight: ${this.thickness}mm\nWidth: ${this.width}mm\nDepth: ${this.depth - this.backThickness}mm\nPosition: Standard`;
    }
  }

  public dispose(): void {
    disposeMeshAndGroup(this.mesh, this.group);
  }
}
