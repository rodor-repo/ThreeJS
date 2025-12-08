import * as THREE from 'three'
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from '../utils/carcass-geometry-utils'

export interface UnderPanelFaceProps {
  width: number // Effective width (X axis)
  depth: number // Actual depth of the panel (Z axis)
  thickness?: number // Thickness of the panel (Y axis, default: 16mm)
  material?: THREE.Material
}

export class UnderPanelFace {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public depth: number
  public thickness: number

  constructor(props: UnderPanelFaceProps) {
    this.width = props.width
    this.depth = props.depth
    this.thickness = props.thickness || 16

    // Create geometry for under panel
    // X-axis: width
    // Y-axis: thickness
    // Z-axis: depth
    const geometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth)

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the panel
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position relative to cabinet origin (bottom-back-left of parent)
    // Parent Y=0 is the bottom of the parent cabinet.
    // We want the panel to be BELOW the cabinet.
    // So Y position is -thickness/2.
    
    // X: Center of width
    const xPosition = this.width / 2
    
    // Y: Below the cabinet
    const yPosition = -this.thickness / 2
    
    // Z: Flush with back (Z=0). Center is depth/2.
    const zPosition = this.depth / 2

    this.group.position.set(xPosition, yPosition, zPosition)
  }

  public updateDimensions(
    width: number,
    depth: number,
    thickness?: number
  ): void {
    this.width = width
    this.depth = depth
    if (thickness !== undefined) this.thickness = thickness

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(this.width, this.thickness, this.depth)
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}
