import * as THREE from "three"
import { CarcassEnd } from "./parts/CarcassEnd"
import { CarcassBack } from "./parts/CarcassBack"
import { CarcassBottom } from "./parts/CarcassBottom"
import { CarcassShelf } from "./parts/CarcassShelf"
import { CarcassTop } from "./parts/CarcassTop"
import { CarcassLeg } from "./parts/CarcassLeg"
import { CarcassDoor } from "./parts/CarcassDoor"
import { CarcassDrawer } from "./parts/CarcassDrawer"
import { CarcassMaterial, CarcassMaterialData } from "./Material"
import { DoorMaterial } from "./DoorMaterial"
import { MaterialLoader } from "./MaterialLoader"
import { categoriesData } from "../../components/categoriesData"
import {
  calculatePanelWidth,
  calculateEffectiveDepth,
  calculateRightEndXPosition,
  calculateCabinetYPosition,
  calculateDoorDimensions,
  calculateDrawerWidth,
  calculateShelfPositions,
} from "./utils/carcass-dimension-utils"
import {
  roundToDecimal,
  distributeHeightEqually,
  validateTotalHeight,
  scaleHeightsProportionally,
  redistributeRemainingHeight,
  clamp,
  approximatelyEqual,
  calculateRatio,
} from "./utils/carcass-math-utils"

export interface CarcassDimensions {
  width: number // Width of the cabinet (X Axes)
  height: number // Height of the cabinet (Y Axes)
  depth: number // Depth of the cabinet (Z Axes)
}

export interface CarcassConfig {
  material: CarcassMaterial // Material properties including thickness and colour
  shelfCount: number // Number of adjustable shelves
  shelfSpacing: number // Spacing between shelves
  doorEnabled?: boolean // Whether doors are enabled for this cabinet
  doorMaterial?: DoorMaterial // Door material properties
  doorCount?: number // Number of doors (1 or 2)
  overhangDoor?: boolean // Whether doors should overhang (Top/Wall cabinets only)
  drawerEnabled?: boolean // Whether drawers are enabled for this cabinet
  drawerQuantity?: number // Number of drawers (1-6)
  drawerHeights?: number[] // Individual drawer heights
}

export type CabinetType = "top" | "base" | "tall"

export class CarcassAssembly {
  public group: THREE.Group
  public dimensions: CarcassDimensions
  public config: CarcassConfig
  public cabinetType: CabinetType

  // Carcass parts
  private leftEnd!: CarcassEnd
  private rightEnd!: CarcassEnd
  private back!: CarcassBack
  private bottom!: CarcassBottom
  private top!: CarcassTop
  private shelves: CarcassShelf[] = []
  private legs: CarcassLeg[] = []
  private doors: CarcassDoor[] = []
  private drawers: CarcassDrawer[] = []

  constructor(
    cabinetType: CabinetType,
    dimensions: CarcassDimensions,
    config?: Partial<CarcassConfig>
  ) {
    this.cabinetType = cabinetType
    this.dimensions = dimensions

    // Set default configuration
    this.config = {
      material: config?.material || CarcassMaterial.getDefaultMaterial(),
      shelfCount: 2, // Default 2 shelves
      shelfSpacing: 300, // 300mm between shelves
      doorEnabled:
        config?.doorEnabled !== undefined ? config.doorEnabled : true, // Doors enabled by default
      doorMaterial: config?.doorMaterial || DoorMaterial.getDefaultMaterial(),
      doorCount: config?.doorCount || 2, // Default 2 doors
      overhangDoor:
        config?.overhangDoor !== undefined
          ? config.overhangDoor
          : cabinetType === "top", // Overhang only for Top cabinets by default
      drawerEnabled:
        config?.drawerEnabled !== undefined ? config.drawerEnabled : false, // Drawers disabled by default
      drawerQuantity: config?.drawerQuantity || 3, // Default 3 drawers
      drawerHeights: config?.drawerHeights || [], // Will be calculated based on quantity
      ...config,
    }

    // Debug logging for config
    console.log("CarcassAssembly config set to:", this.config)

    // Create main group
    this.group = new THREE.Group()
    this.group.name = `${cabinetType}_carcass`

    // Build the carcass based on type
    this.buildCarcass()
  }

  private buildCarcass(): void {
    // Create all carcass parts
    this.createEndPanels()
    this.createBackPanel()
    this.createBottomPanel()
    this.createTopPanel()
    this.createShelves()
    this.createLegs()
    this.createDrawers()
    this.createDoors()

    // Add all parts to the main group
    this.addPartsToGroup([
      this.leftEnd,
      this.rightEnd,
      this.back,
      this.bottom,
      this.top,
    ])
    this.addPartsToGroup(this.shelves)
    this.addPartsToGroup(this.legs)
    this.addPartsToGroup(this.drawers)
    this.addPartsToGroup(this.doors)

    // Position the entire carcass based on type
    this.positionCarcass()
  }

