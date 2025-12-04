import * as THREE from 'three'
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from '../utils/carcass-geometry-utils'

export interface KickerFaceProps {
  width: number // Width of the cabinet (X axis)
  legHeight: number // Height of the legs (Y axis) - determines kicker height
  depth: number // Depth of the cabinet (Z axis) - for positioning
  thickness?: number // Thickness of the kicker face panel (Z axis, default: 16mm)
  zOffset?: number // Offset from front edge toward Z negative (default: 70mm)
  material?: THREE.Material
}

export class KickerFace {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public legHeight: number
  public depth: number
  public thickness: number
  public zOffset: number

  constructor(props: KickerFaceProps) {
    this.width = props.width
    this.legHeight = props.legHeight
    this.depth = props.depth
    this.thickness = props.thickness || 16 // Default 16mm thickness
    this.zOffset = props.zOffset || 70 // Default 70mm offset from front edge

    // Create geometry for kicker face panel
    // X-axis: width (cabinet width)
    // Y-axis: legHeight (height from floor to bottom of cabinet)
    // Z-axis: thickness (16mm)
    const geometry = new THREE.BoxGeometry(this.width, this.legHeight, this.thickness)

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the kicker face panel
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position calculation relative to cabinet's local coordinate system:
    // Cabinet origin is at bottom-back-left corner (where cabinet bottom meets back wall)
    // Cabinet's Y origin is at its bottom, which is at legHeight (kicker height) in world space
    // 
    // IMPORTANT: Kicker height comes from view settings and is always >= 0
    // Kicker always starts at Y=0 (floor in world space) and extends upward to kickerHeight
    // 
    // X: Center of cabinet width (from left edge x=0 to right edge x=width, center is width/2)
    //    Kicker spans full cabinet width
    // 
    // Y: Position so kicker extends from floor (y=-legHeight in local) to cabinet bottom (y=0 in local)
    //    Floor in world space = Y=0, which is Y=-legHeight in cabinet local space
    //    Cabinet bottom in world space = Y=legHeight, which is Y=0 in cabinet local space
    //    Center position: y = -legHeight/2 (extends from y=-legHeight to y=0 in local space)
    //    This ensures kicker always starts at Y=0 (floor) in world space
    // 
    // Z: Start 70mm offset from front edge (z = depth) toward Z negative, then extend 16mm toward Z positive
    //    Front edge is at z = depth
    //    Start position: z = depth - zOffset = depth - 70
    //    Center position: z = depth - zOffset + thickness/2 = depth - 70 + 16/2 = depth - 70 + 8 = depth - 62
    
    // Ensure legHeight is never negative (kicker height from view settings should always be >= 0)
    const safeLegHeight = Math.max(0, this.legHeight)
    
    const xPosition = this.width / 2
    const yPosition = -safeLegHeight / 2 // Negative to extend from cabinet bottom down to floor
    const zPosition = this.depth - this.zOffset + this.thickness / 2

    this.group.position.set(xPosition, yPosition, zPosition)
  }

  public updateDimensions(
    width: number,
    legHeight: number,
    depth: number,
    thickness?: number,
    zOffset?: number
  ): void {
    this.width = width
    // Ensure legHeight is never negative (kicker height from view settings should always be >= 0)
    this.legHeight = Math.max(0, legHeight)
    this.depth = depth
    if (thickness !== undefined) this.thickness = thickness
    if (zOffset !== undefined) this.zOffset = zOffset

    // Update geometry - use safe legHeight
    const safeLegHeight = Math.max(0, this.legHeight)
    const newGeometry = new THREE.BoxGeometry(this.width, safeLegHeight, this.thickness)
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}

