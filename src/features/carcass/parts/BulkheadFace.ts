import * as THREE from 'three'
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from '../utils/carcass-geometry-utils'

export interface BulkheadFaceProps {
  width: number // Width of the bulkhead (X axis) - includes cabinet width + child fillers/panels width
  height: number // Height from top of cabinet to back wall (Y axis)
  depth: number // Depth of the cabinet (Z axis) - for positioning
  thickness?: number // Thickness of the bulkhead panel (Z axis, default: 16mm)
  material?: THREE.Material
}

export class BulkheadFace {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number
  public thickness: number

  constructor(props: BulkheadFaceProps) {
    this.width = props.width
    this.height = Math.max(0, props.height) // Ensure non-negative
    this.depth = props.depth
    this.thickness = props.thickness || 16 // Default 16mm thickness

    // Create geometry for bulkhead face panel
    // X-axis: width (cabinet width + child fillers/panels width)
    // Y-axis: height (from top of cabinet to back wall)
    // Z-axis: thickness (16mm)
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.thickness)

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the bulkhead face panel
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position calculation relative to cabinet's local coordinate system:
    // Cabinet origin is at bottom-back-left corner (where cabinet bottom meets back wall)
    //
    // X: Center of bulkhead width (from left edge x=0 to right edge x=width, center is width/2)
    //    Bulkhead spans full width (cabinet + children)
    //
    // Y: Position so bulkhead extends from top of cabinet (y = cabinetHeight) to back wall top
    //    Cabinet top in local space = y = cabinetHeight
    //    Bulkhead center should be at: y = cabinetHeight + height/2
    //    This makes bulkhead extend from cabinet top upward by height amount
    //
    // Z: Start at front edge of carcass (z = depth) and extend 16mm toward Z negative
    //    Front edge is at z = depth
    //    Start position: z = depth (flush with front edge)
    //    Center position: z = depth - thickness/2 = depth - 8
    
    const safeHeight = Math.max(0, this.height)
    
    const xPosition = this.width / 2
    const yPosition = 0 // Will be set relative to cabinet top in world space
    const zPosition = this.depth - this.thickness / 2 // Extends from front edge toward negative Z

    this.group.position.set(xPosition, yPosition, zPosition)
  }

  public updateDimensions(
    width: number,
    height: number,
    depth: number,
    cabinetTopY: number, // Top Y position of the cabinet in world space (for reference, actual positioning done in handler)
    thickness?: number
  ): void {
    this.width = width
    this.height = Math.max(0, height) // Ensure non-negative
    this.depth = depth
    if (thickness !== undefined) this.thickness = thickness

    // Update geometry
    const safeHeight = Math.max(0, this.height)
    const newGeometry = new THREE.BoxGeometry(this.width, safeHeight, this.thickness)
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Position is updated in bulkheadPositionHandler using world coordinates
    // Local position here is just for reference (will be overridden by handler)
    const xPosition = this.width / 2
    const yPosition = 0 // Will be set in world space by handler
    const zPosition = this.depth - this.thickness / 2

    this.group.position.set(xPosition, yPosition, zPosition)
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}

