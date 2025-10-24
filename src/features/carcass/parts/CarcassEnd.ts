import * as THREE from 'three';
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils';

export interface CarcassEndProps {
  height: number;      // Height of the cabinet (Y Axes)
  depth: number;       // Depth of the cabinet (Z Axes)
  thickness: number;   // Thickness of the end panel (X Axes)
  position: 'left' | 'right';
  material?: THREE.Material;
}

export class CarcassEnd {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public height: number;
  public depth: number;
  public thickness: number;
  public position: 'left' | 'right';

  constructor(props: CarcassEndProps) {
    this.height = props.height;
    this.depth = props.depth;
    this.thickness = props.thickness;
    this.position = props.position;

    // Create geometry for end panel
    // X-axis: thickness (PullPush direction)
    // Y-axis: height
    // Z-axis: depth
    const geometry = new THREE.BoxGeometry(this.thickness, this.height, this.depth);

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material);
    this.group = group;
    this.mesh = mesh;

    // Position the end panel according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    if (this.position === 'left') {
      // End Left Surface: (0,0,0) to (0,EndLHeight,EndLDepth)
      // PullPush = EndLThickness in X Axes Direction
      // Position so that bottom back corner is at (0,0,0)
      this.group.position.set(
        this.thickness / 2,  // X: thickness/2 (center of the panel)
        this.height / 2,     // Y: height/2 (center of the panel)
        this.depth / 2       // Z: depth/2 (center of the panel)
      );
    } else {
      // End Right Surface: (EndRWidth+BackWidth,0,0) to (0,EndRHeight,EndRDepth)
      // PullPush = EndRThickness in Negative X Axes Direction
      // Note: The actual X position will be set by CarcassAssembly based on cabinet width
      this.group.position.set(
        -this.thickness / 2, // X: -thickness/2 (center of the panel, will be adjusted by assembly)
        this.height / 2,     // Y: height/2 (center of the panel)
        this.depth / 2       // Z: depth/2 (center of the panel)
      );
    }
  }

  public updateDimensions(height: number, depth: number, thickness: number): void {
    this.height = height;
    this.depth = depth;
    this.thickness = thickness;

    // Update geometry using utility function
    const newGeometry = new THREE.BoxGeometry(this.thickness, this.height, this.depth);
    updateMeshGeometry(this.mesh, this.group, newGeometry);

    // Update position
    this.updatePosition();
  }

  public setXPosition(xPosition: number): void {
    // This method allows CarcassAssembly to set the correct X position
    // based on the cabinet width and other parts
    this.group.position.x = xPosition;
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group);
  }
}
