import * as THREE from "three"
import { CarcassEnd } from "./parts/CarcassEnd"
import { CarcassBack } from "./parts/CarcassBack"
import { CarcassBottom } from "./parts/CarcassBottom"
import { CarcassShelf } from "./parts/CarcassShelf"
import { CarcassTop } from "./parts/CarcassTop"
import { CarcassLeg } from "./parts/CarcassLeg"
import { CarcassDoor } from "./parts/CarcassDoor"
import { CarcassDrawer } from "./parts/CarcassDrawer"
import { CarcassPanel } from "./parts/CarcassPanel"
import { CarcassFront } from "./parts/CarcassFront"
import { DrawerHeightManager } from "./parts/DrawerHeightManager"
import { CarcassMaterial, CarcassMaterialData } from "./Material"
import { DoorMaterial } from "./DoorMaterial"
import { MaterialLoader } from "./MaterialLoader"
// import { categoriesData } from "../../components/categoriesData"
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
  redistributeRemainingHeight,
  clamp,
  approximatelyEqual,
  calculateRatio,
} from "./utils/carcass-math-utils"
import { getClient } from "@/app/QueryProvider"
import { WsProduct } from "@/types/erpTypes"
import _, { entries } from "lodash"
import { getProductData } from "@/server/getProductData"
import { toNum } from "../cabinets/ui/ProductPanel"
import { CabinetType } from "../scene/types"

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
  fillerType?: "linear" | "l-shape" // For filler cabinets: linear or L-shaped
  fillerReturnPosition?: "left" | "right" // For L-shape filler: position of return panel
  // Wardrobe-specific options
  wardrobeDrawerHeight?: number // Fixed drawer height for wardrobe (default 220mm)
  wardrobeDrawerBuffer?: number // Buffer space between drawers and shelves (default 50mm)
}

