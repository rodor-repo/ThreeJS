import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils';
import { calculatePanelCenterX } from '../utils/carcass-dimension-utils';

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

    // Create geometry for back panel
    // X-axis: width (between the two ends)
    // Y-axis: height
    // Z-axis: thickness (PullPush direction)
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.thickness);

    // Create mesh and wireframe group
    const { group, mesh } = createMeshGroup(geometry, props.material);
    this.group = group;
    this.mesh = mesh;

    // Position the back panel according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Back Surface: (EndLThickness,0,0) to (BackWidth,BackHeight,0)
    // PullPush = BackThickness in Positive Z Axes Direction
    // The back panel sits between the two ends
    // Since End Left starts at (0,0,0), the back panel starts at (thickness,0,0)
    this.group.position.set(
      calculatePanelCenterX(this.leftEndThickness, this.width),
      this.height / 2,       // Y: center of the height
      -this.thickness / 2    // Z: negative thickness/2 (behind the ends)
    );
  }

  public updateDimensions(height: number, width: number, thickness: number, leftEndThickness: number): void {
    this.height = height;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;

    // Update geometry and wireframe
    const newGeometry = new THREE.BoxGeometry(this.width, this.height, this.thickness);
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group);
  }
}
