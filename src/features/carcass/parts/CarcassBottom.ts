import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils';
import { calculatePanelCenterX, calculatePanelCenterZ } from '../utils/carcass-dimension-utils';

export interface CarcassBottomProps {
  depth: number;       // Depth of the cabinet (Z Axes)
  width: number;       // Width between the two ends (Width - 2x Thickness)
  thickness: number;   // Thickness of the bottom panel (Y Axes)
  leftEndThickness: number; // Thickness of the left end panel for positioning
  backThickness: number;    // Thickness of the back panel for positioning
  material?: THREE.Material;
}

export class CarcassBottom {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public depth: number;
  public width: number;
  public thickness: number;
  public leftEndThickness: number;
  public backThickness: number;

  constructor(props: CarcassBottomProps) {
    this.depth = props.depth;
    this.width = props.width;
    this.thickness = props.thickness;
    this.leftEndThickness = props.leftEndThickness;
    this.backThickness = props.backThickness;

    // Create geometry for bottom panel
    // X-axis: width (between the two ends)
    // Y-axis: thickness (PullPush direction)
    // Z-axis: depth
    const geometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth);

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material);
    this.group = group;
    this.mesh = mesh;

    // Position the bottom panel according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Bottom Surface: (EndLThickness,0,BackThickness) to (EndLThickness+BottomWidth,0,BackThickness+BottomDepth)
    // PullPush = BottomThickness in Positive Y Axes Direction
    // The bottom panel sits between the two ends and above the back panel
    this.group.position.set(
      calculatePanelCenterX(this.leftEndThickness, this.width),
      this.thickness / 2,    // Y: thickness/2 (at the bottom)
      calculatePanelCenterZ(this.backThickness, this.depth)
    );
  }

  public updateDimensions(depth: number, width: number, thickness: number, leftEndThickness: number, backThickness: number): void {
    this.depth = depth;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;
    this.backThickness = backThickness;

    // Update geometry using utility function
    const newGeometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth);
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group);
  }
}
