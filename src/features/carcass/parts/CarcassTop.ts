import * as THREE from "three"
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from "../utils/carcass-geometry-utils"
import {
  calculateEffectiveDepth,
  calculatePanelCenterX,
} from "../utils/carcass-dimension-utils"

export interface CarcassTopProps {
  depth: number // Depth of the cabinet (Z Axes)
  width: number // Width between the two ends (Width - 2x Thickness)
  thickness: number // Thickness of the top panel (Y Axes)
  height: number // Height of the cabinet (Y Axes) - for positioning
  leftEndThickness: number // Thickness of the left end panel for positioning
  backThickness: number // Thickness of the back panel for positioning
  material?: THREE.Material
  cabinetType?: "top" | "base" | "tall" // Cabinet type to determine if Base Rail applies
  baseRailDepth?: number // Base Rail depth for Base cabinets (default: 60mm)
  isDrawerBase?: boolean // Whether this is a Drawer Base cabinet (affects positioning)
}

export class CarcassTop {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public depth: number
  public width: number
  public thickness: number
  public height: number
  public leftEndThickness: number
  public backThickness: number
  public cabinetType: "top" | "base" | "tall"
  public baseRailDepth: number
  public isDrawerBase: boolean

  constructor(props: CarcassTopProps) {
    this.depth = props.depth
    this.width = props.width
    this.thickness = props.thickness
    this.height = props.height
    this.leftEndThickness = props.leftEndThickness
    this.backThickness = props.backThickness
    this.cabinetType = props.cabinetType || "base"
    this.baseRailDepth = props.baseRailDepth || 60 // Default Base Rail depth is 60mm
    this.isDrawerBase = props.isDrawerBase || false // Default to Standard Base (not Drawer Base)

    // Create geometry for top panel
    const geometry = this.createGeometry()

    // Create mesh group with wireframe
    const { group, mesh } = createMeshGroup(geometry, props.material)
    this.group = group
    this.mesh = mesh

    // Position the top panel according to new logic
    this.updatePosition()
  }

  private createGeometry(): THREE.BoxGeometry {
    if (this.cabinetType === "base") {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning, 60mm depth in front
        // const effectiveDepth = calculateEffectiveDepth(
        //   this.depth,
        //   this.backThickness
        // )
        const baseRailDepth = 60
        return new THREE.BoxGeometry(this.width, this.thickness, baseRailDepth)
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        return new THREE.BoxGeometry(
          this.width,
          this.baseRailDepth,
          this.thickness
        )
      }
    } else {
      // For other cabinet types - HORIZONTAL positioning
      const effectiveDepth = calculateEffectiveDepth(
        this.depth,
        this.backThickness
      )
      return new THREE.BoxGeometry(this.width, this.thickness, effectiveDepth)
    }
  }

  private updatePosition(): void {
    const xPosition = calculatePanelCenterX(this.leftEndThickness, this.width)
    const effectiveDepth = calculateEffectiveDepth(
      this.depth,
      this.backThickness
    )

    if (this.cabinetType === "base") {
      if (this.isDrawerBase) {
        // For Drawer Base cabinets - HORIZONTAL positioning
        const baseRailDepth = 60

        this.group.position.set(
          xPosition,
          this.height - this.thickness / 2,
          // 0 // Front edge of end panels
          // this.backThickness + effectiveDepth / 2
          this.depth - baseRailDepth / 2 // Position so front edge aligns with carcass front
        )
      } else {
        // For Standard Base cabinets - VERTICAL positioning
        this.group.position.set(
          xPosition,
          this.height - this.baseRailDepth / 2,
          this.depth - this.thickness / 2 // Full carcass depth
        )
      }
    } else {
      // For other cabinet types, use standard horizontal positioning
      this.group.position.set(
        xPosition,
        this.height - this.thickness / 2,
        this.backThickness + effectiveDepth / 2
      )
    }
  }

  public updateDimensions(
    depth: number,
    width: number,
    thickness: number,
    leftEndThickness: number,
    backThickness: number
  ): void {
    this.depth = depth
    this.width = width
    this.thickness = thickness
    this.leftEndThickness = leftEndThickness
    this.backThickness = backThickness

    // Update geometry using utility function
    const newGeometry = this.createGeometry()
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  public updateHeight(height: number): void {
    this.height = height
    // Update position when height changes
    this.updatePosition()
  }

  public updateBaseRailSettings(
    cabinetType: "top" | "base" | "tall",
    baseRailDepth?: number
  ): void {
    this.cabinetType = cabinetType
    if (baseRailDepth !== undefined) {
      this.baseRailDepth = baseRailDepth
    }

    // Recreate geometry with new Base Rail settings
    const newGeometry = this.createGeometry()
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  /**
   * Update whether this is a Drawer Base cabinet
   * This affects both geometry and positioning
   */
  public updateDrawerBaseSetting(isDrawerBase: boolean): void {
    this.isDrawerBase = isDrawerBase

    // Recreate geometry based on new setting
    const newGeometry = this.createGeometry()
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    // Update position
    this.updatePosition()
  }

  /**
   * Get positioning information for debugging
   */
  public getPositioningInfo(): string {
    if (this.cabinetType === "base") {
      if (this.isDrawerBase) {
        return `Drawer Base Rail (Horizontal)\nHeight: ${
          this.thickness
        }mm\nWidth: ${this.width}mm\nDepth: ${
          this.depth - this.backThickness
        }mm\nPosition: Front Edge (Z=0)`
      } else {
        return `Standard Base Rail (Vertical)\nHeight: ${
          this.baseRailDepth
        }mm\nWidth: ${this.width}mm\nDepth: ${this.thickness}mm\nPosition: Z=${
          this.depth
        }mm (Carcass Depth), Y=${
          this.height - this.baseRailDepth / 2
        }mm (Half Rail Height)`
      }
    } else {
      return `Top Panel (Horizontal)\nHeight: ${this.thickness}mm\nWidth: ${
        this.width
      }mm\nDepth: ${this.depth - this.backThickness}mm\nPosition: Standard`
    }
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}