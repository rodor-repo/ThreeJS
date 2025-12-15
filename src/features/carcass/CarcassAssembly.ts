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
import { KickerFace } from "./parts/KickerFace"
import { UnderPanelFace } from "./parts/UnderPanelFace"
import { BulkheadFace } from "./parts/BulkheadFace"
import { BulkheadReturn } from "./parts/BulkheadReturn"
import { CarcassMaterial, CarcassMaterialData } from "./Material"
import { DoorMaterial } from "./DoorMaterial"
import { MaterialLoader } from "./MaterialLoader"
import { calculateCabinetYPosition } from "./utils/carcass-dimension-utils"
import { createShelves } from "./utils/shelf-utils"
import { CabinetType } from "../scene/types"
import { CabinetBuilder, PartDimension } from "./builders/CabinetBuilder"
import { BuilderRegistry, TraditionalCabinetBuilder, BULKHEAD_RETURN_THICKNESS } from "./builders"
import { CarcassDrawerManager } from "./managers/CarcassDrawerManager"
import { CarcassDoorManager } from "./managers/CarcassDoorManager"

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

  // Managers
  public drawerManager: CarcassDrawerManager
  public doorManager: CarcassDoorManager
  private builder: CabinetBuilder

  // Carcass parts (public for builders)
  public leftEnd!: CarcassEnd
  public rightEnd!: CarcassEnd
  public back!: CarcassBack
  public bottom!: CarcassBottom
  public top!: CarcassTop
  public shelves: CarcassShelf[] = []
  public legs: CarcassLeg[] = []
  
  // Getters for parts managed by managers
  public get doors(): CarcassDoor[] { return this.doorManager.doors }
  public get drawers(): CarcassDrawer[] { return this.drawerManager.drawers }

  // Panel and filler specific parts
  public panel?: CarcassPanel // For panel type cabinet
  public frontPanel?: CarcassFront // For filler type cabinet (main panel)
  public fillerReturn?: CarcassPanel // For L-shape filler (return panel)

  // Kicker and bulkhead specific parts
  public _kickerFace?: KickerFace // For kicker type cabinet
  public _underPanelFace?: UnderPanelFace // For underPanel type cabinet
  public _bulkheadFace?: BulkheadFace // For bulkhead type cabinet
  public _bulkheadReturnLeft?: BulkheadReturn // Left return for bulkhead cabinet
  public _bulkheadReturnRight?: BulkheadReturn // Right return for bulkhead cabinet

  public productId!: string
  public cabinetId!: string
  public defaultDimValuesApplied: boolean = false

  /**
   * Get the kicker face if this is a kicker cabinet
   */
  public get kickerFace(): KickerFace | undefined {
    return this._kickerFace
  }

  /**
   * Get the underPanel face if this is an underPanel cabinet
   */
  public get underPanelFace(): UnderPanelFace | undefined {
    return this._underPanelFace
  }

  /**
   * Get the bulkhead face if this is a bulkhead cabinet
   */
  public get bulkheadFace(): BulkheadFace | undefined {
    return this._bulkheadFace
  }

  /**
   * Get the left bulkhead return if this is a bulkhead cabinet
   */
  public get bulkheadReturnLeft(): BulkheadReturn | undefined {
    return this._bulkheadReturnLeft
  }

  /**
   * Get the right bulkhead return if this is a bulkhead cabinet
   */
  public get bulkheadReturnRight(): BulkheadReturn | undefined {
    return this._bulkheadReturnRight
  }

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

    // Initialize managers
    this.drawerManager = new CarcassDrawerManager(this)
    this.doorManager = new CarcassDoorManager(this)
    this.builder = BuilderRegistry.getBuilder(cabinetType)

    // Create main group
    this.group = new THREE.Group()
    this.group.name = `${cabinetType}_carcass`

    // Build the carcass based on type
    this.buildCarcass()
  }

  private buildCarcass(): void {
    this.builder.build(this)
  }

  // Exposed methods for builders/managers
  public addPartsToGroup(
    parts: Array<{ group: THREE.Group }> | { group: THREE.Group }
  ): void {
    const partsArray = Array.isArray(parts) ? parts : [parts]
    partsArray.forEach((part) => {
      this.group.add(part.group)
    })
  }

  public removePartsFromGroup(
    parts: Array<{ group: THREE.Group }> | { group: THREE.Group }
  ): void {
    const partsArray = Array.isArray(parts) ? parts : [parts]
    partsArray.forEach((part) => {
      this.group.remove(part.group)
    })
  }
  
  public positionCarcass(): void {
    const legHeight = MaterialLoader.getLegHeight()
    const yPosition = calculateCabinetYPosition(this.cabinetType, legHeight)
    this.group.position.set(0, yPosition, 0)
  }

  public updateDimensions(newDimensions: CarcassDimensions): void {
    this.dimensions = newDimensions
    this.builder.updateDimensions(this)
  }

  // Forwarding methods for Drawer/Door creation (used by builders)
  public createDrawers() { this.drawerManager.createDrawers() }
  public createWardrobeDrawers() { this.drawerManager.createWardrobeDrawers() }
  public createDoors() { this.doorManager.createDoors() }
  
  /**
   * Update shelves when dimensions or configuration changes
   * Only applies to traditional cabinet types
   */
  public updateShelves(): void {
    if (!(this.builder instanceof TraditionalCabinetBuilder)) return

    // Remove existing shelves
    this.removePartsFromGroup(this.shelves)
    this.shelves.forEach((shelf) => shelf.dispose())

    // Create new shelves using shared helper
    this.shelves = createShelves({
      width: this.dimensions.width,
      height: this.dimensions.height,
      depth: this.dimensions.depth,
      shelfCount: this.config.shelfCount,
      shelfSpacing: this.config.shelfSpacing,
      material: this.config.material,
      cabinetType: this.cabinetType,
      drawerQuantity: this.config.drawerQuantity,
      wardrobeDrawerHeight: this.config.wardrobeDrawerHeight,
      wardrobeDrawerBuffer: this.config.wardrobeDrawerBuffer,
    })

    this.addPartsToGroup(this.shelves)
  }

  public updateLegs() {
    // Only update legs for base and tall cabinets
    if (this.legs.length > 0) {
      const thickness = this.config.material.getThickness()
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
  
  public updateDoors() { this.doorManager.updateDoors() }
  public updateDrawers() { this.drawerManager.updateDrawers() }

  // Door operations (delegated to manager)
  public toggleDoors(enabled: boolean) { this.doorManager.toggleDoors(enabled) }
  public updateDoorConfiguration(count: number, mat?: DoorMaterial) { this.doorManager.updateDoorConfiguration(count, mat) }
  public updateOverhangDoor(overhang: boolean) { this.doorManager.updateOverhangDoor(overhang) }
  public updateDoorMaterial(mat: DoorMaterial) { this.doorManager.updateDoorMaterial(mat) }
  
  // Drawer operations (delegated to manager)
  public updateDrawerEnabled(enabled: boolean) { 
    this.drawerManager.toggleDrawers(enabled)
    if (this.cabinetType === "wardrobe") {
      this.updateShelves()
    }
  }
  
  public updateDrawerQuantity(quantity: number) { 
    this.drawerManager.updateQuantity(quantity)
    if (this.cabinetType === "wardrobe") {
      this.updateShelves()
    }
  }
  
  public updateDrawerHeight(index: number, height: number, changedId?: string) {
    this.drawerManager.updateDrawerHeight(index, height, changedId)
  }
  
  public getDrawerHeights() { return this.drawerManager.getDrawerHeights() }
  public getTotalDrawerHeight() { return this.drawerManager.getDrawerHeights().reduce((a, b) => a + b, 0) }
  public validateDrawerHeights() { return this.drawerManager.validateDrawerHeights() }
  public balanceDrawerHeights() { this.drawerManager.balanceDrawerHeights() }

  public updateConfig(newConfig: Partial<CarcassConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateMaterial(newMaterial: CarcassMaterial): void {
    this.config.material = newMaterial
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateMaterialProperties(
    materialChanges: Partial<CarcassMaterialData>
  ): void {
    this.config.material.updateMaterial(materialChanges)
    this.withPreservedPosition(() => {
      this.dispose()
      this.buildCarcass()
    })
  }

  public updateKickerHeight(kickerHeight: number): void {
    MaterialLoader.updateLegHeight(kickerHeight)
    if (this.legs.length > 0) {
      this.legs.forEach((leg) => {
        leg.updateDimensions(
          kickerHeight,
          this.dimensions.width,
          this.dimensions.depth,
          this.config.material.getThickness()
        )
      })
      if (["base", "tall", "wardrobe"].includes(this.cabinetType)) {
        this.group.position.y = kickerHeight
      }
    }
  }

  // Bulkhead specific methods
  public addBulkheadReturn(
    side: "left" | "right",
    height: number,
    depth: number,
    offsetX: number
  ): void {
    if (this.cabinetType !== "bulkhead") return
    const thickness = BULKHEAD_RETURN_THICKNESS
    const bulkheadReturn = new BulkheadReturn({
      height,
      depth,
      thickness,
      material: this.config.material.getMaterial(),
    })
    
    if (side === "left") {
      bulkheadReturn.group.position.x = -offsetX + thickness / 2
      this._bulkheadReturnLeft = bulkheadReturn
    } else {
      bulkheadReturn.group.position.x = offsetX - thickness / 2
      this._bulkheadReturnRight = bulkheadReturn
    }
    bulkheadReturn.group.position.z = -depth / 2
    bulkheadReturn.group.position.y = 0
    this.group.add(bulkheadReturn.group)
  }

  public removeBulkheadReturn(side: "left" | "right"): void {
    if (this.cabinetType !== "bulkhead") return
    if (side === "left" && this._bulkheadReturnLeft) {
      this.group.remove(this._bulkheadReturnLeft.group)
      this._bulkheadReturnLeft.dispose()
      this._bulkheadReturnLeft = undefined
    } else if (side === "right" && this._bulkheadReturnRight) {
      this.group.remove(this._bulkheadReturnRight.group)
      this._bulkheadReturnRight.dispose()
      this._bulkheadReturnRight = undefined
    }
  }

  public updateBulkheadReturn(
    side: "left" | "right",
    height: number,
    depth: number,
    offsetX: number
  ): void {
    if (this.cabinetType !== "bulkhead") return
    const thickness = BULKHEAD_RETURN_THICKNESS
    const bulkheadReturn =
      side === "left" ? this._bulkheadReturnLeft : this._bulkheadReturnRight

    if (!bulkheadReturn) return

    bulkheadReturn.updateDimensions(height, depth, 0, thickness)

    if (side === "left") {
      bulkheadReturn.group.position.x = -offsetX + thickness / 2
    } else {
      bulkheadReturn.group.position.x = offsetX - thickness / 2
    }
    bulkheadReturn.group.position.z = -depth / 2
  }

  private withPreservedPosition(callback: () => void): void {
    const { x, y, z } = this.group.position
    callback()
    this.group.position.set(x, y, z)
  }

  public dispose(): void {
    if (this.panel) { this.panel.dispose(); this.panel = undefined }
    if (this.frontPanel) { this.frontPanel.dispose(); this.frontPanel = undefined }
    if (this.fillerReturn) { this.fillerReturn.dispose(); this.fillerReturn = undefined }
    if (this._bulkheadFace) { this._bulkheadFace.dispose(); this._bulkheadFace = undefined }
    if (this._bulkheadReturnLeft) { this._bulkheadReturnLeft.dispose(); this._bulkheadReturnLeft = undefined }
    if (this._bulkheadReturnRight) { this._bulkheadReturnRight.dispose(); this._bulkheadReturnRight = undefined }
    if (this._kickerFace) { this._kickerFace.dispose(); this._kickerFace = undefined }
    if (this._underPanelFace) { this._underPanelFace.dispose(); this._underPanelFace = undefined }
    
    if (this.leftEnd) this.leftEnd.dispose()
    if (this.rightEnd) this.rightEnd.dispose()
    if (this.back) this.back.dispose()
    if (this.bottom) this.bottom.dispose()
    if (this.top) this.top.dispose()

    this.shelves.forEach((shelf) => shelf.dispose())
    this.legs.forEach((leg) => leg.dispose())
    
    this.doorManager.dispose()
    this.drawerManager.dispose()

    this.group.clear()
  }

  public getPartDimensions(): PartDimension[] {
    return this.builder.getPartDimensions(this)
  }

  // Consolidated Factory
  static create(
    type: CabinetType,
    dimensions: CarcassDimensions,
    config: Partial<CarcassConfig>,
    productId: string,
    cabinetId: string,
    options?: { fillerReturnPosition?: 'left' | 'right' }
  ): CarcassAssembly {
      const finalConfig = { ...config }
      if (type === 'filler' && options?.fillerReturnPosition) {
          finalConfig.fillerReturnPosition = options.fillerReturnPosition
      }
      return new CarcassAssembly(type, dimensions, finalConfig, productId, cabinetId)
  }

}
