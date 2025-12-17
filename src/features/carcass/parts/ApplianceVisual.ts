import * as THREE from "three"

export interface ApplianceVisualProps {
  width: number // Width of the visual (X axis)
  height: number // Height of the visual (Y axis)
  depth: number // Depth of the visual (Z axis)
  applianceType?: "dishwasher" | "washingMachine" | "sideBySideFridge"
  fridgeDoorCount?: 1 | 2
  fridgeDoorSide?: "left" | "right"
}

// Colors for different appliance components
const COLORS = {
  washingMachine: {
    body: 0xe8e8e8, // Light gray
    drum: 0x4a4a4a, // Dark gray
    glass: 0x2a2a2a, // Very dark
  },
  fridge: {
    body: 0xc0c0c0, // Silver
    handle: 0x888888, // Chrome-like
    seam: 0x3a3a3a, // Dark seam
  },
  dishwasher: {
    body: 0x708090, // Slate gray
    panel: 0x505050, // Dark slate
    handle: 0x888888, // Chrome-like
  },
}

/**
 * ApplianceVisual - Decorative inner representation of the appliance
 * Uses composed geometries (groups of meshes) for different appliance types.
 */
export class ApplianceVisual {
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number
  public applianceType: "dishwasher" | "washingMachine" | "sideBySideFridge"

  // Fridge specific props
  public fridgeDoorCount: 1 | 2
  public fridgeDoorSide: "left" | "right"

  // Gap offsets (set via updateDimensions)
  public topGap: number = 0
  public leftGap: number = 0
  public rightGap: number = 0

  constructor(props: ApplianceVisualProps) {
    this.width = props.width
    this.height = props.height
    this.depth = props.depth
    this.applianceType = props.applianceType || "dishwasher"
    this.fridgeDoorCount = props.fridgeDoorCount || 2
    this.fridgeDoorSide = props.fridgeDoorSide || "left"

    this.group = new THREE.Group()
    this.buildVisual()
  }

  /**
   * Clears existing meshes and rebuilds based on current properties
   */
  private buildVisual(): void {
    this.clear()

    switch (this.applianceType) {
      case "washingMachine":
        this.createWashingMachineVisual()
        break
      case "sideBySideFridge":
        this.createFridgeVisual()
        break
      case "dishwasher":
      default:
        this.createDishwasherVisual()
        break
    }
  }