export { type CabinetType } from "../scene/types"

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

  // Panel and filler specific parts
  private panel?: CarcassPanel // For panel type cabinet
  private frontPanel?: CarcassFront // For filler type cabinet (main panel)
  private fillerReturn?: CarcassPanel // For L-shape filler (return panel)

  public productId!: string
  public cabinetId!: string
  public defaultDimValuesApplied: boolean = false

  constructor(
    cabinetType: CabinetType,
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ) {
    this.cabinetType = cabinetType
    this.dimensions = dimensions

    this.productId = productId
    this.cabinetId = cabinetId

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
      // Wardrobe-specific defaults
      wardrobeDrawerHeight: config?.wardrobeDrawerHeight || 220, // Fixed 220mm drawer height for wardrobe
      wardrobeDrawerBuffer: config?.wardrobeDrawerBuffer || 50, // 50mm buffer between drawers and shelves
      ...config,
    }

    // Create main group
    this.group = new THREE.Group()
    this.group.name = `${cabinetType}_carcass`

    // Build the carcass based on type
    this.buildCarcass()
  }

  private buildCarcass(): void {
    // Handle panel and filler types differently
    if (this.cabinetType === "panel") {
      this.buildPanelCabinet()
      return
    }

    if (this.cabinetType === "filler") {
      this.buildFillerCabinet()
      return
    }

    // Create all carcass parts for traditional cabinet types (base, top, tall, wardrobe)
    this.createEndPanels()
    this.createBackPanel()
    this.createBottomPanel()
    this.createTopPanel()
    this.createShelves()
    this.createLegs()

    // For wardrobe, create drawers at the bottom with fixed heights
    if (this.cabinetType === "wardrobe") {
      this.createWardrobeDrawers()
    } else {
      this.createDrawers()
    }

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

  /**
   * Build a panel cabinet - just a single decorative side panel
   * Cabinet width = panel thickness, height = panel height, depth = panel width
   */
  private buildPanelCabinet(): void {
    // For panel cabinet:
    // dimensions.width = panel thickness (X axis)
    // dimensions.height = panel height (Y axis)
    // dimensions.depth = panel face width (Z axis)
    this.panel = new CarcassPanel({
      height: this.dimensions.height,
      panelWidth: this.dimensions.depth, // depth of cabinet = width of panel face
      thickness: this.dimensions.width, // width of cabinet = thickness of panel
      material: this.config.material.getMaterial(),
    })

    this.group.add(this.panel.group)

    // Position panel cabinet (no legs for panel type)
    this.group.position.set(0, 0, 0)
  }

  /**
   * Build a filler cabinet - linear or L-shape filler
   *
   * Linear Filler: Same structure as panel type (CarcassPanel, YZ plane)
   * - dimensions.width = panel thickness (16mm, X axis)
   * - dimensions.height = panel height (Y axis)
   * - dimensions.depth = panel face width (100mm default, Z axis)
   *
   * L-Shape Filler: Front panel + return panel
   * - dimensions.width = face panel width (the gap to fill, X axis)
   * - dimensions.height = panel height (Y axis)
   * - dimensions.depth = ignored (return is always 40mm total depth)
   *
   * Both types positioned at z=400mm temporarily
   */
  private buildFillerCabinet(): void {
    const thickness = this.getThickness()
    const isLShape = this.config.fillerType === "l-shape"
    const fillerZPosition = 400 // Temporary fixed position until linking logic is added

    if (isLShape) {
      // L-Shape Filler:
      // - Face panel: CarcassFront (XY plane), positioned at z=0 in local coords
      // - Return panel: CarcassPanel (YZ plane), positioned behind face panel
      // - Return length = 40mm - thickness (so face thickness + return = 40mm)

      const returnLength = 40 - thickness // e.g., 40 - 16 = 24mm
      const returnPosition = this.config.fillerReturnPosition || "left"

      // Main face panel - back at z=0 in local coords
      this.frontPanel = new CarcassFront({
        width: this.dimensions.width,
        height: this.dimensions.height,
        thickness: thickness,
        material: this.config.material.getMaterial(),
        zPosition: 0, // Back of face panel at z=0 in local coords
      })
      this.group.add(this.frontPanel.group)

      // Return panel - positioned behind the face panel (negative z direction)
      // CarcassPanel has its back at z=0 and front at z=panelWidth
      // We want the return's front edge to meet the face panel's back (z=0)
      // So return's center.z = 0 - panelWidth/2 = -returnLength/2
      this.fillerReturn = new CarcassPanel({
        height: this.dimensions.height,
        panelWidth: returnLength, // 40mm - thickness
        thickness: thickness,
        material: this.config.material.getMaterial(),
      })

      // Override the default position to place return behind the face
      // CarcassPanel puts center at (thickness/2, height/2, panelWidth/2)
      // We need center.z = -returnLength/2 so front edge is at z=0
      this.fillerReturn.group.position.z = -returnLength / 2

      // Position return at left or right edge
      if (returnPosition === "right") {
        // Right edge: x = width - thickness
        this.fillerReturn.group.position.x =
          this.dimensions.width - thickness / 2
      }
      // For left position, default x = thickness/2 is correct

      this.group.add(this.fillerReturn.group)
    } else {
      // Linear Filler: Same structure as panel type (CarcassPanel, YZ plane)
      // Uses same dimension mapping as panel cabinet:
      // - dimensions.width = panel thickness (X axis, typically 16mm)
      // - dimensions.depth = panel face width (Z axis, typically 100mm for filler)
      this.panel = new CarcassPanel({
        height: this.dimensions.height,
        panelWidth: this.dimensions.depth, // depth of cabinet = width of panel face
        thickness: this.dimensions.width, // width of cabinet = thickness of panel
        material: this.config.material.getMaterial(),
      })
      this.group.add(this.panel.group)
    }

    // Position entire filler assembly at z=400mm
    this.group.position.set(0, 0, fillerZPosition)
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
    const { panelWidth, effectiveDepth: _effectiveDepth } =
      this.calculateCommonPanelDimensions()

    // Get Base Rail depth from data using MaterialLoader (only for traditional cabinet types)
    const traditionalType = this.cabinetType as "top" | "base" | "tall"
    const baseRailDepth = MaterialLoader.getBaseRailDepth(traditionalType)

    // Determine if this is a Drawer Base cabinet
    const isDrawerBase =
      this.cabinetType === "base" && this.config.drawerEnabled

    this.top = new CarcassTop({
      // depth: effectiveDepth,
      depth: this.dimensions.depth,
      width: panelWidth,
      thickness: this.getThickness(),
      height: this.dimensions.height,
      leftEndThickness: this.getThickness(),
      backThickness: this.getThickness(),
      material: this.config.material.getMaterial(),
      cabinetType: traditionalType,
      baseRailDepth: baseRailDepth,
      isDrawerBase: isDrawerBase,
    })
  }

  private createShelves(): void {
    this.shelves = []

    if (this.config.shelfCount > 0) {
      const thickness = this.getThickness()

      // Calculate start height based on cabinet type
      let startHeight: number
      if (this.cabinetType === "wardrobe") {
        // For wardrobe: start above the drawers + buffer
        const drawerQuantity = this.config.drawerQuantity || 0
        const drawerHeight = this.config.wardrobeDrawerHeight || 220
        const buffer = this.config.wardrobeDrawerBuffer || 50
        const totalDrawerHeight = drawerQuantity * drawerHeight
        startHeight = totalDrawerHeight + buffer + thickness
      } else {
        // Default: start above bottom panel
        startHeight = thickness + 100
      }

      const endHeight = this.dimensions.height - thickness - 100 // End below top panel

      // Calculate shelf positions using utility function
      const shelfPositions = calculateShelfPositions(
        startHeight,
        endHeight,
        this.config.shelfCount,
        this.config.shelfSpacing
      )

      // Calculate panel dimensions
      const { panelWidth, effectiveDepth } =
        this.calculateCommonPanelDimensions()

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

    // Only create legs for base, tall, and wardrobe cabinets
    if (
      this.cabinetType === "base" ||
      this.cabinetType === "tall" ||
      this.cabinetType === "wardrobe"
    ) {
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

  /**
   * Create wardrobe drawers - positioned at the bottom with fixed height
   * Drawers are created from bottom to top with positionFromBottom=true
   */
  private createWardrobeDrawers(): void {
    this.drawers = []

    const drawerQuantity = this.config.drawerQuantity || 0

    // Only create drawers if quantity > 0
    if (drawerQuantity > 0) {
      // Calculate drawer width using utility function
      const endPanelThickness = this.config.material.getPanelThickness()
      const drawerWidth = calculateDrawerWidth(
        this.dimensions.width,
        endPanelThickness
      )

      // Fixed drawer height for wardrobe
      const drawerHeight = this.config.wardrobeDrawerHeight || 220

      // Set up drawer heights (all fixed at wardrobeDrawerHeight)
      const drawerHeights = Array(drawerQuantity).fill(drawerHeight)
      this.config.drawerHeights = [...drawerHeights]

      // Create drawer fronts positioned from bottom
      for (let i = 0; i < drawerQuantity; i++) {
        const drawer = new CarcassDrawer({
          width: drawerWidth,
          height: drawerHeight,
          depth: this.dimensions.depth,
          material: this.config.material,
          position: i,
          totalDrawers: drawerQuantity,
          carcassHeight: this.dimensions.height,
          positionFromBottom: true, // Position from bottom for wardrobe
        })
        this.drawers.push(drawer)
      }

      // Update positions after creating all drawers
      this.updateWardrobeDrawerPositions()
    }
  }

  /**
   * Update wardrobe drawer positions - all drawers have same fixed height
   * Also updates drawer dimensions to ensure consistency
   */
  private updateWardrobeDrawerPositions(): void {
    if (this.drawers.length === 0) return

    const drawerHeight = this.config.wardrobeDrawerHeight || 220
    const allDrawerHeights = this.drawers.map(() => drawerHeight)

    // Calculate drawer width
    const endPanelThickness = this.config.material.getPanelThickness()
    const drawerWidth = calculateDrawerWidth(
      this.dimensions.width,
      endPanelThickness
    )

    this.drawers.forEach((drawer) => {
      // Update dimensions with fixed wardrobe drawer height
      drawer.updateDimensions(drawerWidth, drawerHeight, this.dimensions.depth)
      // Update position (drawer already has positionFromBottom=true)
      drawer.updatePositionWithAllHeights(allDrawerHeights)
    })
  }

  private createDoors(): void {
    this.doors = []

    // Only create doors if they are enabled
    if (this.config.doorEnabled) {
      const doorDepth = this.dimensions.depth

      // Get door gap from data.js
      // const doorGap = categoriesData.doorSettings?.gap || 2
      const doorGap = 2

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

    // Handle panel and filler types differently
    if (this.cabinetType === "panel") {
      this.updatePanelDimensions()
      return
    }

    if (this.cabinetType === "filler") {
      this.updateFillerDimensions()
      return
    }

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
      // effectiveDepth,
      this.dimensions.depth,
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

    // Update kicker face if it exists
    this.updateKickerFace()
  }

  /**
   * Update dimensions for panel cabinet
   */
  private updatePanelDimensions(): void {
    if (this.panel) {
      this.panel.updateDimensions(
        this.dimensions.height,
        this.dimensions.depth, // depth of cabinet = width of panel face
        this.dimensions.width // width of cabinet = thickness of panel
      )
    }
  }

  /**
   * Update dimensions for filler cabinet
   */
  private updateFillerDimensions(): void {
    const thickness = this.getThickness()
    const isLShape = this.config.fillerType === "l-shape"

    if (isLShape) {
      // L-Shape filler: update frontPanel and fillerReturn
      if (this.frontPanel) {
        this.frontPanel.updateDimensions(
          this.dimensions.width,
          this.dimensions.height,
          thickness
        )
      }

      if (this.fillerReturn) {
        const returnLength = 40 - thickness // Return length = 40mm - face thickness
        this.fillerReturn.updateDimensions(
          this.dimensions.height,
          returnLength,
          thickness
        )

        // Position return behind the face panel
        this.fillerReturn.group.position.z = -returnLength / 2

        // Update x position based on return position
        const returnPosition = this.config.fillerReturnPosition || "left"
        if (returnPosition === "right") {
          this.fillerReturn.group.position.x =
            this.dimensions.width - thickness / 2
        } else {
          this.fillerReturn.group.position.x = thickness / 2
        }
      }
    } else {
      // Linear filler: update panel (same as panel cabinet)
      if (this.panel) {
        this.panel.updateDimensions(
          this.dimensions.height,
          this.dimensions.depth, // panel face width
          this.dimensions.width // panel thickness (filler width)
        )
      }
    }
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
      if (
        this.cabinetType === "base" ||
        this.cabinetType === "tall" ||
        this.cabinetType === "wardrobe"
      ) {
        this.group.position.y = kickerHeight
      }
    }

    // Update kicker face if it exists
    this.updateKickerFace()
  }

  /**
   * Updates the kicker face geometry if it exists for this cabinet.
   * Called automatically when dimensions or kicker height change.
   */
  private updateKickerFace(): void {
    // Only update kicker faces for base and tall cabinets
    if (this.cabinetType !== "base" && this.cabinetType !== "tall") {
      return
    }

    // Check if kicker face exists for this cabinet
    const kickerFaceGroup = this.group.children.find(
      (child) => child.name === `kickerFace_${this.cabinetId}`
    )

    if (kickerFaceGroup) {
      // Get kicker face reference
      const kickerFace = (this.group as any).kickerFace
      if (kickerFace && typeof kickerFace.updateDimensions === "function") {
        // Get kicker height from cabinet's Y position (Y position = kicker height)
        // Kicker height is always >= 0 (cannot go negative)
        const kickerHeight = Math.max(0, this.group.position.y)

        // Update kicker face dimensions
        kickerFace.updateDimensions(
          this.dimensions.width,
          kickerHeight,
          this.dimensions.depth
        )
      }
    }
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

      this.legs.forEach((leg) => {
        leg.updateDimensions(
          leg.height, // Keep current leg height
          this.dimensions.width,
          this.dimensions.depth,
          thickness
        )
      })
    }
  }

  private updateDoors(): void {
    // Only update doors if they are enabled
    if (this.config.doorEnabled && this.doors.length > 0) {
      const doorDepth = this.dimensions.depth
      const doorGap = 2
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
    // Dispose panel and filler specific parts
    if (this.panel) {
      this.panel.dispose()
      this.panel = undefined
    }
    if (this.frontPanel) {
      this.frontPanel.dispose()
      this.frontPanel = undefined
    }
    if (this.fillerReturn) {
      this.fillerReturn.dispose()
      this.fillerReturn = undefined
    }

    // Dispose traditional carcass parts (only if they exist)
    if (this.leftEnd) this.leftEnd.dispose()
    if (this.rightEnd) this.rightEnd.dispose()
    if (this.back) this.back.dispose()
    if (this.bottom) this.bottom.dispose()
    if (this.top) this.top.dispose()

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
      return
    }

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
    // Store existing drawer heights to preserve user input
    const existingHeights = [...(this.config.drawerHeights || [])]

    this.config.drawerQuantity = quantity

    // Handle wardrobe cabinets differently - fixed drawer heights
    if (this.cabinetType === "wardrobe") {
      const fixedHeight = this.config.wardrobeDrawerHeight || 220
      this.config.drawerHeights = Array(quantity).fill(fixedHeight)

      // Remove existing drawers
      this.removePartsFromGroup(this.drawers)
      this.drawers.forEach((drawer) => drawer.dispose())
      this.drawers = []

      // Create new wardrobe drawers
      if (this.config.drawerEnabled && quantity > 0) {
        this.createWardrobeDrawers()
        this.addPartsToGroup(this.drawers)
      }

      // Update shelves to account for new drawer space
      this.updateShelves()
      return
    }

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

  public updateDrawerHeight(
    index: number,
    height: number,
    changedId?: string
  ): void {
    const productData = getClient().getQueryData([
      "productData",
      this.productId,
    ]) as Awaited<ReturnType<typeof getProductData>> | undefined
    if (!productData) {
      throw new Error("Product data not found for drawer height update.")
    }

    const { product: wsProduct, threeJsGDs } = productData

    const drawerHeightGDMap: Record<number, string[]> = {
      0: threeJsGDs?.drawerH1 || [],
      1: threeJsGDs?.drawerH2 || [],
      2: threeJsGDs?.drawerH3 || [],
      3: threeJsGDs?.drawerH4 || [],
      4: threeJsGDs?.drawerH5 || [],
    }

    const drawerHeightsConfig: Record<
      number,
      {
        defaultValue: number
        min: number
        max: number
        dimId: string
      }
    > = {}

    const dimsList = _.sortBy(
      Object.entries(wsProduct?.dims || {}),
      ([, dimObj]) => Number(dimObj.sortNum)
    )

    dimsList.forEach(([dimId, dimObj]) => {
      const gdId = dimObj.GDId
      if (!gdId) return

      const { defaultValue: v, min, max } = dimObj
      if (!min || !max) return

      Object.entries(drawerHeightGDMap).forEach(([drawerIndexStr, gdList]) => {
        const drawerIndex = Number(drawerIndexStr)
        if (gdList.includes(gdId)) {
          const numVal = toNum(v)

          if (!isNaN(numVal))
            drawerHeightsConfig[drawerIndex] = {
              defaultValue: numVal,
              min,
              max,
              dimId,
            }
        }
      })
    })

    // Ensure proper decimal handling using utility function
    height = roundToDecimal(height)

    // Validate the height value using utility function
    // const minHeight = 50 // Minimum drawer height
    const minHeight = drawerHeightsConfig[index]?.min || 50 // Minimum drawer height
    const maxHeight = drawerHeightsConfig[index]?.max || this.dimensions.height // Maximum drawer height
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
    this.redistributeDrawerHeights(index, drawerHeightsConfig, changedId)

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
  private redistributeDrawerHeights(
    changedIndex: number,
    drawerHeightsConfig?: Record<
      number,
      {
        defaultValue: number
        min: number
        max: number
        dimId: string
      }
    >,
    changedId?: string
  ): void {
    if (!this.config.drawerHeights || this.config.drawerHeights.length === 0)
      return

    const totalCarcassHeight = this.dimensions.height
    const totalDrawerQuantity = this.config.drawerQuantity
    if (!totalDrawerQuantity) throw new Error("Drawer quantity is not defined.")

    // Calculate current total height of all drawers
    const currentTotalHeight = this.config.drawerHeights.reduce(
      (sum, h) => sum + h,
      0
    )

    // Calculate difference from carcass height
    const diff = currentTotalHeight - totalCarcassHeight

    if (Math.abs(diff) < 0.1) return // No significant difference

    // Identify last drawer
    const lastDrawerIndex = totalDrawerQuantity - 1

    if (changedIndex === lastDrawerIndex) {
      console.warn(
        "Attempted to modify last drawer manually. This should be prevented by UI."
      )
      return
    }

    // Adjust last drawer
    const currentLastDrawerHeight = this.config.drawerHeights[lastDrawerIndex]
    let newLastDrawerHeight = currentLastDrawerHeight - diff

    // Check constraints for last drawer if config is available
    if (drawerHeightsConfig && drawerHeightsConfig[lastDrawerIndex]) {
      const { min, max } = drawerHeightsConfig[lastDrawerIndex]
      const safeMin = min || 50
      const safeMax = max || totalCarcassHeight
      newLastDrawerHeight = clamp(newLastDrawerHeight, safeMin, safeMax)
    } else {
      newLastDrawerHeight = Math.max(50, newLastDrawerHeight)
    }

    this.config.drawerHeights[lastDrawerIndex] = newLastDrawerHeight

    // Dispatch event for the last drawer update
    if (drawerHeightsConfig && drawerHeightsConfig[lastDrawerIndex]) {
      const dimId = drawerHeightsConfig[lastDrawerIndex].dimId
      window.dispatchEvent(
        new CustomEvent("productPanel:updateDim", {
          detail: {
            id: dimId,
            value: newLastDrawerHeight,
          },
        })
      )
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
  }

  /**
   * Automatically balance drawer heights to fit within carcass height
   */
  public balanceDrawerHeights(): void {
    if (!this.config.drawerQuantity || this.config.drawerQuantity <= 0) return

    const totalHeight = this.getTotalDrawerHeight()

    if (totalHeight > this.dimensions.height) {
      // Reset to equal distribution
      this.resetDrawerHeightsToDefault()

      // Update drawer positions
      this.updateDrawerPositions()
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

    // For wardrobe cabinets, use the dedicated method
    if (this.cabinetType === "wardrobe") {
      this.updateWardrobeDrawerPositions()
      return
    }

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
      // const drawerWidth = this.dimensions.width - endPanelThickness * 2
      const drawerWidth = calculateDrawerWidth(
        this.dimensions.width,
        endPanelThickness
      )

      drawer.updateDimensions(drawerWidth, drawerHeight, this.dimensions.depth)

      // Update position with all drawer heights for accurate positioning
      drawer.updatePositionWithAllHeights(allDrawerHeights)
    })
  }

  private updateDrawers(): void {
    if (this.config.drawerEnabled && this.drawers.length > 0) {
      // For wardrobe cabinets, use fixed drawer heights and bottom positioning
      if (this.cabinetType === "wardrobe") {
        this.updateWardrobeDrawerPositions()
        return
      }

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

        // Recalculate proportionally if height changed (removed 1% threshold for smoother updates)
        if (!approximatelyEqual(heightRatio, 1, 0.0001)) {
          // Fetch product data to get constraints
          let constraints: { min: number; max: number; dimId?: string }[] = []
          try {
            const productData = getClient().getQueryData([
              "productData",
              this.productId,
            ]) as Awaited<ReturnType<typeof getProductData>> | undefined

            if (productData) {
              const { product: wsProduct, threeJsGDs } = productData
              const drawerHeightGDMap: Record<number, string[]> = {
                0: threeJsGDs?.drawerH1 || [],
                1: threeJsGDs?.drawerH2 || [],
                2: threeJsGDs?.drawerH3 || [],
                3: threeJsGDs?.drawerH4 || [],
                4: threeJsGDs?.drawerH5 || [],
              }

              const dimsList = _.sortBy(
                Object.entries(wsProduct?.dims || {}),
                ([, dimObj]) => Number(dimObj.sortNum)
              )

              // Build constraints map
              const constraintsMap: Record<
                number,
                { min: number; max: number; dimId: string }
              > = {}
              dimsList.forEach(([dimId, dimObj]) => {
                const gdId = dimObj.GDId
                if (!gdId || !dimObj.min || !dimObj.max) return

                Object.entries(drawerHeightGDMap).forEach(
                  ([drawerIndexStr, gdList]) => {
                    const drawerIndex = Number(drawerIndexStr)
                    if (gdList.includes(gdId)) {
                      constraintsMap[drawerIndex] = {
                        min: dimObj.min,
                        max: dimObj.max,
                        dimId: dimId,
                      }
                    }
                  }
                )
              })

              // Convert to array matching drawerHeights
              constraints = drawerHeights.map(
                (_, index) =>
                  constraintsMap[index] || {
                    min: 50,
                    max: this.dimensions.height,
                  }
              )
            }
          } catch (e) {
            console.warn(
              "Failed to fetch product data for drawer constraints:",
              e
            )
          }

          // Fallback if constraints empty (e.g. product data not found)
          if (constraints.length === 0) {
            constraints = drawerHeights.map(() => ({
              min: 50,
              max: this.dimensions.height,
            }))
          }

          // Validate total min/max height
          const isMinValid = DrawerHeightManager.validateTotalMinHeight(
            constraints,
            this.dimensions.height
          )
          if (!isMinValid) {
            console.warn(
              "New cabinet height is less than total minimum drawer height. Clamping to minimums."
            )
          }

          // Recalculate drawer heights proportionally using utility function
          this.config.drawerHeights =
            DrawerHeightManager.scaleHeightsProportionally(
              drawerHeights,
              totalCurrentHeight,
              this.dimensions.height,
              constraints
            )

          // Ensure the total doesn't exceed the new cabinet height using utility function
          const validation = validateTotalHeight(
            this.config.drawerHeights,
            this.dimensions.height,
            0.5 // Tolerance of 0.5mm
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

          // Emit events to update UI
          this.config.drawerHeights.forEach((h, i) => {
            const constraint = constraints[i]
            if (constraint && constraint.dimId) {
              window.dispatchEvent(
                new CustomEvent("productPanel:updateDim", {
                  detail: {
                    id: constraint.dimId,
                    value: h,
                  },
                })
              )
            }
          })
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
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly("top", dimensions, config, productId, cabinetId)
  }

  static createBaseCabinet(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly("base", dimensions, config, productId, cabinetId)
  }

  static createTallCabinet(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly("tall", dimensions, config, productId, cabinetId)
  }

  /**
   * Create a wardrobe cabinet - tall cabinet with drawers at bottom and shelves above
   * @param dimensions - standard cabinet dimensions
   * @param config - includes drawerQuantity for number of drawers, wardrobeDrawerHeight (default 220mm)
   */
  static createWardrobeCabinet(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly(
      "wardrobe",
      dimensions,
      {
        ...config,
        drawerEnabled: true, // Always enable drawers for wardrobe
      },
      productId,
      cabinetId
    )
  }

  /**
   * Create a panel cabinet - a single decorative side panel
   * @param dimensions - width = panel thickness, height = panel height, depth = panel face width
   */
  static createPanelCabinet(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly(
      "panel",
      dimensions,
      config,
      productId,
      cabinetId
    )
  }

  /**
   * Create a linear filler - a single front panel positioned at back
   * @param dimensions - width = filler width, height = filler height, depth = panel thickness
   */
  static createLinearFiller(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string
  ): CarcassAssembly {
    return new CarcassAssembly(
      "filler",
      dimensions,
      { ...config, fillerType: "linear" },
      productId,
      cabinetId
    )
  }

  /**
   * Create an L-shape filler - front panel + return panel (40mm depth)
   * @param dimensions - width = filler width, height = filler height, depth = return panel depth (typically 40mm)
   * @param returnPosition - position of return panel: "left" or "right"
   */
  static createLShapeFiller(
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string,
    returnPosition: "left" | "right" = "left"
  ): CarcassAssembly {
    return new CarcassAssembly(
      "filler",
      dimensions,
      {
        ...config,
        fillerType: "l-shape",
        fillerReturnPosition: returnPosition,
      },
      productId,
      cabinetId
    )
  }
}
