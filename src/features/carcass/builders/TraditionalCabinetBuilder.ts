import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { CarcassEnd } from "../parts/CarcassEnd"
import { CarcassBack } from "../parts/CarcassBack"
import { CarcassBottom } from "../parts/CarcassBottom"
import { CarcassTop } from "../parts/CarcassTop"
import { CarcassShelf } from "../parts/CarcassShelf"
import { CarcassLeg } from "../parts/CarcassLeg"
import { MaterialLoader } from "../MaterialLoader"
import {
  calculatePanelWidth,
  calculateEffectiveDepth,
  calculateRightEndXPosition,
  calculateShelfPositions,
} from "../utils/carcass-dimension-utils"
import { createPartDimension } from "../utils/carcass-geometry-utils"
import {
  SHELF_OFFSET_FROM_EDGE,
  LEG_DIAMETER,
  DEFAULT_WARDROBE_DRAWER_HEIGHT,
  DEFAULT_WARDROBE_DRAWER_BUFFER,
  PART_NAMES,
} from "./builder-constants"

export class TraditionalCabinetBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    this.createEndPanels(assembly)
    this.createBackPanel(assembly)
    this.createBottomPanel(assembly)
    this.createTopPanel(assembly)
    this.createShelves(assembly)
    this.createLegs(assembly)

    // TODO: These will be moved to managers in later phases
    if (assembly.cabinetType === "wardrobe") {
      assembly.createWardrobeDrawers()
    } else {
      assembly.createDrawers()
    }
    assembly.createDoors()

    // Add all parts to the main group
    assembly.addPartsToGroup([
      assembly.leftEnd,
      assembly.rightEnd,
      assembly.back,
      assembly.bottom,
      assembly.top,
    ])
    assembly.addPartsToGroup(assembly.shelves)
    assembly.addPartsToGroup(assembly.legs)
    assembly.addPartsToGroup(assembly.drawers)
    assembly.addPartsToGroup(assembly.doors)

    // Position the entire carcass based on type
    assembly.positionCarcass()
  }

  updateDimensions(assembly: CarcassAssembly): void {
    // Guard: ensure parts exist before updating
    if (
      !assembly.leftEnd ||
      !assembly.rightEnd ||
      !assembly.back ||
      !assembly.bottom ||
      !assembly.top
    ) {
      console.warn(
        "TraditionalCabinetBuilder.updateDimensions: Required parts not initialized"
      )
      return
    }

    const thickness = assembly.config.material.getThickness()
    const { panelWidth, effectiveDepth } =
      this.calculateCommonPanelDimensions(assembly)

    // Update all parts
    assembly.leftEnd.updateDimensions(
      assembly.dimensions.height,
      assembly.dimensions.depth,
      thickness
    )

    assembly.rightEnd.updateDimensions(
      assembly.dimensions.height,
      assembly.dimensions.depth,
      thickness
    )

    // Update right end position
    const rightEndX = calculateRightEndXPosition(
      assembly.dimensions.width,
      thickness
    )
    assembly.rightEnd.setXPosition(rightEndX)

    // Update back panel with corrected width: Width - (EndLThickness + EndRThickness)
    assembly.back.updateDimensions(
      assembly.dimensions.height,
      panelWidth, // Account for both end panels
      thickness,
      thickness
    )

    // Update bottom panel
    assembly.bottom.updateDimensions(
      effectiveDepth,
      panelWidth,
      thickness,
      thickness,
      thickness
    )

    // Update top panel
    assembly.top.updateDimensions(
      assembly.dimensions.depth,
      panelWidth,
      thickness,
      thickness,
      thickness
    )
    assembly.top.updateHeight(assembly.dimensions.height)

    // Update Base Rail settings for Base cabinets
    if (assembly.cabinetType === "base") {
      const baseRailDepth = MaterialLoader.getBaseRailDepth(
        assembly.cabinetType
      )
      assembly.top.updateBaseRailSettings(assembly.cabinetType, baseRailDepth)
    }

    // Update shelves
    assembly.updateShelves()

    // Update legs with new dimensions
    assembly.updateLegs()

    // Update doors with new dimensions
    assembly.updateDoors()

    // Update drawers with new dimensions
    assembly.updateDrawers()
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []

    // Helper to safely add a part dimension
    const addPart = (name: string, mesh: THREE.Mesh | undefined): void => {
      if (!mesh) return
      const dim = createPartDimension(name, mesh)
      if (dim) parts.push(dim)
    }

    // Core structural parts
    addPart(PART_NAMES.LEFT_PANEL, assembly.leftEnd?.mesh)
    addPart(PART_NAMES.RIGHT_PANEL, assembly.rightEnd?.mesh)
    addPart(PART_NAMES.BACK_PANEL, assembly.back?.mesh)

    // Top: For base cabinets, this is actually a Base Rail
    const topPartName =
      assembly.cabinetType === "base"
        ? PART_NAMES.BASE_RAIL
        : PART_NAMES.TOP_PANEL
    addPart(topPartName, assembly.top?.mesh)

    // Bottom (only for base/tall/wardrobe)
    if (["base", "tall", "wardrobe"].includes(assembly.cabinetType)) {
      addPart(PART_NAMES.BOTTOM_PANEL, assembly.bottom?.mesh)
    }

    // Shelves
    assembly.shelves.forEach((shelf, index) => {
      addPart(`${PART_NAMES.SHELF} ${index + 1}`, shelf.mesh)
    })

    // Doors
    assembly.doors.forEach((door, index) => {
      addPart(`${PART_NAMES.DOOR} ${index + 1}`, door.mesh)
    })

    // Drawers
    assembly.drawers.forEach((drawer, index) => {
      addPart(`${PART_NAMES.DRAWER_FRONT} ${index + 1}`, drawer.mesh)
    })

    return parts
  }

  // Helper methods

  private calculateCommonPanelDimensions(assembly: CarcassAssembly): {
    panelWidth: number
    effectiveDepth: number
  } {
    const thickness = assembly.config.material.getThickness()
    const panelWidth = calculatePanelWidth(assembly.dimensions.width, thickness)
    const effectiveDepth = calculateEffectiveDepth(
      assembly.dimensions.depth,
      thickness
    )
    return { panelWidth, effectiveDepth }
  }

  private createEndPanels(assembly: CarcassAssembly): void {
    const thickness = assembly.config.material.getThickness()

    assembly.leftEnd = new CarcassEnd({
      height: assembly.dimensions.height,
      depth: assembly.dimensions.depth,
      thickness: thickness,
      position: "left",
      material: assembly.config.material.getMaterial(),
    })

    assembly.rightEnd = new CarcassEnd({
      height: assembly.dimensions.height,
      depth: assembly.dimensions.depth,
      thickness: thickness,
      position: "right",
      material: assembly.config.material.getMaterial(),
    })

    const rightEndX = calculateRightEndXPosition(
      assembly.dimensions.width,
      thickness
    )
    assembly.rightEnd.setXPosition(rightEndX)
  }

  private createBackPanel(assembly: CarcassAssembly): void {
    const { panelWidth } = this.calculateCommonPanelDimensions(assembly)
    const thickness = assembly.config.material.getThickness()

    assembly.back = new CarcassBack({
      height: assembly.dimensions.height,
      width: panelWidth,
      thickness: thickness,
      leftEndThickness: thickness,
      material: assembly.config.material.getMaterial(),
    })
  }

  private createBottomPanel(assembly: CarcassAssembly): void {
    const { panelWidth, effectiveDepth } =
      this.calculateCommonPanelDimensions(assembly)
    const thickness = assembly.config.material.getThickness()

    assembly.bottom = new CarcassBottom({
      depth: effectiveDepth,
      width: panelWidth,
      thickness: thickness,
      leftEndThickness: thickness,
      backThickness: thickness,
      material: assembly.config.material.getMaterial(),
    })
  }

  private createTopPanel(assembly: CarcassAssembly): void {
    const { panelWidth } = this.calculateCommonPanelDimensions(assembly)
    const thickness = assembly.config.material.getThickness()

    const traditionalType = assembly.cabinetType as "top" | "base" | "tall"
    const baseRailDepth = MaterialLoader.getBaseRailDepth(traditionalType)

    const isDrawerBase =
      assembly.cabinetType === "base" && assembly.config.drawerEnabled

    assembly.top = new CarcassTop({
      depth: assembly.dimensions.depth,
      width: panelWidth,
      thickness: thickness,
      height: assembly.dimensions.height,
      leftEndThickness: thickness,
      backThickness: thickness,
      material: assembly.config.material.getMaterial(),
      cabinetType: traditionalType,
      baseRailDepth: baseRailDepth,
      isDrawerBase: isDrawerBase,
    })
  }

  private createShelves(assembly: CarcassAssembly): void {
    assembly.shelves = []

    if (assembly.config.shelfCount > 0) {
      const thickness = assembly.config.material.getThickness()

      let startHeight: number
      if (assembly.cabinetType === "wardrobe") {
        const drawerQuantity = assembly.config.drawerQuantity || 0
        const drawerHeight =
          assembly.config.wardrobeDrawerHeight || DEFAULT_WARDROBE_DRAWER_HEIGHT
        const buffer =
          assembly.config.wardrobeDrawerBuffer || DEFAULT_WARDROBE_DRAWER_BUFFER
        const totalDrawerHeight = drawerQuantity * drawerHeight
        startHeight = totalDrawerHeight + buffer + thickness
      } else {
        startHeight = thickness + SHELF_OFFSET_FROM_EDGE
      }

      const endHeight =
        assembly.dimensions.height - thickness - SHELF_OFFSET_FROM_EDGE

      const shelfPositions = calculateShelfPositions(
        startHeight,
        endHeight,
        assembly.config.shelfCount,
        assembly.config.shelfSpacing
      )

      const { panelWidth, effectiveDepth } =
        this.calculateCommonPanelDimensions(assembly)

      shelfPositions.forEach((height) => {
        const shelf = new CarcassShelf({
          depth: effectiveDepth,
          width: panelWidth,
          thickness: thickness,
          height: height,
          leftEndThickness: thickness,
          backThickness: thickness,
          material: assembly.config.material.getMaterial(),
        })

        assembly.shelves.push(shelf)
      })
    }
  }

  private createLegs(assembly: CarcassAssembly): void {
    assembly.legs = []

    if (
      assembly.cabinetType === "base" ||
      assembly.cabinetType === "tall" ||
      assembly.cabinetType === "wardrobe"
    ) {
      const legHeight = MaterialLoader.getLegHeight()
      const thickness = assembly.config.material.getThickness()

      const legPositions: Array<
        "frontLeft" | "frontRight" | "backLeft" | "backRight"
      > = ["frontLeft", "frontRight", "backLeft", "backRight"]

      legPositions.forEach((position) => {
        const leg = new CarcassLeg({
          height: legHeight,
          diameter: LEG_DIAMETER,
          position: position,
          width: assembly.dimensions.width,
          depth: assembly.dimensions.depth,
          thickness: thickness,
          material: assembly.config.material.getMaterial(),
        })

        assembly.legs.push(leg)
      })
    }
  }
}
