import { CarcassAssembly } from "../CarcassAssembly"
import { CarcassDrawer } from "../parts/CarcassDrawer"
import { DrawerHeightManager } from "../parts/DrawerHeightManager"
import { calculateDrawerWidth } from "../utils/carcass-dimension-utils"
import {
  roundToDecimal,
  distributeHeightEqually,
  validateTotalHeight,
  clamp,
  calculateRatio,
  approximatelyEqual,
} from "../utils/carcass-math-utils"
import { getDrawerConstraints } from "../utils/drawer-constraint-utils"

export class CarcassDrawerManager {
  private assembly: CarcassAssembly
  public drawers: CarcassDrawer[] = []

  constructor(assembly: CarcassAssembly) {
    this.assembly = assembly
  }

  public createDrawers(): void {
    this.drawers = []
    const config = this.assembly.config
    const dimensions = this.assembly.dimensions

    if (config.drawerEnabled && config.drawerQuantity) {
      if (this.assembly.cabinetType === "wardrobe") {
        this.createWardrobeDrawers()
        return
      }

      // Regular drawers
      const endPanelThickness = config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(dimensions.width, endPanelThickness)
      
      // Calculate default drawer heights if not provided
      let drawerHeights = config.drawerHeights || []
      if (drawerHeights.length === 0) {
        drawerHeights = distributeHeightEqually(dimensions.height, config.drawerQuantity)
        config.drawerHeights = [...drawerHeights]
      } else {
        const validation = validateTotalHeight(drawerHeights, dimensions.height)
        if (!validation.isValid) {
          drawerHeights = distributeHeightEqually(dimensions.height, config.drawerQuantity)
          config.drawerHeights = [...drawerHeights]
          console.log(`Total drawer height exceeded carcass height. Redistributed to ${drawerHeights[0]}mm each.`)
        }
      }

      for (let i = 0; i < config.drawerQuantity; i++) {
        const drawerHeight = drawerHeights[i] || roundToDecimal(dimensions.height / config.drawerQuantity)
        const drawer = new CarcassDrawer({
          width: drawerWidth,
          height: drawerHeight,
          depth: dimensions.depth,
          material: config.material,
          position: i,
          totalDrawers: config.drawerQuantity,
          carcassHeight: dimensions.height,
        })
        this.drawers.push(drawer)
      }

      this.updateDrawerPositions()
    }
  }

  public createWardrobeDrawers(): void {
    this.drawers = []
    const config = this.assembly.config
    const dimensions = this.assembly.dimensions
    const drawerQuantity = config.drawerQuantity || 0

    if (drawerQuantity > 0) {
      const endPanelThickness = config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(dimensions.width, endPanelThickness)
      const drawerHeight = config.wardrobeDrawerHeight || 220

      const drawerHeights = Array(drawerQuantity).fill(drawerHeight)
      config.drawerHeights = [...drawerHeights]

      for (let i = 0; i < drawerQuantity; i++) {
        const drawer = new CarcassDrawer({
          width: drawerWidth,
          height: drawerHeight,
          depth: dimensions.depth,
          material: config.material,
          position: i,
          totalDrawers: drawerQuantity,
          carcassHeight: dimensions.height,
          positionFromBottom: true,
        })
        this.drawers.push(drawer)
      }

      this.updateWardrobeDrawerPositions()
    }
  }

  public updateDrawerPositions(): void {
    const config = this.assembly.config
    
    if (!config.drawerEnabled || this.drawers.length === 0) return

    if (this.assembly.cabinetType === "wardrobe") {
      this.updateWardrobeDrawerPositions()
      return
    }

    const allDrawerHeights = this.drawers.map(
      (drawer, index) =>
        config.drawerHeights?.[index] ||
        roundToDecimal(this.assembly.dimensions.height / (config.drawerQuantity || 1))
    )

    this.drawers.forEach((drawer, index) => {
      const drawerHeight = allDrawerHeights[index]
      const endPanelThickness = config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(this.assembly.dimensions.width, endPanelThickness)

      drawer.updateDimensions(drawerWidth, drawerHeight, this.assembly.dimensions.depth)
      drawer.updatePositionWithAllHeights(allDrawerHeights)
    })
  }

