import * as THREE from 'three';

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

    // Use provided material or create default
    const material = props.material || new THREE.MeshLambertMaterial({
      color: 0xCD853F, // Lighter brown for shelves
      transparent: true,
      opacity: 0.8
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

    // Position the shelf according to new logic
    this.updatePosition();
  }

  private updatePosition(): void {
    // Shelf Surface: (EndLThickness,Height,BackThickness) to (ShelfWidth,Height,ShelfDepth)
    // PullPush = ShelfThickness in Positive Y Axes Direction
    // The shelf sits between the two ends at the specified height
    // Since End Left starts at (0,0,0), the shelf starts at (thickness,height,backThickness)
    this.group.position.set(
      this.leftEndThickness + this.width / 2,              // X: left end thickness + center of width
      this.height,                                          // Y: at the specified height
      this.backThickness + this.depth / 2                   // Z: back thickness + center of depth
    );
  }

  public updateDimensions(depth: number, width: number, thickness: number, leftEndThickness: number, backThickness: number): void {
    this.depth = depth;
    this.width = width;
    this.thickness = thickness;
    this.leftEndThickness = leftEndThickness;
    this.backThickness = backThickness;

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth);
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
