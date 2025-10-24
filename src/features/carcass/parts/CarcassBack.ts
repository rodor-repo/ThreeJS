import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry } from '../utils/meshUtils';
import { createVerticalPanelGeometry } from '../utils/geometryUtils';
import { disposeMeshAndGroup } from '../utils/disposeUtils';

export interface CarcassBackProps {
  height: number;      // Height of the cabinet (Y Axes)
  width: number;       // Width between the two ends (Width - 2x Thickness)
  thickness: number;   // Thickness of the back panel (Z Axes)
  leftEndThickness: number; // Thickness of the left end panel for positioning
  material?: THREE.Material;
}

export class CarcassBack {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public height: number;
  public width: number;
  public thickness: number;
  public leftEndThickness: number;

  constructor(props: CarcassBackProps) {
    this.height = props.height;
    this.width = props.width;
    this.thickness = props.thickness;
    this.leftEndThickness = props.leftEndThickness;

    // Create geometry for back panel using utility
    const geometry = createVerticalPanelGeometry({
      width: this.width,
      height: this.height,
      thickness: this.thickness
    });

    // Create mesh group with default material config
    const meshGroup = createMeshGroup(geometry, props.material, {
      color: 0x654321, // Darker brown for back panel
      transparent: true,
      opacity: 0.8
    });

    this.mesh = meshGroup.mesh;
    this.group = meshGroup.group;

    // Position the back panel according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Back Surface: (EndLThickness,0,0) to (BackWidth,BackHeight,0)
    // PullPush = BackThickness in Positive Z Axes Direction
    // The back panel sits between the two ends
    // Since End Left starts at (0,0,0), the back panel starts at (thickness,0,0)
    this.group.position.set(
      this.leftEndThickness + this.width / 2,  // X: left end thickness + center of width
      this.height / 2,       // Y: center of the height
      -this.thickness / 2    // Z: negative thickness/2 (behind the ends)
    );
  }

  public updateDimensions(height: number, width: number, thickness: number, leftEndThickness: number): void {
    this.height = height;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;

    // Update geometry using utility
    const newGeometry = createVerticalPanelGeometry({
      width: this.width,
      height: this.height,
      thickness: this.thickness
    });
    
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    disposeMeshAndGroup(this.mesh, this.group);
  }
}
