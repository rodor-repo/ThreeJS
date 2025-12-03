import * as THREE from "three"
import { CarcassMaterial } from "../Material"
import { DRAWER_GAP } from "../utils/carcass-dimension-utils"

export interface DrawerFrontProps {
  width: number // Width of the drawer front (X-axis) - matches carcass width
  height: number // Height of the drawer front (Y-axis) - user configurable
  depth: number // Depth of the drawer front (Z-axis) - material thickness
  material: CarcassMaterial
  position: number // Position index (0 = top drawer, 1 = second drawer, etc.)
  totalDrawers: number // Total number of drawers for positioning
  carcassHeight: number // Full height of the carcass
  positionFromBottom?: boolean // If true, position drawers from bottom (for wardrobe)
}

export interface DrawerConfiguration {
  quantity: number // Number of drawers (1-6)
  drawerHeights: number[] // Individual drawer heights
  heightBalance: number // Remaining height to distribute
  totalHeight: number // Sum of all drawer heights
}

export class CarcassDrawer {
  public mesh: THREE.Mesh
  public group: THREE.Group
  public width: number
  public height: number
  public depth: number
  public material: CarcassMaterial
  public position: number
  public totalDrawers: number
  public carcassHeight: number
  public positionFromBottom: boolean

  constructor(props: DrawerFrontProps) {
    this.width = props.width
    this.height = props.height
    this.depth = props.depth
    this.material = props.material
    this.position = props.position
    this.totalDrawers = props.totalDrawers
    this.carcassHeight = props.carcassHeight
    this.positionFromBottom = props.positionFromBottom ?? false

    // Create geometry for the drawer front
    // X-axis: width, Y-axis: height, Z-axis: depth (material thickness)
    const geometry = new THREE.BoxGeometry(
      this.width, // width
      this.height, // height
      this.material.getPanelThickness() // depth (drawer front thickness)
    )

    // Create mesh with drawer material
    this.mesh = new THREE.Mesh(geometry, this.material.getMaterial())
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    // Create group to contain mesh and wireframe
    this.group = new THREE.Group()
    this.group.add(this.mesh)

    // Add wireframe outline
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    this.group.add(wireframe)

    // Note: Don't position the drawer here as it will be positioned by the parent
    // CarcassAssembly using updatePositionWithAllHeights() after all drawers are created
  }

  private updatePosition(): void {
    // Calculate Y position based on drawer position
    // Start from top of carcass and work down
    let yPosition = this.carcassHeight / 2 // Start at top center

    // Subtract heights of all drawers above this one
    for (let i = 0; i < this.position; i++) {
      // This would need to be updated when drawer heights change
      // For now, we'll use a placeholder approach
      yPosition -= this.height // This will be updated by the parent
    }

    // Move down by half the height of this drawer
    yPosition -= this.height / 2

    // X position: centered on carcass width
    // The carcass extends from x=0 to x=width
    // End panels are at x=0 and x=carcassWidth
    // Drawer width is reduced by end panel thicknesses
    // So drawer should be centered in the remaining space
    // Position = endPanelThickness + (drawerWidth / 2)
    const _endPanelThickness = this.material.getPanelThickness()
    const xPosition = DRAWER_GAP + this.width / 2

    // Y position: adjust for carcass position in scene
    // Add carcassHeight/2 to move up to correct position
    const adjustedYPosition = yPosition + this.carcassHeight / 2

    // Z position: flush with carcass front edge
    // The carcass extends from z=0 to z=depth
    // We want the drawer front to be at the front edge (z=0)
    // But we need to account for the carcass depth position in the scene
    const zPosition = this.depth + this.material.getPanelThickness() / 2

    this.group.position.set(xPosition, adjustedYPosition, zPosition)
  }

  // Method to update position with all drawer heights for accurate positioning
  public updatePositionWithAllHeights(allDrawerHeights: number[]): void {
    let yPosition: number

    if (this.positionFromBottom) {
      // Position drawers from bottom (for wardrobe)
      // Drawer 0 at bottom, drawer 1 above it, etc.
      yPosition = -this.carcassHeight / 2 // Start at bottom center

      // Add heights of all drawers below this one
      for (let i = 0; i < this.position; i++) {
        if (allDrawerHeights[i]) {
          yPosition += allDrawerHeights[i]
        }
      }

      // Move up by half the height of this drawer
      yPosition += this.height / 2
    } else {
      // Position drawers from top (default behavior)
      yPosition = this.carcassHeight / 2 // Start at top center

      // Subtract heights of all drawers above this one
      for (let i = 0; i < this.position; i++) {
        if (allDrawerHeights[i]) {
          yPosition -= allDrawerHeights[i]
        }
      }

      // Move down by half the height of this drawer
      yPosition -= this.height / 2
    }

    // X position: centered on carcass width
    // The carcass extends from x=0 to x=width
    // End panels are at x=0 and x=carcassWidth
    // Drawer width is reduced by end panel thicknesses
    // So drawer should be centered in the remaining space
    // Position = endPanelThickness + (drawerWidth / 2)
    const _endPanelThickness = this.material.getPanelThickness()
    const xPosition = DRAWER_GAP + this.width / 2

    // Y position: adjust for carcass position in scene
    // Add carcassHeight/2 to move up to correct position
    const adjustedYPosition = yPosition + this.carcassHeight / 2

    // Z position: flush with carcass front edge
    // The carcass extends from z=0 to z=depth
    // We want the drawer front to be at the front edge (z=0)
    // But we need to account for the carcass depth position in the scene
    const zPosition = this.depth + this.material.getPanelThickness() / 2

    this.group.position.set(xPosition, adjustedYPosition, zPosition)
  }