  private clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0]
      this.group.remove(child)

      // Recursive dispose for groups or meshes
      this.disposeObject(child)
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    } else if (obj instanceof THREE.Group) {
      while (obj.children.length > 0) {
        const child = obj.children[0]
        obj.remove(child)
        this.disposeObject(child)
      }
    }
  }

  /**
   * Washing Machine: Box body + Drum + Control Panel
   */
  private createWashingMachineVisual(): void {
    // 1. Main Body
    const bodyGeo = new THREE.BoxGeometry(this.width, this.height, this.depth)
    const bodyMat = new THREE.MeshLambertMaterial({
      color: COLORS.washingMachine.body,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    this.group.add(body)

    // 2. Control Panel (Top, inset slightly)
    const panelHeight = Math.max(50, this.height * 0.15)
    // Position: Top front
    const panelGeo = new THREE.BoxGeometry(this.width * 0.95, panelHeight, 10)
    const panelMat = new THREE.MeshLambertMaterial({
      color: COLORS.washingMachine.drum,
    }) // Darker
    const panel = new THREE.Mesh(panelGeo, panelMat)

    // Y: At the top
    const panelY = this.height / 2 - panelHeight / 2 - 10
    // Z: Slightly protruding from front face
    const panelZ = this.depth / 2 + 5
    panel.position.set(0, panelY, panelZ)
    this.group.add(panel)

    // 3. Drum Assembly (Cylinder)
    const drumRadius = Math.min(this.width, this.height - panelHeight) * 0.35
    const drumDepth = 20

    // Outer Ring
    const drumGeo = new THREE.CylinderGeometry(
      drumRadius,
      drumRadius,
      drumDepth,
      32
    )
    const drumMat = new THREE.MeshLambertMaterial({
      color: COLORS.washingMachine.drum,
    })
    const drum = new THREE.Mesh(drumGeo, drumMat)

    // Rotate to face forward
    drum.rotation.x = Math.PI / 2
    
    // Position: Middle of the remainder height
    // Or simpler: just visually centered below panel
    const drumCenterY = -panelHeight / 2

    drum.position.set(0, drumCenterY, this.depth / 2 + 5)
    this.group.add(drum)

    // Inner Glass
    const glassGeo = new THREE.CylinderGeometry(
      drumRadius * 0.8,
      drumRadius * 0.8,
      drumDepth + 2,
      32
    )
    const glassMat = new THREE.MeshLambertMaterial({
      color: COLORS.washingMachine.glass,
    })
    const glass = new THREE.Mesh(glassGeo, glassMat)
    glass.rotation.x = Math.PI / 2
    glass.position.set(0, drumCenterY, this.depth / 2 + 5)
    this.group.add(glass)
  }

  /**
   * Side-by-Side Fridge: Box body + Doors + Handles
   */
  private createFridgeVisual(): void {
    // 1. Main Body
    const bodyGeo = new THREE.BoxGeometry(this.width, this.height, this.depth)
    const bodyMat = new THREE.MeshLambertMaterial({ color: COLORS.fridge.body })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    this.group.add(body)

    const handleHeight = this.height * 0.6
    const handleY = 0 // Centered vertically

    // 2 Doors vs 1 Door
    if (this.fridgeDoorCount === 2) {
      // Draw seam in middle
      const seamGeo = new THREE.BoxGeometry(2, this.height * 0.95, 2)
      const seamMat = new THREE.MeshLambertMaterial({
        color: COLORS.fridge.seam,
      })
      const seam = new THREE.Mesh(seamGeo, seamMat)
      seam.position.set(0, 0, this.depth / 2 + 1)
      this.group.add(seam)

      // Two handles (inner)
      this.createHandle(-15, handleY, handleHeight) // Left handle
      this.createHandle(15, handleY, handleHeight) // Right handle
    } else {
      // 1 Door
      // Handle position depends on side
      const xPos =
        this.fridgeDoorSide === "left"
          ? -(this.width / 2) + 30 // Handle on left
          : this.width / 2 - 30 // Handle on right

      this.createHandle(xPos, handleY, handleHeight)
    }
  }

  private createHandle(x: number, y: number, height: number): void {
    const geo = new THREE.BoxGeometry(10, height, 15)
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.fridge.handle })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, this.depth / 2 + 7)
    this.group.add(mesh)
  }

  /**
   * Dishwasher: Box body + Top Panel + Handle Bar
   */
  private createDishwasherVisual(): void {
    // 1. Main Body
    const bodyGeo = new THREE.BoxGeometry(this.width, this.height, this.depth)
    const bodyMat = new THREE.MeshLambertMaterial({
      color: COLORS.dishwasher.body,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    this.group.add(body)

    // 2. Control Panel
    const panelHeight = 80
    const panelGeo = new THREE.BoxGeometry(this.width, panelHeight, 5)
    // Slightly distinctive color
    const panelMat = new THREE.MeshLambertMaterial({
      color: COLORS.dishwasher.panel,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)

    const panelY = this.height / 2 - panelHeight / 2
    panel.position.set(0, panelY, this.depth / 2 + 2)
    this.group.add(panel)

    // 3. Handle Bar (Horizontal below panel)
    const handleWidth = this.width * 0.8
    const handleHeight = 15
    const handleDepth = 15
    const handleGeo = new THREE.BoxGeometry(
      handleWidth,
      handleHeight,
      handleDepth
    )
    const handleMat = new THREE.MeshLambertMaterial({
      color: COLORS.dishwasher.handle,
    })
    const handle = new THREE.Mesh(handleGeo, handleMat)

    // Position below panel
    const handleY = panelY - panelHeight / 2 - 30
    handle.position.set(0, handleY, this.depth / 2 + 10)
    this.group.add(handle)
  }

  /**
   * Update all dimensions and rebuild visuals
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

    // Rebuild visual with new dimensions
    this.buildVisual()

    this.updatePosition(shellWidth, shellHeight, shellDepth)
  }

  public updatePosition(
    shellWidth: number,
    shellHeight: number,
    shellDepth: number
  ): void {
    const xOffset = (this.leftGap - this.rightGap) / 2
    const yPosition = this.height / 2

    this.group.position.set(shellWidth / 2 + xOffset, yPosition, shellDepth / 2)
  }

  public setApplianceType(
    type: "dishwasher" | "washingMachine" | "sideBySideFridge"
  ): void {
    if (this.applianceType !== type) {
      this.applianceType = type
      this.buildVisual()
    }
  }

  public setFridgeConfig(count: 1 | 2, side: "left" | "right"): void {
    if (this.fridgeDoorCount !== count || this.fridgeDoorSide !== side) {
      this.fridgeDoorCount = count
      this.fridgeDoorSide = side
      if (this.applianceType === "sideBySideFridge") {
        this.buildVisual()
      }
    }
  }

  public dispose(): void {
    this.clear()
    // Group is disposed by parent scene cleanup usually, but we clear it here
  }
}
