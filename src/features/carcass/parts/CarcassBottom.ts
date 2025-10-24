import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry } from '../utils/meshUtils';
import { createHorizontalPanelGeometry } from '../utils/geometryUtils';
import { disposeMeshAndGroup } from '../utils/disposeUtils';

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

    // Create geometry for bottom panel using utility
    const geometry = createHorizontalPanelGeometry({
      width: this.width,
      thickness: this.thickness,
      depth: this.depth
    });

    // Create mesh group with default material config
    const meshGroup = createMeshGroup(geometry, props.material, {
      color: 0x8B4513, // Brown color for wood
      transparent: true,
      opacity: 0.9
    });

    this.mesh = meshGroup.mesh;
    this.group = meshGroup.group;

    // Position the bottom panel according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Bottom Surface: (EndLThickness,0,BackThickness) to (EndLThickness+BottomWidth,0,BackThickness+BottomDepth)
    // PullPush = BottomThickness in Positive Y Axes Direction
    // The bottom panel sits between the two ends and above the back panel
    // Since End Left starts at (0,0,0), the bottom panel starts at (leftEndThickness,0,backThickness)
    // and extends to (leftEndThickness+width,0,backThickness+depth)
    // Position so that the panel starts at leftEndThickness and extends exactly to leftEndThickness + width
    this.group.position.set(
      this.leftEndThickness + this.width / 2,  // X: center of the panel between leftEndThickness and leftEndThickness + width
      this.thickness / 2,    // Y: thickness/2 (at the bottom)
      this.backThickness + this.depth / 2      // Z: back thickness + center of depth
    );
  }

  public updateDimensions(depth: number, width: number, thickness: number, leftEndThickness: number, backThickness: number): void {
    this.depth = depth;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;
    this.backThickness = backThickness;

    // Update geometry using utility
    const newGeometry = createHorizontalPanelGeometry({
      width: this.width,
      thickness: this.thickness,
      depth: this.depth
    });
    
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    disposeMeshAndGroup(this.mesh, this.group);
  }
}
