import * as THREE from 'three';

export interface FingerpullCutOutProps {
  height: number;      // Height of the cut out (60mm in Y Axes)
  width: number;       // Width of the cut out (42mm in Z Axes) 
  depth: number;       // Depth of the cut out (CarcassThickness in X Axes)
  position: 'left' | 'right';
  material?: THREE.Material;
}

export class FingerpullCutOut {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public height: number;
  public width: number;
  public depth: number;
  public position: 'left' | 'right';

  constructor(props: FingerpullCutOutProps) {
    this.height = props.height;
    this.width = props.width;
    this.depth = props.depth;
    this.position = props.position;

    // Create geometry for fingerpull cut out
    // X-axis: depth (CarcassThickness)
    // Y-axis: height (60mm)
    // Z-axis: width (42mm)
    const geometry = new THREE.BoxGeometry(this.depth, this.height, this.width);

    // Use provided material or create default
    const material = props.material || new THREE.MeshLambertMaterial({
      color: 0x000000, // Black color for cut out
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

    // Position the cut out at the front top of the end part
    this.updatePosition(this.height, this.depth);
  }



  public updateDimensions(height: number, width: number, depth: number): void {
    this.height = height;
    this.width = width;
    this.depth = depth;

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(this.depth, this.height, this.width);
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
    this.updatePosition(this.height, this.depth);
  }

  public updatePosition(cabinetHeight: number, cabinetDepth: number): void {
    // Position the cut out at the front top of the end part
    // X: centered on the end panel thickness (0 for local positioning)
    // Y: at the very top of the cabinet, accounting for the cut out height
    // Z: at the very front of the cabinet, accounting for the cut out width
    const xPosition = 0; // Local positioning - will be handled by parent
    const yPosition = (cabinetHeight / 2) - (this.height / 2); // Position at the top edge
    const zPosition = (cabinetDepth / 2) - (this.width / 2);   // Position at the front edge
    
    this.group.position.set(xPosition, yPosition, zPosition);
  }

  public setXPosition(xPosition: number): void {
    // This method allows CarcassAssembly to set the correct X position
    // based on the cabinet width and other parts
    // Only update X position, preserve Y and Z positioning
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
