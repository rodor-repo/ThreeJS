import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils';
import { calculatePanelCenterX, calculatePanelCenterZ } from '../utils/carcass-dimension-utils';

export interface CarcassShelfProps {
  depth: number;       // Depth of the cabinet (Z Axes)
  width: number;       // Width between the two ends (Width - 2x Thickness)
  thickness: number;   // Thickness of the shelf (Y Axes)
  height: number;      // Height position of the shelf (Y Axes)
  leftEndThickness: number; // Thickness of the left end panel for positioning
  backThickness: number;    // Thickness of the back panel for positioning
  material?: THREE.Material;
}

export class CarcassShelf {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public depth: number;
  public width: number;
  public thickness: number;
  public height: number;
  public leftEndThickness: number;
  public backThickness: number;

  constructor(props: CarcassShelfProps) {
    this.depth = props.depth;
    this.width = props.width;
    this.thickness = props.thickness;
    this.height = props.height;
    this.leftEndThickness = props.leftEndThickness;
    this.backThickness = props.backThickness;

    // Create geometry for shelf
    // X-axis: width (between the two ends)
    // Y-axis: thickness (PullPush direction)
    // Z-axis: depth
    const geometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth);

    // Create mesh and wireframe group
    const { group, mesh } = createMeshGroup(geometry, props.material);
    this.group = group;
    this.mesh = mesh;

    // Position the shelf according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Shelf Surface: (EndLThickness,Height,BackThickness) to (ShelfWidth,Height,ShelfDepth)
    // PullPush = ShelfThickness in Positive Y Axes Direction
    // The shelf sits between the two ends at the specified height
    // Since End Left starts at (0,0,0), the shelf starts at (thickness,height,backThickness)
    this.group.position.set(
      calculatePanelCenterX(this.leftEndThickness, this.width),
      this.height,                                          // Y: at the specified height
      calculatePanelCenterZ(this.backThickness, this.depth)
    );
  }

  public updateDimensions(depth: number, width: number, thickness: number, leftEndThickness: number, backThickness: number): void {
    this.depth = depth;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;
    this.backThickness = backThickness;

    // Update geometry and wireframe
    const newGeometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth);
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public updateHeight(height: number): void {
    this.height = height;
    // Update position when height changes
    this.updatePosition();
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group);
  }
}