  private updateWardrobeDrawerPositions(): void {
    if (this.drawers.length === 0) return

    const drawerHeight = this.assembly.config.wardrobeDrawerHeight || 220
    const allDrawerHeights = this.drawers.map(() => drawerHeight)
    const endPanelThickness = this.assembly.config.material.getPanelThickness()
    const drawerWidth = calculateDrawerWidth(this.assembly.dimensions.width, endPanelThickness)

    this.drawers.forEach((drawer) => {
      drawer.updateDimensions(drawerWidth, drawerHeight, this.assembly.dimensions.depth)
      drawer.updatePositionWithAllHeights(allDrawerHeights)
    })
  }

  public updateDrawers(): void {
    const config = this.assembly.config
    const dimensions = this.assembly.dimensions

    if (config.drawerEnabled && this.drawers.length > 0) {
      if (this.assembly.cabinetType === "wardrobe") {
        this.updateWardrobeDrawerPositions()
        return
      }

      const endPanelThickness = config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(dimensions.width, endPanelThickness)
      const drawerDepth = dimensions.depth

      // Recalculate heights if cabinet height changed
      if (config.drawerHeights && config.drawerHeights.length > 0) {
        const totalCurrentHeight = config.drawerHeights.reduce((sum, h) => sum + h, 0)
        const heightRatio = calculateRatio(dimensions.height, totalCurrentHeight)

        if (!approximatelyEqual(heightRatio, 1, 0.0001)) {
          // Fetch constraints
          const constraints = getDrawerConstraints(this.assembly.productId, config.drawerHeights.length)

          // Validate total min height
          const isMinValid = DrawerHeightManager.validateTotalMinHeight(constraints, dimensions.height)
          if (!isMinValid) {
            console.warn("New cabinet height is less than total minimum drawer height. Clamping to minimums.")
          }

          // Scale heights
          config.drawerHeights = DrawerHeightManager.scaleHeightsProportionally(
            config.drawerHeights,
            totalCurrentHeight,
            dimensions.height,
            constraints
          )

          // Validate again
          const validation = validateTotalHeight(config.drawerHeights, dimensions.height, 0.5)
          if (!validation.isValid) {
            config.drawerHeights = distributeHeightEqually(dimensions.height, config.drawerQuantity || 1)
            console.log(`Total drawer height still exceeds cabinet height. Reset to equal distribution.`)
          }

          // Dispatch UI updates
          config.drawerHeights.forEach((h, i) => {
            const constraint = constraints[i]
            if (constraint && constraint.dimId) {
              window.dispatchEvent(
                new CustomEvent("productPanel:updateDim", {
                  detail: { id: constraint.dimId, value: h },
                })
              )
            }
          })
        }
      }

      this.drawers.forEach((drawer, index) => {
        const drawerHeight =
          config.drawerHeights?.[index] ||
          roundToDecimal(dimensions.height / (config.drawerQuantity || 1))
        drawer.updateDimensions(drawerWidth, drawerHeight, drawerDepth)
        drawer.updateCarcassHeight(dimensions.height)
      })

      this.updateDrawerPositions()
    }
  }

  public updateDrawerHeight(index: number, height: number, changedId?: string): void {
    const constraints = getDrawerConstraints(this.assembly.productId, this.assembly.config.drawerQuantity || 0)
    const constraint = constraints[index] || { min: 50, max: this.assembly.dimensions.height, dimId: "" }
    
    height = roundToDecimal(height)
    height = clamp(height, constraint.min, constraint.max)

    if (!this.assembly.config.drawerHeights) {
      this.assembly.config.drawerHeights = []
    }
    this.assembly.config.drawerHeights[index] = height

    // Redistribute remaining height
    this.redistributeDrawerHeights(index, constraints, changedId)

    const validation = this.validateDrawerHeights()
    if (!validation.isValid) {
      console.warn(`Drawer heights still exceed carcass height. Auto-balancing.`)
      this.balanceDrawerHeights()
    }

    this.updateDrawerPositions()
  }

