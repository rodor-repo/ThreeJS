import * as THREE from "three"
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from "../utils/carcass-geometry-utils"

export interface CarcassFrontProps {
  width: number // Width of the panel (X axis)
  height: number // Height of the panel (Y axis)
  thickness: number // Thickness of the panel (Z axis)
  material?: THREE.Material
  zPosition?: number // Z position of the panel (default: at back, z=0)
}

/**
 * CarcassFront - A front-facing panel
 *
 * Used primarily for "filler" cabinet types:
 * - Linear filler: Single front panel positioned at the back (z=0)
 * - L-shape filler: Main front panel + return panel
 *
 * Dimensions:
 * - X axis: width (panel width)
 * - Y axis: height (panel height)
 * - Z axis: thickness (panel thickness, e.g., 16mm)
 *
 * The panel face is parallel to the XY plane.
 * Default position: back face at z=0
 */
export class CarcassFront {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public height: number
  public thickness: number
  private zPosition: number

  constructor(props: CarcassFrontProps) {
    this.width = props.width
    this.height = props.height
    this.thickness = props.thickness
    this.zPosition = props.zPosition ?? 0 // Default to back (z=0)

    // Create geometry for front panel
    // X-axis: width
    // Y-axis: height
    // Z-axis: thickness
    const geometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.thickness
    )

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the panel
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position so that back face is at zPosition (default 0)
    // Center is at thickness/2 from back face
    this.group.position.set(
      this.width / 2, // X: center of width
      this.height / 2, // Y: center of height
      this.zPosition + this.thickness / 2 // Z: back face at zPosition
    )
  }

  public updateDimensions(
    width: number,
    height: number,
    thickness: number
  ): void {
    this.width = width
    this.height = height
    this.thickness = thickness

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.thickness
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public setZPosition(zPosition: number): void {
    this.zPosition = zPosition
    this.updatePosition()
  }

  public setXPosition(xPosition: number): void {
    this.group.position.x = xPosition
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}
