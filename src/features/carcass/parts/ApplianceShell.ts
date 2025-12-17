import * as THREE from "three"

export interface ApplianceShellProps {
  width: number // Width of the shell (X axis)
  height: number // Height of the shell (Y axis)
  depth: number // Depth of the shell (Z axis)
}

/**
 * ApplianceShell - Wireframe-only transparent shell for appliance cabinets
 * Defines the functional boundaries used for snapping, dimensions, and view grouping
 * The shell has NO fill - it's wireframe only for visual clarity
 */
export class ApplianceShell {
  public wireframe: THREE.LineSegments
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number

  constructor(props: ApplianceShellProps) {
    this.width = props.width
    this.height = props.height
    this.depth = props.depth

    // Create geometry for the shell
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth)

    // Create wireframe only (no fill mesh) - using blue color for visibility
    const wireframeGeometry = new THREE.EdgesGeometry(geometry)
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      opacity: 0.7,
      transparent: true,
    })
    this.wireframe = new THREE.LineSegments(
      wireframeGeometry,
      wireframeMaterial
    )

    // Dispose the box geometry since we only needed it for edges
    geometry.dispose()

    this.group = new THREE.Group()
    this.group.add(this.wireframe)

    // Position at center of cabinet space
    this.updatePosition()
  }

  private updatePosition(): void {
    this.group.position.set(this.width / 2, this.height / 2, this.depth / 2)
  }

  public updateDimensions(width: number, height: number, depth: number): void {
    this.width = width
    this.height = height
    this.depth = depth

    // Create new geometry
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const newWireframeGeometry = new THREE.EdgesGeometry(geometry)

    // Update wireframe
    this.wireframe.geometry.dispose()
    this.wireframe.geometry = newWireframeGeometry

    // Dispose the box geometry since we only needed it for edges
    geometry.dispose()

    this.updatePosition()
  }

  public dispose(): void {
    this.wireframe.geometry.dispose()
    if (this.wireframe.material) {
      if (Array.isArray(this.wireframe.material)) {
        this.wireframe.material.forEach((mat) => mat.dispose())
      } else {
        this.wireframe.material.dispose()
      }
    }
    this.group.clear()
  }
}
