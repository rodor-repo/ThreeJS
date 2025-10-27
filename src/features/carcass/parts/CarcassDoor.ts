import * as THREE from "three"
import { DoorMaterial } from "../DoorMaterial"
import { createMeshGroup, updateMeshGeometry, disposeCarcassPart } from '../utils/carcass-geometry-utils'

export interface CarcassDoorProps {
  width: number // Width of the door (X Axes) - matches carcass width
  height: number // Height of the door (Z Axes) - matches carcass height
  depth: number // Depth of the carcass for positioning
  thickness: number // Thickness of end panels for positioning
  material: DoorMaterial
  position?: "left" | "right" | "center" // Door position on the front
  offset?: number // Offset from the front edge (default 0)
  carcassWidth?: number // Full width of the carcass for proper positioning
  overhang?: boolean // Whether door should overhang (20mm longer and lower)
}

export class CarcassDoor {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number
  public thickness: number
  public material: DoorMaterial
  public position: "left" | "right" | "center"
  public offset: number
  private carcassWidth: number
  private overhang: boolean

  constructor(props: CarcassDoorProps) {
    this.width = props.width
    this.height = props.height
    this.depth = props.depth
    this.thickness = props.thickness
    this.material = props.material
    this.position = props.position || "center"
    this.offset = props.offset || 0
    this.carcassWidth = props.carcassWidth || props.width
    this.overhang = props.overhang || false

    // Create geometry for the door
    // X-axis: width, Y-axis: height, Z-axis: material thickness
    const doorHeight = this.overhang ? this.height + 20 : this.height
    const geometry = new THREE.BoxGeometry(
      this.width, // width
      doorHeight, // height (with overhang if enabled)
      this.material.getThickness() // depth (door thickness)
    )

    // Create mesh and wireframe group
    const { group, mesh } = createMeshGroup(geometry, this.material.getMaterial())
    this.group = group
    this.mesh = mesh

    // Position the door at the front edge of the carcass
    this.updatePosition()
  }

  private updatePosition(): void {
    // Position the door at the front edge of the carcass
    // X: centered on the carcass width
    // Y: centered on the carcass height
    // Z: at the front edge (depth) with offset for clearance

    let x: number
    let y: number
    let z: number

    // X position based on door position
    // For 2-door setup: left door gets left half, right door gets right half
    switch (this.position) {
      case "left":
        // Left door: position at left edge + half door width
        x = this.width / 2
        break
      case "right":
        // Right door: position at right edge - half door width
        // For 2-door setup: right door should be positioned at the right half of the carcass
        x = this.carcassWidth - this.width / 2
        break
      case "center":
      default:
        // Center door: position at center of entire carcass
        x = this.width / 2
        break
    }

    // Y position: centered on carcass height, with overhang offset if enabled
    const doorHeight = this.overhang ? this.height + 20 : this.height
    y = doorHeight / 2 - (this.overhang ? 20 : 0)

    // Z position: at the front edge with offset for clearance
    // The door should be positioned slightly in front of the carcass for proper clearance
    z = this.depth + this.material.getThickness() / 2 + this.offset

    this.group.position.set(x, y, z)
  }

  public updateDimensions(
    width: number,
    height: number,
    depth: number,
    thickness: number
  ): void {
    this.width = width
    this.height = height
    this.depth = depth
    this.thickness = thickness

    // Update geometry and wireframe
    const doorHeight = this.overhang ? this.height + 20 : this.height
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      doorHeight,
      this.material.getThickness()
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public updateMaterial(material: DoorMaterial): void {
    this.material = material
    this.mesh.material = material.getMaterial()

    // Update geometry and wireframe with new thickness
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.material.getThickness()
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public setPosition(position: "left" | "right" | "center"): void {
    this.position = position
    this.updatePosition()
  }

  public setOffset(offset: number): void {
    this.offset = offset
    this.updatePosition()
  }

  public updateCarcassWidth(carcassWidth: number): void {
    this.carcassWidth = carcassWidth
    this.updatePosition()
  }

  public updateOverhang(overhang: boolean): void {
    this.overhang = overhang

    // Update geometry and wireframe with new height
    const doorHeight = this.overhang ? this.height + 20 : this.height
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      doorHeight,
      this.material.getThickness()
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
    this.material.dispose()
  }
}