  private createEndPanels(): void {
    // End Left: EndLHeight= Height (Y Axes), EndLDepth =Depth (Z Axes), EndLThickness= Thickness (X Axes)
    // Position: bottom back corner at (0,0,0)
    this.leftEnd = new CarcassEnd({
      height: this.dimensions.height,
      depth: this.dimensions.depth,
      thickness: this.getThickness(),
      position: "left",
      material: this.config.material.getMaterial(),
    })

    // End Right: EndRHeight= Height (Y Axes), EndRDepth =Depth (Z Axes), EndRThickness= Thickness (X Axes)
    // Position: bottom back corner at (Width - Thickness, 0, 0)
    this.rightEnd = new CarcassEnd({
      height: this.dimensions.height,
      depth: this.dimensions.depth,
      thickness: this.getThickness(),
      position: "right",
      material: this.config.material.getMaterial(),
    })

    // Position the right end panel correctly using utility function
    const rightEndX = calculateRightEndXPosition(
      this.dimensions.width,
      this.getThickness()
    )
    this.rightEnd.setXPosition(rightEndX)
  }

  private createBackPanel(): void {
    // Back: BackHeight= Height (Y Axes), BackWidth =Width - 2x Thickness (X Axes), BackThickness= Thickness (Z Axes)
    const { panelWidth } = this.calculateCommonPanelDimensions()

    this.back = new CarcassBack({
      height: this.dimensions.height,
      width: panelWidth,
      thickness: this.getThickness(),
      leftEndThickness: this.getThickness(),
      material: this.config.material.getMaterial(),
    })
  }

  private createBottomPanel(): void {
    // Bottom: BottomHeight= Depth (Z Axes), BottomWidth =Width - 2x Thickness (X Axes), BottomThickness= Thickness (Y Axes)
    const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions()

    this.bottom = new CarcassBottom({
      depth: effectiveDepth,
      width: panelWidth,
      thickness: this.getThickness(),
      leftEndThickness: this.getThickness(),
      backThickness: this.getThickness(),
      material: this.config.material.getMaterial(),
    })
  }

  private createTopPanel(): void {
    // Top: TopHeight= Depth (Z Axes), TopWidth =Width - 2x Thickness (X Axes), TopThickness= Thickness (Y Axes)
    const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions()

    // Get Base Rail depth from data using MaterialLoader
    const baseRailDepth = MaterialLoader.getBaseRailDepth(this.cabinetType)

    // Determine if this is a Drawer Base cabinet
    const isDrawerBase =
      this.cabinetType === "base" && this.config.drawerEnabled

    this.top = new CarcassTop({
      depth: effectiveDepth,
      width: panelWidth,
      thickness: this.getThickness(),
      height: this.dimensions.height,
      leftEndThickness: this.getThickness(),
      backThickness: this.getThickness(),
      material: this.config.material.getMaterial(),
      cabinetType: this.cabinetType,
      baseRailDepth: baseRailDepth,
      isDrawerBase: isDrawerBase,
    })
  }

  private createShelves(): void {
    this.shelves = []

    if (this.config.shelfCount > 0) {
      const thickness = this.getThickness()
      const startHeight = thickness + 100 // Start above bottom panel
      const endHeight = this.dimensions.height - thickness - 100 // End below top panel

      // Calculate shelf positions using utility function
      const shelfPositions = calculateShelfPositions(
        startHeight,
        endHeight,
        this.config.shelfCount,
        this.config.shelfSpacing
      )

      // Calculate panel dimensions
      const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions()

      // Create shelves at calculated positions
      shelfPositions.forEach((height) => {
        const shelf = new CarcassShelf({
          depth: effectiveDepth,
          width: panelWidth,
          thickness: thickness,
          height: height,
          leftEndThickness: thickness,
          backThickness: thickness,
          material: this.config.material.getMaterial(),
        })

        this.shelves.push(shelf)
      })
    }
  }

  private createLegs(): void {
    this.legs = []

    // Only create legs for base and tall cabinets
    if (this.cabinetType === "base" || this.cabinetType === "tall") {
      // Get leg height from data.js via MaterialLoader
      const legHeight = MaterialLoader.getLegHeight()

      // Create 4 legs at the corners
      const legPositions: Array<
        "frontLeft" | "frontRight" | "backLeft" | "backRight"
      > = ["frontLeft", "frontRight", "backLeft", "backRight"]

      legPositions.forEach((position) => {
        const leg = new CarcassLeg({
          height: legHeight,
          diameter: 50, // 50mm diameter as specified
          position: position,
          width: this.dimensions.width,
          depth: this.dimensions.depth,
          thickness: this.getThickness(),
          material: this.config.material.getMaterial(),
        })

        this.legs.push(leg)
      })
    }
  }

