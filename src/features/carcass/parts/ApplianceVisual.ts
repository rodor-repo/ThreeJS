import * as THREE from "three"
import {
  createMeshGroup,
  updateMeshGeometry,
  disposeCarcassPart,
} from "../utils/carcass-geometry-utils"

export interface ApplianceVisualProps {
  width: number // Width of the visual (X axis)
  height: number // Height of the visual (Y axis)
  depth: number // Depth of the visual (Z axis)
  applianceType?: "dishwasher" | "washingMachine" | "sideBySideFridge"
}

// Colors for different appliance types (for visual distinction)
const APPLIANCE_COLORS: Record<string, number> = {
  dishwasher: 0x708090, // Slate gray
  washingMachine: 0xe8e8e8, // Light gray/white
  sideBySideFridge: 0xc0c0c0, // Silver
}

/**
 * ApplianceVisual - Decorative inner box representing the appliance
 * This is purely for visual purposes and is NOT included in nesting/part exports
 * Positioned inside the shell with configurable gaps (top, left, right)
 */
export class ApplianceVisual {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number
  public applianceType: "dishwasher" | "washingMachine" | "sideBySideFridge"

  // Gap offsets (set via updateDimensions)
  public topGap: number = 0
  public leftGap: number = 0
  public rightGap: number = 0

  constructor(props: ApplianceVisualProps) {
    this.width = props.width
    this.height = props.height
    this.depth = props.depth
    this.applianceType = props.applianceType || "dishwasher"

    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth)

    const material = new THREE.MeshLambertMaterial({
      color:
        APPLIANCE_COLORS[this.applianceType] || APPLIANCE_COLORS.dishwasher,
      transparent: false,
    })

    const { group, mesh } = createMeshGroup(geometry, material)
    this.group = group
    this.mesh = mesh
  }

  /**
   * Update visual dimensions based on shell size and gaps
   * The visual is sized to fit inside the shell with the specified gaps
   */
  public updateDimensions(
    shellWidth: number,
    shellHeight: number,
    shellDepth: number,
    topGap: number = 0,
    leftGap: number = 0,
    rightGap: number = 0
  ): void {
    this.topGap = topGap
    this.leftGap = leftGap
    this.rightGap = rightGap

    // Calculate visual dimensions (shell minus gaps)
    const horizontalGap = leftGap + rightGap
    this.width = Math.max(10, shellWidth - horizontalGap)
    this.height = Math.max(10, shellHeight - topGap)
    this.depth = shellDepth

    // Update geometry
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.depth
    )
    updateMeshGeometry(this.mesh, this.group, newGeometry)

    this.updatePosition(shellWidth, shellHeight, shellDepth)
  }

  /**
   * Position visual inside shell, accounting for gaps
   * Visual is bottom-aligned within the shell (gaps only at top and sides)
   */
  public updatePosition(
    shellWidth: number,
    shellHeight: number,
    shellDepth: number
  ): void {
    // Calculate center position with gap offsets
    // Shell center is at (shellWidth/2, shellHeight/2, shellDepth/2)
    // Visual should be:
    //   - Offset horizontally: center + (leftGap - rightGap) / 2
    //   - Positioned vertically so bottom aligns with shell bottom, top has topGap
    const xOffset = (this.leftGap - this.rightGap) / 2

    // Bottom-aligned: visual bottom at shell bottom (y=0 in shell local space)
    // Visual center Y = visual height / 2
    const yPosition = this.height / 2

    this.group.position.set(shellWidth / 2 + xOffset, yPosition, shellDepth / 2)
  }

  public setApplianceType(
    type: "dishwasher" | "washingMachine" | "sideBySideFridge"
  ): void {
    this.applianceType = type
    const material = this.mesh.material as THREE.MeshLambertMaterial
    material.color.setHex(APPLIANCE_COLORS[type] || APPLIANCE_COLORS.dishwasher)
  }

  public dispose(): void {
    disposeCarcassPart(this.mesh, this.group)
  }
}