  private redistributeDrawerHeights(
    changedIndex: number,
    constraints: any[], // Typed as DrawerConstraint[]
    changedId?: string
  ): void {
      const config = this.assembly.config
      if (!config.drawerHeights || config.drawerHeights.length === 0) return

      const totalCarcassHeight = this.assembly.dimensions.height
      const currentTotalHeight = config.drawerHeights.reduce((sum, h) => sum + h, 0)
      const diff = currentTotalHeight - totalCarcassHeight

      if (Math.abs(diff) < 0.1) return

      const lastDrawerIndex = (config.drawerQuantity || 1) - 1
      if (changedIndex === lastDrawerIndex) {
          console.warn("Attempted to modify last drawer manually.")
          return
      }

      // Adjust last drawer
      const currentLastDrawerHeight = config.drawerHeights[lastDrawerIndex]
      let newLastDrawerHeight = currentLastDrawerHeight - diff

      const lastConstraint = constraints[lastDrawerIndex]
      const safeMin = lastConstraint?.min || 50
      const safeMax = lastConstraint?.max || totalCarcassHeight
      
      newLastDrawerHeight = clamp(newLastDrawerHeight, safeMin, safeMax)
      config.drawerHeights[lastDrawerIndex] = newLastDrawerHeight

      if (lastConstraint?.dimId) {
           window.dispatchEvent(
            new CustomEvent("productPanel:updateDim", {
              detail: { id: lastConstraint.dimId, value: newLastDrawerHeight },
            })
          )
      }
  }

  public validateDrawerHeights() {
      return validateTotalHeight(this.getDrawerHeights(), this.assembly.dimensions.height)
  }

  public getDrawerHeights(): number[] {
      if (!this.assembly.config.drawerHeights || this.assembly.config.drawerHeights.length === 0) {
          return distributeHeightEqually(
              this.assembly.dimensions.height,
              this.assembly.config.drawerQuantity || 1
          )
      }
      return [...this.assembly.config.drawerHeights]
  }

  public balanceDrawerHeights(): void {
      if (!this.assembly.config.drawerQuantity || this.assembly.config.drawerQuantity <= 0) return
      
      const heights = this.getDrawerHeights()
      const total = heights.reduce((sum, h) => sum + h, 0)
      
      if (total > this.assembly.dimensions.height) {
          this.assembly.config.drawerHeights = distributeHeightEqually(
              this.assembly.dimensions.height,
              this.assembly.config.drawerQuantity
          )
          this.updateDrawerPositions()
      }
  }

  /**
   * Toggle drawer visibility on/off
   */
  public toggleDrawers(enabled: boolean): void {
    const config = this.assembly.config
    config.drawerEnabled = enabled

    if (enabled) {
      if (this.drawers.length === 0) {
        if (this.assembly.cabinetType === "wardrobe") {
          this.createWardrobeDrawers()
        } else {
          this.createDrawers()
        }
        this.assembly.addPartsToGroup(this.drawers)
      }
    } else {
      this.assembly.removePartsFromGroup(this.drawers)
      this.dispose()
    }
  }

  /**
   * Update drawer quantity, recreating drawers as needed
   */
  public updateQuantity(quantity: number): void {
    const config = this.assembly.config
    config.drawerQuantity = quantity
    config.drawerHeights = [] // Reset heights for recalculation

    // Remove existing drawers
    this.assembly.removePartsFromGroup(this.drawers)
    this.dispose()

    // Recreate if enabled
    if (config.drawerEnabled && quantity > 0) {
      if (this.assembly.cabinetType === "wardrobe") {
        this.createWardrobeDrawers()
      } else {
        this.createDrawers()
      }
      this.assembly.addPartsToGroup(this.drawers)
    }
  }
  
  public dispose(): void {
      this.drawers.forEach(d => d.dispose())
      this.drawers = []
  }
}