  public updateDimensions(width: number, height: number, depth: number): void {
    this.width = width
    this.height = height
    this.depth = depth

    // Create new geometry with updated dimensions
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.material.getPanelThickness()
    )

    // Dispose of old geometry and assign new one
    this.mesh.geometry.dispose()
    this.mesh.geometry = newGeometry

    // Update wireframe
    this.group.remove(this.group.children[1]) // Remove old wireframe
    const edges = new THREE.EdgesGeometry(newGeometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    this.group.add(wireframe)

    // Note: Don't call updatePosition here as it will be called by updatePositionWithAllHeights
    // from the parent CarcassAssembly to ensure proper positioning with all drawer heights
  }

  public updateMaterial(material: CarcassMaterial): void {
    this.material = material
    this.mesh.material = material.getMaterial()

    // Create new geometry with updated thickness
    const newGeometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.material.getPanelThickness()
    )

    // Dispose of old geometry and assign new one
    this.mesh.geometry.dispose()
    this.mesh.geometry = newGeometry

    // Update wireframe
    this.group.remove(this.group.children[1]) // Remove old wireframe
    const edges = new THREE.EdgesGeometry(newGeometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333 })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    this.group.add(wireframe)

    // Note: Don't call updatePosition here as it will be called by updatePositionWithAllHeights
    // from the parent CarcassAssembly to ensure proper positioning with all drawer heights
  }

  public setPosition(newPosition: number): void {
    this.position = newPosition
    // Note: Don't call updatePosition here as it will be called by updatePositionWithAllHeights
    // from the parent CarcassAssembly to ensure proper positioning with all drawer heights
  }

  public updateCarcassHeight(newHeight: number): void {
    this.carcassHeight = newHeight
    // Note: Don't call updatePosition here as it will be called by updatePositionWithAllHeights
    // from the parent CarcassAssembly to ensure proper positioning with all drawer heights
  }

  public dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.group.children.forEach((child) => {
      if (child instanceof THREE.LineSegments) {
        ;(child.geometry as THREE.EdgesGeometry).dispose()
        ;(child.material as THREE.LineBasicMaterial).dispose()
      }
    })
  }
}

// Utility functions for drawer calculations
export class DrawerCalculator {
  /**
   * Calculate default drawer heights by dividing carcass height equally
   */
  static calculateDefaultDrawerHeights(
    carcassHeight: number,
    drawerQuantity: number
  ): number[] {
    const defaultHeight = carcassHeight / drawerQuantity
    return Array(drawerQuantity).fill(defaultHeight)
  }

  /**
   * Calculate height balance and redistribute remaining height
   */
  static calculateHeightBalance(
    carcassHeight: number,
    drawerHeights: number[]
  ): { heightBalance: number; adjustedHeights: number[] } {
    const totalDrawerHeight = drawerHeights.reduce(
      (sum, height) => sum + height,
      0
    )
    const heightBalance = carcassHeight - totalDrawerHeight

    if (heightBalance <= 0) {
      // No balance to distribute, return original heights
      return { heightBalance: 0, adjustedHeights: [...drawerHeights] }
    }

    // Distribute balance equally among remaining drawers
    const adjustedHeights = [...drawerHeights]
    const remainingDrawers = adjustedHeights.length
    const balancePerDrawer = heightBalance / remainingDrawers

    for (let i = 0; i < remainingDrawers; i++) {
      adjustedHeights[i] += balancePerDrawer
    }

    return { heightBalance, adjustedHeights }
  }

  /**
   * Validate drawer configuration
   */
  static validateDrawerConfiguration(
    carcassHeight: number,
    drawerHeights: number[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (drawerHeights.length === 0) {
      errors.push("At least one drawer is required")
    }

    const totalHeight = drawerHeights.reduce((sum, height) => sum + height, 0)

    if (totalHeight > carcassHeight) {
      errors.push(
        `Total drawer height (${totalHeight}mm) exceeds carcass height (${carcassHeight}mm)`
      )
    }

    if (drawerHeights.some((height) => height <= 0)) {
      errors.push("All drawer heights must be positive")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