  private createDrawers(): void {
    this.drawers = []

    // Only create drawers if they are enabled
    if (this.config.drawerEnabled && this.config.drawerQuantity) {
      // Calculate drawer width using utility function
      const endPanelThickness = this.config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(
        this.dimensions.width,
        endPanelThickness
      )
      const drawerDepth = this.dimensions.depth

      // Calculate default drawer heights if not provided
      let drawerHeights = this.config.drawerHeights || []
      if (drawerHeights.length === 0) {
        // Calculate equal distribution using utility function
        drawerHeights = distributeHeightEqually(
          this.dimensions.height,
          this.config.drawerQuantity
        )
        this.config.drawerHeights = [...drawerHeights]
      } else {
        // Validate existing heights using utility function
        const validation = validateTotalHeight(
          drawerHeights,
          this.dimensions.height
        )
        if (!validation.isValid) {
          // Redistribute equally to fit within carcass height
          drawerHeights = distributeHeightEqually(
            this.dimensions.height,
            this.config.drawerQuantity
          )
          this.config.drawerHeights = [...drawerHeights]
          console.log(
            `Total drawer height exceeded carcass height. Redistributed to ${drawerHeights[0]}mm each.`
          )
        }
      }

      // Create drawer fronts
      for (let i = 0; i < this.config.drawerQuantity; i++) {
        const drawerHeight =
          drawerHeights[i] ||
          roundToDecimal(this.dimensions.height / this.config.drawerQuantity)
        const drawer = new CarcassDrawer({
          width: drawerWidth,
          height: drawerHeight,
          depth: this.dimensions.depth, // Carcass depth - drawer will be positioned at this Z coordinate
          material: this.config.material,
          position: i,
          totalDrawers: this.config.drawerQuantity,
          carcassHeight: this.dimensions.height,
        })
        this.drawers.push(drawer)
      }

      // Update positions after creating all drawers
      this.updateDrawerPositions()
    }
  }

