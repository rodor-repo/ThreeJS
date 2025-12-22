import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils';

export interface CarcassLegProps {
  height: number;        // Height of the leg (Y Axes)
  diameter: number;      // Diameter of the leg (default 50mm)
  position: 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';
  width: number;         // Width of the carcass for positioning
  depth: number;         // Depth of the carcass for positioning
  thickness: number;     // Thickness of end panels for positioning
  material?: THREE.Material;
}

export class CarcassLeg {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public height: number;
  public diameter: number;
  public position: 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';
  public width: number;
  public depth: number;
  public thickness: number;

  constructor(props: CarcassLegProps) {
    this.height = props.height;
    this.diameter = props.diameter || 50; // Default 50mm diameter
    this.position = props.position;
    this.width = props.width;
    this.depth = props.depth;
    this.thickness = props.thickness;

    // Create geometry for cylindrical leg
    // X-axis: diameter, Y-axis: height, Z-axis: diameter
    const geometry = new THREE.CylinderGeometry(
      this.diameter / 2,  // radiusTop
      this.diameter / 2,  // radiusBottom
      this.height,        // height
      32                  // radialSegments for smooth cylinder
    );

    // Create mesh and wireframe group
    const { group, mesh } = createMeshGroup(geometry, props.material);
    this.group = group;
    this.mesh = mesh;

    // Position the leg according to its corner position
    this.updatePosition();
  }

  private updatePosition(): void {
    // Position legs at the 4 corners under the bottom part
    // Z-axis: 0 = back edge (closer to wall), depth = front edge (away from wall)
    // Front legs are at the front edge with 70mm setback (away from wall, z = depth - setback)
    // Back legs are at the back edge (closer to wall, z = 0)
    const frontSetback = 70; // 70mm setback for front legs from front edge
    
    let x: number;
    let z: number;
    
    switch (this.position) {
      case 'frontLeft':
        x = this.thickness + (this.diameter / 2); // Left edge + half diameter
        z = this.depth - frontSetback - (this.diameter / 2);   // Front edge - setback - half diameter
        break;
      case 'frontRight':
        x = this.width - this.thickness - (this.diameter / 2); // Right edge - half diameter
        z = this.depth - frontSetback - (this.diameter / 2);   // Front edge - setback - half diameter
        break;
      case 'backLeft':
        x = this.thickness + (this.diameter / 2); // Left edge + half diameter
        z = this.diameter / 2; // Back edge + half diameter (closer to wall)
        break;
      case 'backRight':
        x = this.width - this.thickness - (this.diameter / 2); // Right edge - half diameter
        z = this.diameter / 2; // Back edge + half diameter (closer to wall)
        break;
      default:
        x = 0;
        z = 0;
    }

    // Y position: leg extends from bottom of cabinet down to floor
    // The cylinder geometry is centered, so we position it so that:
    // - Top of leg (Y + height/2) aligns with bottom of cabinet (Y = 0)
    // - Bottom of leg (Y - height/2) extends down to floor
    // Therefore: Y = -height/2
    const y = -this.height / 2
    
    this.group.position.set(x, y, z)
  }

  public updateDimensions(height: number, width: number, depth: number, thickness: number): void {
    this.height = height;
    this.width = width;
    this.depth = depth;
    this.thickness = thickness;

    // Update geometry and wireframe
    const newGeometry = new THREE.CylinderGeometry(
      this.diameter / 2,
      this.diameter / 2,
      this.height,
      32
    );
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group);
  }
}
