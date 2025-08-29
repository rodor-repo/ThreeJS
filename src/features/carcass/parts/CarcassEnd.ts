import * as THREE from 'three';

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

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(this.thickness, this.height, this.depth);
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

  public setXPosition(xPosition: number): void {
    // This method allows CarcassAssembly to set the correct X position
    // based on the cabinet width and other parts
    this.group.position.x = xPosition;
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