  private createDoors(): void {
    this.doors = []

    // Debug logging for door creation
    console.log("Creating doors with config:", {
      doorEnabled: this.config.doorEnabled,
      doorCount: this.config.doorCount,
      overhangDoor: this.config.overhangDoor,
    })

    // Only create doors if they are enabled
    if (this.config.doorEnabled) {
      const doorDepth = this.dimensions.depth

      // Get door gap from data.js
      const doorGap = categoriesData.doorSettings?.gap || 2

      // Calculate door dimensions using utility function
      const doorDimensions = calculateDoorDimensions(
        this.dimensions.width,
        this.dimensions.height,
        doorGap,
        this.config.doorCount || 1
      )

      if (this.config.doorCount === 2) {
        // Create two doors side by side

        // Left door
        const leftDoor = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: this.getThickness(),
          material: this.config.doorMaterial!,
          position: "left",
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang:
            this.cabinetType === "top"
              ? this.config.overhangDoor || false
              : false,
        })

        // Right door
        const rightDoor = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: this.getThickness(),
          material: this.config.doorMaterial!,
          position: "right",
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang:
            this.cabinetType === "top"
              ? this.config.overhangDoor || false
              : false,
        })

        this.doors.push(leftDoor, rightDoor)
      } else {
        // Create single centered door
        const door = new CarcassDoor({
          width: doorDimensions.width,
          height: doorDimensions.height,
          depth: doorDepth,
          thickness: this.getThickness(),
          material: this.config.doorMaterial!,
          position: "center",
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang:
            this.cabinetType === "top"
              ? this.config.overhangDoor || false
              : false,
        })

        this.doors.push(door)
      }
    }
  }

  private positionCarcass(): void {
    // Position based on cabinet type using utility function
    const legHeight = MaterialLoader.getLegHeight()
    const yPosition = calculateCabinetYPosition(this.cabinetType, legHeight)
    this.group.position.set(0, yPosition, 0)
  }

  public updateDimensions(newDimensions: CarcassDimensions): void {
    this.dimensions = newDimensions

    const thickness = this.getThickness()
    const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions()

    // Update all parts
    this.leftEnd.updateDimensions(
      this.dimensions.height,
      this.dimensions.depth,
      thickness
    )

    this.rightEnd.updateDimensions(
      this.dimensions.height,
      this.dimensions.depth,
      thickness
    )

    // Update right end position using utility function
    const rightEndX = calculateRightEndXPosition(
      this.dimensions.width,
      thickness
    )
    this.rightEnd.setXPosition(rightEndX)

    // Update back panel with corrected width: Width - (EndLThickness + EndRThickness)
    this.back.updateDimensions(
      this.dimensions.height,
      panelWidth, // Account for both end panels
      thickness,
      thickness
    )

    // Update bottom panel
    this.bottom.updateDimensions(
      effectiveDepth,
      panelWidth,
      thickness,
      thickness,
      thickness
    )

    // Update top panel
    this.top.updateDimensions(
      effectiveDepth,
      panelWidth,
      thickness,
      thickness,
      thickness
    )
    this.top.updateHeight(this.dimensions.height)

    // Update Base Rail settings for Base cabinets
    if (this.cabinetType === "base") {
      const baseRailDepth = MaterialLoader.getBaseRailDepth(this.cabinetType)
      this.top.updateBaseRailSettings(this.cabinetType, baseRailDepth)
    }

    // Update shelves
    this.updateShelves()

    // Update legs with new dimensions
    this.updateLegs()

    // Update doors with new dimensions
    this.updateDoors()

    // Update drawers with new dimensions
    this.updateDrawers()
  }

  public updateConfig(newConfig: Partial<CarcassConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Rebuild carcass with new configuration while preserving position
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateMaterial(newMaterial: CarcassMaterial): void {
    this.config.material = newMaterial

    // Rebuild carcass with new material while preserving position
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateMaterialProperties(
    materialChanges: Partial<CarcassMaterialData>
  ): void {
    // Update the material properties
    this.config.material.updateMaterial(materialChanges)

    // Rebuild carcass with updated material properties while preserving position
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateKickerHeight(kickerHeight: number): void {
    console.log("Updating kicker height to:", kickerHeight)

    // Update the leg height in the data file
    MaterialLoader.updateLegHeight(kickerHeight)

    // Update leg heights directly without rebuilding the entire carcass
    if (this.legs.length > 0) {
      this.legs.forEach((leg) => {
        leg.updateDimensions(
          kickerHeight,
          this.dimensions.width,
          this.dimensions.depth,
          this.getThickness()
        )
      })

      // Update the cabinet's Y position to account for the new leg height
      if (this.cabinetType === "base" || this.cabinetType === "tall") {
        this.group.position.y = kickerHeight
      }
    }

    console.log(
      "Kicker height updated, cabinet repositioned. X position preserved:",
      this.group.position.x
    )
  }

  // Static method to load material from data
  static loadMaterialFromData(materialId: string): CarcassMaterial | null {
    return MaterialLoader.loadMaterialById(materialId)
  }

  private updateShelves(): void {
    // Remove existing shelves
    this.removePartsFromGroup(this.shelves)
    this.shelves.forEach((shelf) => shelf.dispose())

    // Create new shelves with updated thickness
    this.createShelves()

    // Add new shelves to group
    this.addPartsToGroup(this.shelves)
  }

  private updateLegs(): void {
    // Only update legs for base and tall cabinets
    if (this.legs.length > 0) {
      const thickness = this.getThickness()
      console.log(`Updating ${this.legs.length} legs with new dimensions:`, {
        width: this.dimensions.width,
        depth: this.dimensions.depth,
        thickness: thickness,
      })

      this.legs.forEach((leg, index) => {
        console.log(`Updating leg ${index + 1} (${leg.position}) from:`, {
          width: leg.width,
          depth: leg.depth,
          thickness: leg.thickness,
        })

        leg.updateDimensions(
          leg.height, // Keep current leg height
          this.dimensions.width,
          this.dimensions.depth,
          thickness
        )

        console.log(`Leg ${index + 1} updated to:`, {
          width: leg.width,
          depth: leg.depth,
          thickness: leg.thickness,
          position: leg.group.position,
        })
      })
    }
  }

  private updateDoors(): void {
    // Only update doors if they are enabled
    if (this.config.doorEnabled && this.doors.length > 0) {
      const doorDepth = this.dimensions.depth
      const doorGap = categoriesData.doorSettings?.gap || 2
      const thickness = this.getThickness()

      // Calculate door dimensions using utility function
      const doorDimensions = calculateDoorDimensions(
        this.dimensions.width,
        this.dimensions.height,
        doorGap,
        this.config.doorCount || 1
      )

      // Update all doors with common dimensions
      this.doors.forEach((door) => {
        door.updateDimensions(
          doorDimensions.width,
          doorDimensions.height,
          doorDepth,
          thickness
        )
        door.updateCarcassWidth(this.dimensions.width)
      })
    }
  }

  public dispose(): void {
    // Dispose all parts
    this.leftEnd.dispose()
    this.rightEnd.dispose()
    this.back.dispose()
    this.bottom.dispose()
    this.top.dispose()

    this.shelves.forEach((shelf) => shelf.dispose())
    this.legs.forEach((leg) => leg.dispose())
    this.doors.forEach((door) => door.dispose())
    this.drawers.forEach((drawer) => drawer.dispose())

    // Clear the group
    this.group.clear()
  }

  // Door management methods
  public toggleDoors(enabled: boolean): void {
    this.config.doorEnabled = enabled

    if (enabled) {
      // Create doors if they don't exist
      if (this.doors.length === 0) {
        this.createDoors()
        this.addPartsToGroup(this.doors)
      }
    } else {
      // Remove doors from group and dispose them
      this.removePartsFromGroup(this.doors)
      this.doors.forEach((door) => door.dispose())
      this.doors = []
    }
  }

  public updateDoorConfiguration(
    doorCount: number,
    doorMaterial?: DoorMaterial
  ): void {
    this.config.doorCount = doorCount
    if (doorMaterial) {
      this.config.doorMaterial = doorMaterial
    }

    // Rebuild doors if they are enabled
    if (this.config.doorEnabled) {
      // Remove existing doors
      this.removePartsFromGroup(this.doors)
      this.doors.forEach((door) => door.dispose())
      this.doors = []

      // Create new doors with current dimensions
      this.createDoors()
      this.addPartsToGroup(this.doors)
    }
  }

  public updateOverhangDoor(overhang: boolean): void {
    // Only allow overhang for Top cabinets
    if (this.cabinetType !== "top") {
      console.log(
        "Overhang door setting ignored for non-Top cabinet type:",
        this.cabinetType
      )
      return
    }

    console.log(
      `Updating overhang door setting for ${this.cabinetType} cabinet:`,
      overhang
    )
    this.config.overhangDoor = overhang

    // Update existing doors with new overhang setting
    if (this.config.doorEnabled && this.doors.length > 0) {
      this.doors.forEach((door) => {
        door.updateOverhang(overhang)
      })
    }
  }

  public updateDoorMaterial(doorMaterial: DoorMaterial): void {
    this.config.doorMaterial = doorMaterial

    // Update existing doors
    this.doors.forEach((door) => {
      door.updateMaterial(doorMaterial)
    })
  }

  // Drawer management methods
  public updateDrawerEnabled(enabled: boolean): void {
    console.log(
      `Updating drawer enabled setting for ${this.cabinetType} cabinet:`,
      enabled
    )
    this.config.drawerEnabled = enabled

    if (enabled) {
      // Create drawers if they don't exist
      if (this.drawers.length === 0) {
        this.createDrawers()
        // Add drawers to the main group
        this.addPartsToGroup(this.drawers)
      }
    } else {
      // Remove drawers from the main group and dispose them
      this.removePartsFromGroup(this.drawers)
      this.drawers.forEach((drawer) => drawer.dispose())
      this.drawers = []
    }
  }

  public updateDrawerQuantity(quantity: number): void {
    console.log(
      `Updating drawer quantity for ${this.cabinetType} cabinet:`,
      quantity
    )

    // Store existing drawer heights to preserve user input
    const existingHeights = [...(this.config.drawerHeights || [])]

    this.config.drawerQuantity = quantity

    // Calculate new drawer heights ensuring they fit within carcass height
    if (quantity > 0) {
      // Calculate default equal distribution using utility function
      const defaultHeight = roundToDecimal(this.dimensions.height / quantity)
      let newDrawerHeights: number[] = []

      if (existingHeights.length > 0 && quantity >= existingHeights.length) {
        // If increasing quantity, keep existing heights and add new ones
        newDrawerHeights = [...existingHeights]
        // Add default heights for new drawers
        for (let i = existingHeights.length; i < quantity; i++) {
          newDrawerHeights.push(defaultHeight)
        }
      } else if (
        existingHeights.length > 0 &&
        quantity < existingHeights.length
      ) {
        // If decreasing quantity, keep only the first N heights
        newDrawerHeights = existingHeights.slice(0, quantity)
      } else {
        // If no existing heights or quantity is 0, create default heights using utility function
        newDrawerHeights = distributeHeightEqually(
          this.dimensions.height,
          quantity
        )
      }

      // Ensure total height doesn't exceed carcass height using utility function
      const totalHeightValidation = validateTotalHeight(
        newDrawerHeights,
        this.dimensions.height
      )
      if (!totalHeightValidation.isValid) {
        // Redistribute equally to fit within carcass height using utility function
        newDrawerHeights = distributeHeightEqually(
          this.dimensions.height,
          quantity
        )
        console.log(
          `Total drawer height exceeded carcass height. Redistributed to ${newDrawerHeights[0]}mm each.`
        )
      }

      this.config.drawerHeights = newDrawerHeights

      // Validate the final result
      const validation = this.validateDrawerHeights()
      if (!validation.isValid) {
        console.warn(
          `Drawer heights still exceed carcass height after quantity change. Auto-balancing.`
        )
        this.balanceDrawerHeights()
      }
    } else {
      // If quantity is 0, clear drawer heights
      this.config.drawerHeights = []
    }

    // Remove existing drawers
    this.removePartsFromGroup(this.drawers)
    this.drawers.forEach((drawer) => drawer.dispose())
    this.drawers = []

    // Create new drawers with the new quantity
    if (this.config.drawerEnabled) {
      this.createDrawers()
      // Add drawers to the main group
      this.addPartsToGroup(this.drawers)

      // Ensure all drawer heights are properly set and distributed
      this.updateDrawerPositions()
    }
  }

  public updateDrawerHeight(index: number, height: number): void {
    console.log(
      `Updating drawer ${index} height for ${this.cabinetType} cabinet:`,
      height
    )

    // Ensure proper decimal handling using utility function
    height = roundToDecimal(height)

    // Validate the height value using utility function
    const minHeight = 50 // Minimum drawer height
    const maxHeight = this.dimensions.height // Maximum drawer height
    height = clamp(height, minHeight, maxHeight)

    if (height === minHeight) {
      console.warn(`Drawer height clamped to minimum ${minHeight}mm.`)
    } else if (height === maxHeight) {
      console.warn(`Drawer height clamped to maximum ${maxHeight}mm.`)
    }

    // Update the drawer height in the config
    if (!this.config.drawerHeights) {
      this.config.drawerHeights = []
    }
    this.config.drawerHeights[index] = height

    // Calculate height balance and redistribute among unchanged drawers
    this.redistributeDrawerHeights(index)

    // Validate final result and auto-balance if needed
    const validation = this.validateDrawerHeights()
    if (!validation.isValid) {
      console.warn(
        `Drawer heights still exceed carcass height after redistribution. Auto-balancing.`
      )
      this.balanceDrawerHeights()
    }

    // Update all drawer positions to account for height changes
    this.updateDrawerPositions()
  }

  /**
   * Get current drawer heights for UI display
   */
  public getDrawerHeights(): number[] {
    if (!this.config.drawerHeights || this.config.drawerHeights.length === 0) {
      // Return default heights if none are set using utility function
      return distributeHeightEqually(
        this.dimensions.height,
        this.config.drawerQuantity || 1
      )
    }
    return [...this.config.drawerHeights]
  }

  /**
   * Get total drawer height for validation
   */
  public getTotalDrawerHeight(): number {
    const heights = this.getDrawerHeights()
    return heights.reduce((sum, height) => sum + height, 0)
  }

  /**
   * Validate that drawer heights fit within carcass height
   */
  public validateDrawerHeights(): {
    isValid: boolean
    totalHeight: number
    remainingHeight: number
  } {
    // Use utility function for validation
    return validateTotalHeight(this.getDrawerHeights(), this.dimensions.height)
  }

  /**
   * Redistribute remaining height among unchanged drawers
   * @param changedIndex - Index of the drawer that was just changed
   */
  private redistributeDrawerHeights(changedIndex: number): void {
    if (!this.config.drawerHeights || this.config.drawerHeights.length === 0)
      return

    const totalCarcassHeight = this.dimensions.height
    const totalDrawerQuantity = this.config.drawerQuantity || 1

    // Calculate total height of all explicitly set drawer heights
    let totalExplicitHeight = 0
    let unchangedDrawerCount = 0

    for (let i = 0; i < totalDrawerQuantity; i++) {
      if (this.config.drawerHeights[i] && i !== changedIndex) {
        totalExplicitHeight += this.config.drawerHeights[i]
      } else if (i !== changedIndex) {
        unchangedDrawerCount++
      }
    }

    // Add the height of the changed drawer
    totalExplicitHeight += this.config.drawerHeights[changedIndex] || 0

    // Calculate remaining height to distribute
    const remainingHeight = totalCarcassHeight - totalExplicitHeight

    if (remainingHeight > 0 && unchangedDrawerCount > 0) {
      // Find indices of unchanged drawers (not changedIndex and not explicitly set)
      const unchangedIndices: number[] = []
      for (let i = 0; i < totalDrawerQuantity; i++) {
        if (i !== changedIndex && !this.config.drawerHeights[i]) {
          unchangedIndices.push(i)
        }
      }

      // Use utility function to redistribute remaining height among unchanged drawers
      this.config.drawerHeights = redistributeRemainingHeight(
        this.config.drawerHeights,
        unchangedIndices,
        remainingHeight
      )

      const heightPerDrawer = this.config.drawerHeights[unchangedIndices[0]]
      console.log(
        `Redistributed ${roundToDecimal(
          remainingHeight
        )}mm among ${unchangedDrawerCount} unchanged drawers: ${heightPerDrawer}mm each`
      )
    } else if (remainingHeight < 0) {
      console.warn(
        `Total drawer height (${roundToDecimal(
          totalExplicitHeight
        )}mm) exceeds carcass height (${totalCarcassHeight}mm)`
      )

      // If total exceeds carcass height, we need to adjust the changed drawer height
      const excessHeight = Math.abs(remainingHeight)
      const adjustedHeight = roundToDecimal(
        this.config.drawerHeights[changedIndex] - excessHeight
      )

      // Ensure the adjusted height is at least 50mm (minimum drawer height)
      if (adjustedHeight >= 50) {
        this.config.drawerHeights[changedIndex] = adjustedHeight
        console.log(
          `Adjusted drawer ${changedIndex} height to ${adjustedHeight}mm to fit within carcass height`
        )

        // Now redistribute the remaining height
        this.redistributeDrawerHeights(changedIndex)
      } else {
        // If we can't reduce enough, reset to default distribution
        console.warn(
          `Cannot reduce drawer height enough. Resetting to default distribution.`
        )
        this.resetDrawerHeightsToDefault()
      }
    }

    // Ensure all drawer heights are properly set (fill any undefined values)
    for (let i = 0; i < totalDrawerQuantity; i++) {
      if (!this.config.drawerHeights[i]) {
        // Calculate remaining height for this drawer
        const usedHeight = this.config.drawerHeights.reduce(
          (sum, height, idx) => sum + (idx !== i ? height || 0 : 0),
          0
        )
        const remainingForThisDrawer = totalCarcassHeight - usedHeight

        if (remainingForThisDrawer >= 50) {
          // Minimum drawer height
          this.config.drawerHeights[i] = roundToDecimal(remainingForThisDrawer)
        } else {
          // If not enough height, set to minimum and redistribute
          this.config.drawerHeights[i] = 50
          this.redistributeDrawerHeights(i)
        }
      }
    }
  }

  /**
   * Reset drawer heights to default equal distribution
   */
  private resetDrawerHeightsToDefault(): void {
    if (!this.config.drawerQuantity) return

    // Use utility function to distribute heights equally
    this.config.drawerHeights = distributeHeightEqually(
      this.dimensions.height,
      this.config.drawerQuantity
    )

    console.log(
      `Reset drawer heights to default: ${this.config.drawerHeights[0]}mm each`
    )
  }

  /**
   * Automatically balance drawer heights to fit within carcass height
   */
  public balanceDrawerHeights(): void {
    if (!this.config.drawerQuantity || this.config.drawerQuantity <= 0) return

    const totalHeight = this.getTotalDrawerHeight()

    if (totalHeight > this.dimensions.height) {
      console.log(
        `Balancing drawer heights. Total: ${totalHeight}mm, Carcass: ${this.dimensions.height}mm`
      )

      // Reset to equal distribution
      this.resetDrawerHeightsToDefault()

      // Update drawer positions
      this.updateDrawerPositions()

      console.log("Drawer heights balanced and reset to equal distribution")
    }
  }

  /**
   * Get optimal drawer height distribution that fits within carcass height
   */
  public getOptimalDrawerHeights(): number[] {
    if (!this.config.drawerQuantity || this.config.drawerQuantity <= 0) {
      return []
    }

    // Use utility function to distribute heights equally
    return distributeHeightEqually(
      this.dimensions.height,
      this.config.drawerQuantity
    )
  }

  private updateDrawerPositions(): void {
    if (!this.config.drawerEnabled || this.drawers.length === 0) return

    // Get all drawer heights (use config heights if available, otherwise calculate defaults)
    const allDrawerHeights = this.drawers.map(
      (drawer, index) =>
        this.config.drawerHeights?.[index] ||
        roundToDecimal(
          this.dimensions.height / (this.config.drawerQuantity || 1)
        )
    )

    // Update each drawer's dimensions and position
    this.drawers.forEach((drawer, index) => {
      const drawerHeight = allDrawerHeights[index]

      // Always update drawer dimensions to ensure consistency
      const endPanelThickness = this.config.material.getPanelThickness()
      const drawerWidth = this.dimensions.width - endPanelThickness * 2

      drawer.updateDimensions(drawerWidth, drawerHeight, this.dimensions.depth)

      // Update position with all drawer heights for accurate positioning
      drawer.updatePositionWithAllHeights(allDrawerHeights)
    })
  }

  private updateDrawers(): void {
    if (this.config.drawerEnabled && this.drawers.length > 0) {
      // Calculate drawer width using utility function
      const endPanelThickness = this.config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(
        this.dimensions.width,
        endPanelThickness
      )
      const drawerDepth = this.dimensions.depth

      // Check if we need to recalculate drawer heights due to cabinet height change
      if (this.config.drawerHeights && this.config.drawerHeights.length > 0) {
        const drawerHeights = this.config.drawerHeights
        const totalCurrentHeight = drawerHeights.reduce(
          (sum, height) => sum + height,
          0
        )
        const heightRatio = calculateRatio(
          this.dimensions.height,
          totalCurrentHeight
        )

        // If the ratio is significantly different (more than 1% change), recalculate proportionally
        if (!approximatelyEqual(heightRatio, 1, 0.01)) {
          console.log(
            `Cabinet height changed. Recalculating drawer heights proportionally. Ratio: ${heightRatio}`
          )

          // Recalculate drawer heights proportionally using utility function
          this.config.drawerHeights = scaleHeightsProportionally(
            drawerHeights,
            this.dimensions.height
          )

          // Ensure the total doesn't exceed the new cabinet height using utility function
          const validation = validateTotalHeight(
            this.config.drawerHeights,
            this.dimensions.height
          )
          if (!validation.isValid) {
            // If still too tall, reset to equal distribution using utility function
            const quantity =
              this.config.drawerQuantity ?? this.drawers.length ?? 1
            this.config.drawerHeights = distributeHeightEqually(
              this.dimensions.height,
              quantity
            )
            console.log(
              `Total drawer height still exceeds cabinet height after proportional adjustment. Reset to equal distribution: ${this.config.drawerHeights[0]}mm each.`
            )
          }
        }
      }

      // Update each drawer with new dimensions
      this.drawers.forEach((drawer, index) => {
        const drawerHeight =
          this.config.drawerHeights?.[index] ||
          roundToDecimal(
            this.dimensions.height / (this.config.drawerQuantity || 1)
          )
        drawer.updateDimensions(drawerWidth, drawerHeight, drawerDepth)
        drawer.updateCarcassHeight(this.dimensions.height)
      })

      // Update drawer positions after dimension changes
      this.updateDrawerPositions()
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Get material thickness - centralized getter
   */
  private getThickness(): number {
    return this.config.material.getThickness()
  }

  /**
   * Calculate common panel dimensions used throughout the class
   * @returns Object containing panelWidth and effectiveDepth
   */
  private calculateCommonPanelDimensions(): {
    panelWidth: number
    effectiveDepth: number
  } {
    const panelWidth = calculatePanelWidth(
      this.dimensions.width,
      this.getThickness()
    )
    const effectiveDepth = calculateEffectiveDepth(
      this.dimensions.depth,
      this.getThickness()
    )
    return { panelWidth, effectiveDepth }
  }

  /**
   * Execute a callback while preserving the group's position
   * Useful for rebuild operations that need to maintain position
   */
  private withPreservedPosition(callback: () => void): void {
    const { x, y, z } = this.group.position
    callback()
    this.group.position.set(x, y, z)
  }

  /**
   * Add part(s) to the main group
   * @param parts Single part or array of parts with 'group' property
   */
  private addPartsToGroup(
    parts: Array<{ group: THREE.Group }> | { group: THREE.Group }
  ): void {
    const partsArray = Array.isArray(parts) ? parts : [parts]
    partsArray.forEach((part) => {
      this.group.add(part.group)
    })
  }

  /**
   * Remove part(s) from the main group
   * @param parts Single part or array of parts with 'group' property
   */
  private removePartsFromGroup(
    parts: Array<{ group: THREE.Group }> | { group: THREE.Group }
  ): void {
    const partsArray = Array.isArray(parts) ? parts : [parts]
    partsArray.forEach((part) => {
      this.group.remove(part.group)
    })
  }

  // ========== Static Factory Methods ==========

  static createTopCabinet(
    dimensions: CarcassDimensions,
    config?: Partial<CarcassConfig>
  ): CarcassAssembly {
    return new CarcassAssembly("top", dimensions, config)
  }

  static createBaseCabinet(
    dimensions: CarcassDimensions,
    config?: Partial<CarcassConfig>
  ): CarcassAssembly {
    return new CarcassAssembly("base", dimensions, config)
  }

  static createTallCabinet(
    dimensions: CarcassDimensions,
    config?: Partial<CarcassConfig>
  ): CarcassAssembly {
    return new CarcassAssembly("tall", dimensions, config)
  }
}
