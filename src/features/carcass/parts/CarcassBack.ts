import * as THREE from 'three';

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

    // Use provided material or create default
    const material = props.material || new THREE.MeshLambertMaterial({
      color: 0x654321, // Darker brown for back panel
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

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(this.width, this.height, this.thickness);
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
