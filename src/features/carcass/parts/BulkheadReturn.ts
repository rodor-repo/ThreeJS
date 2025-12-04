import * as THREE from 'three'
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from '../utils/carcass-geometry-utils'

export interface BulkheadReturnProps {
  height: number // Height from top of cabinet to back wall (Y axis)
  depth: number // Depth from front edge offset to back wall (Z axis)
  thickness?: number // Thickness of the bulkhead return panel (X axis, default: 16mm)
  material?: THREE.Material
}

export class BulkheadReturn {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public height: number
  public depth: number
  public thickness: number

  constructor(props: BulkheadReturnProps) {
    this.height = Math.max(0, props.height) // Ensure non-negative
    this.depth = props.depth
    this.thickness = props.thickness || 16 // Default 16mm thickness

    // Create geometry for bulkhead return panel
    // X-axis: thickness (16mm)
    // Y-axis: height (from top of cabinet to back wall)
    // Z-axis: depth (from front edge offset to back wall)
    const geometry = new THREE.BoxGeometry(this.thickness, this.height, this.depth)

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the bulkhead return panel
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position calculation relative to bulkhead return's local coordinate system:
    // Bulkhead return's local origin is at its center.
    //
    // X: Center of thickness (thickness/2 from left edge)
    // Y: Center of height (height/2 from bottom)
    // Z: Center of depth (depth/2 from front)
    //
    // This local position will be used in the handler to set the world position
    // based on the parent cabinet's left edge and front edge.
    
    const xPosition = 0 // Center of the group
    const yPosition = 0 // Center of the group
    const zPosition = 0 // Center of the group

    this.group.position.set(xPosition, yPosition, zPosition)
  }

  public updateDimensions(
    height: number,
    depth: number,
    cabinetTopY: number, // Top Y position of the cabinet in world space (for reference, actual positioning done in handler)
    thickness?: number
  ): void {
    this.height = Math.max(0, height) // Ensure non-negative
    this.depth = depth
    if (thickness !== undefined) this.thickness = thickness

    // Update geometry
    const safeHeight = Math.max(0, this.height)
    const newGeometry = new THREE.BoxGeometry(this.thickness, safeHeight, this.depth)
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position (local position remains at center)
    this.updatePosition()
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}

