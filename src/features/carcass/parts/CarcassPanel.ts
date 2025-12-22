import * as THREE from "three"
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from "../utils/carcass-geometry-utils"

export interface CarcassPanelProps {
  height: number // Height of the panel (Y axis)
  panelWidth: number // Width of the panel face (Z axis) - this is the "depth" of the cabinet
  thickness: number // Thickness of the panel (X axis) - this is the "width" of the cabinet
  material?: THREE.Material
}

/**
 * CarcassPanel - A single decorative side panel
 *
 * Used for "panel" cabinet type - a simple panel that attaches to the side
 * of a cabinet for aesthetic purposes.
 *
 * Dimensions:
 * - X axis: thickness (panel thickness, e.g., 16mm)
 * - Y axis: height (panel height)
 * - Z axis: panelWidth (panel face width)
 *
 * The panel is positioned with its back-bottom corner at origin (0,0,0)
 */
export class CarcassPanel {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public height: number
  public panelWidth: number
  public thickness: number

  constructor(props: CarcassPanelProps) {
    this.height = props.height
    this.panelWidth = props.panelWidth
    this.thickness = props.thickness

    // Create geometry for panel
    // X-axis: thickness
    // Y-axis: height
    // Z-axis: panelWidth
    const geometry = new THREE.BoxGeometry(
      this.thickness,
      this.height,
      this.panelWidth
    )

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the panel with back-bottom corner at origin
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position so that back-bottom corner is at (0,0,0)
    this.group.position.set(
      this.thickness / 2, // X: center of thickness
      this.height / 2, // Y: center of height
      this.panelWidth / 2 // Z: center of panelWidth
    )
  }

  public updateDimensions(
    height: number,
    panelWidth: number,
    thickness: number
  ): void {
    this.height = height
    this.panelWidth = panelWidth
    this.thickness = thickness

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(
      this.thickness,
      this.height,
      this.panelWidth
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}
