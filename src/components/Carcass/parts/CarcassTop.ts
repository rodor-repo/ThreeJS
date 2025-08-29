import * as THREE from 'three';

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
    let geometry: THREE.BoxGeometry;
    
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning:
        // X-axis: width (between the two ends)
        // Y-axis: thickness (PullPush direction)
        // Z-axis: depth (use full depth minus back thickness)
        const effectiveDepth = this.depth - this.backThickness;
        geometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
      } else {
        // For Standard Base cabinets - VERTICAL positioning:
        // Height: 60mm (Y axis - this.baseRailDepth)
        // Width: Carcass Width - 2×CarcassThickness (X axis)
        // Depth: CarcassThickness (Z axis)
        geometry = new THREE.BoxGeometry(this.width, this.baseRailDepth, this.thickness);
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning:
      // X-axis: width (between the two ends)
      // Y-axis: thickness (PullPush direction)
      // Z-axis: depth (use full depth minus back thickness)
      const effectiveDepth = this.depth - this.backThickness;
      geometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
    }

    // Use provided material or create default
    const material = props.material || new THREE.MeshLambertMaterial({
      color: 0x8B4513, // Brown color for wood
      transparent: true,
      opacity: 0.9
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Create group to contain mesh and wireframe
    this.group = new THREE.Group();
    this.group.add(this.mesh);

    // Add wireframe outline
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    this.group.add(wireframe);

    // Position the top panel according to new logic
    this.updatePosition();
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
    let newGeometry: THREE.BoxGeometry;
    
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning
        const effectiveDepth = this.depth - this.backThickness;
        newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        newGeometry = new THREE.BoxGeometry(this.width, this.baseRailDepth, this.thickness);
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning
      const effectiveDepth = this.depth - this.backThickness;
      newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
    }
    
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    // Update wireframe
    this.group.children.forEach((child, index) => {
      if (index === 1 && child instanceof THREE.LineSegments) { // Wireframe is second child
        child.geometry.dispose();
        const newEdges = new THREE.EdgesGeometry(newGeometry);
        child.geometry = newEdges;
      }
    });

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
    let newGeometry: THREE.BoxGeometry;
    
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning
        const effectiveDepth = this.depth - this.backThickness;
        newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        newGeometry = new THREE.BoxGeometry(this.width, this.baseRailDepth, this.thickness);
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning
      const effectiveDepth = this.depth - this.backThickness;
      newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
    }
    
    // Update mesh geometry
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
    
    // Update wireframe
    this.group.children.forEach((child, index) => {
      if (index === 1 && child instanceof THREE.LineSegments) { // Wireframe is second child
        child.geometry.dispose();
        const newEdges = new THREE.EdgesGeometry(newGeometry);
        child.geometry = newEdges;
      }
    });
    
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
    let newGeometry: THREE.BoxGeometry;
    
    if (this.cabinetType === 'base') {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning
        const effectiveDepth = this.depth - this.backThickness;
        newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        newGeometry = new THREE.BoxGeometry(this.width, this.baseRailDepth, this.thickness);
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning
      const effectiveDepth = this.depth - this.backThickness;
      newGeometry = new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth);
    }
    
    // Update mesh geometry
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
    
    // Update wireframe
    this.group.children.forEach((child, index) => {
      if (index === 1 && child instanceof THREE.LineSegments) { // Wireframe is second child
        child.geometry.dispose();
        const newEdges = new THREE.EdgesGeometry(newGeometry);
        child.geometry = newEdges;
      }
    });
    
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
    this.mesh.geometry.dispose();
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(mat => mat.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }

    this.group.children.forEach(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
