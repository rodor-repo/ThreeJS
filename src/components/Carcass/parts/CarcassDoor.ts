import * as THREE from 'three';
import { DoorMaterial } from '../DoorMaterial';

export interface CarcassDoorProps {
  width: number;        // Width of the door (X Axes) - matches carcass width
  height: number;       // Height of the door (Z Axes) - matches carcass height
  depth: number;        // Depth of the carcass for positioning
  thickness: number;    // Thickness of end panels for positioning
  material: DoorMaterial;
  position?: 'left' | 'right' | 'center'; // Door position on the front
  offset?: number;      // Offset from the front edge (default 0)
  carcassWidth?: number; // Full width of the carcass for proper positioning
  overhang?: boolean;   // Whether door should overhang (20mm longer and lower)
}

export class CarcassDoor {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public width: number;
  public height: number;
  public depth: number;
  public thickness: number;
  public material: DoorMaterial;
  public position: 'left' | 'right' | 'center';
  public offset: number;
  private carcassWidth: number;
  private overhang: boolean;

  constructor(props: CarcassDoorProps) {
    this.width = props.width;
    this.height = props.height;
    this.depth = props.depth;
    this.thickness = props.thickness;
    this.material = props.material;
    this.position = props.position || 'center';
    this.offset = props.offset || 0;
    this.carcassWidth = props.carcassWidth || props.width;
    this.overhang = props.overhang || false;


    // Create geometry for the door
    // X-axis: width, Y-axis: height, Z-axis: material thickness
    const doorHeight = this.overhang ? this.height + 20 : this.height;
    const geometry = new THREE.BoxGeometry(
      this.width,                    // width
      doorHeight,                    // height (with overhang if enabled)
      this.material.getThickness()   // depth (door thickness)
    );

    // Create mesh with door material
    this.mesh = new THREE.Mesh(geometry, this.material.getMaterial());
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

    // Position the door at the front edge of the carcass
    this.updatePosition();
  }

  private updatePosition(): void {
    // Position the door at the front edge of the carcass
    // X: centered on the carcass width
    // Y: centered on the carcass height
    // Z: at the front edge (depth) with offset for clearance
    
    let x: number;
    let y: number;
    let z: number;

    // X position based on door position
    // For 2-door setup: left door gets left half, right door gets right half
    switch (this.position) {
      case 'left':
        // Left door: position at left edge + half door width
        x = (this.width / 2);
        break;
      case 'right':
        // Right door: position at right edge - half door width
        // For 2-door setup: right door should be positioned at the right half of the carcass
        x = this.carcassWidth - (this.width / 2);
        break;
      case 'center':
      default:
        // Center door: position at center of entire carcass
        x = (this.width / 2);
        break;
    }

    // Y position: centered on carcass height, with overhang offset if enabled
    const doorHeight = this.overhang ? this.height + 20 : this.height;
    y = (doorHeight / 2) - (this.overhang ? 20 : 0);

    // Z position: at the front edge with offset for clearance
    // The door should be positioned slightly in front of the carcass for proper clearance
    z = this.depth + (this.material.getThickness() / 2) + this.offset;

    this.group.position.set(x, y, z);
  }

  public updateDimensions(width: number, height: number, depth: number, thickness: number): void {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.thickness = thickness;

    // Create new geometry with updated dimensions
    const doorHeight = this.overhang ? this.height + 20 : this.height;
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      doorHeight,
      this.material.getThickness()
    );

    // Dispose of old geometry and assign new one
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    // Update wireframe
    this.group.remove(this.group.children[1]); // Remove old wireframe
    const edges = new THREE.EdgesGeometry(newGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    this.group.add(wireframe);

    // Update position
    this.updatePosition();
  }

  public updateMaterial(material: DoorMaterial): void {
    this.material = material;
    this.mesh.material = material.getMaterial();
    
    // Create new geometry with updated thickness
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.material.getThickness()
    );

    // Dispose of old geometry and assign new one
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
    
    // Update wireframe
    this.group.remove(this.group.children[1]); // Remove old wireframe
    const edges = new THREE.EdgesGeometry(newGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    this.group.add(wireframe);
    
    // Update position
    this.updatePosition();
  }

  public setPosition(position: 'left' | 'right' | 'center'): void {
    this.position = position;
    this.updatePosition();
  }

  public setOffset(offset: number): void {
    this.offset = offset;
    this.updatePosition();
  }

  public updateCarcassWidth(carcassWidth: number): void {
    this.carcassWidth = carcassWidth;
    this.updatePosition();
  }

  public updateOverhang(overhang: boolean): void {
    this.overhang = overhang;
    
    // Update geometry with new height
    const doorHeight = this.overhang ? this.height + 20 : this.height;
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      doorHeight,
      this.material.getThickness()
    );

    // Dispose of old geometry and assign new one
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    // Update wireframe
    this.group.remove(this.group.children[1]); // Remove old wireframe
    const edges = new THREE.EdgesGeometry(newGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    this.group.add(wireframe);

    // Update position
    this.updatePosition();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.group.children.forEach(child => {
      if (child instanceof THREE.LineSegments) {
        (child.geometry as THREE.EdgesGeometry).dispose();
        (child.material as THREE.LineBasicMaterial).dispose();
      }
    });
  }
}
