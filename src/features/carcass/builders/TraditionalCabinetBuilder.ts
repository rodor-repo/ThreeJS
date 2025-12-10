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
    const thickness = assembly.config.material.getThickness()
    const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions(assembly)

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
      const baseRailDepth = MaterialLoader.getBaseRailDepth(assembly.cabinetType)
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

    // Left End
    const leftEndGeometry = assembly.leftEnd.mesh.geometry as THREE.BoxGeometry
    parts.push({
      partName: "Left Panel",
      dimX: leftEndGeometry.parameters.width,
      dimY: leftEndGeometry.parameters.height,
      dimZ: leftEndGeometry.parameters.depth,
    })

    // Right End
    const rightEndGeometry = assembly.rightEnd.mesh.geometry as THREE.BoxGeometry
    parts.push({
      partName: "Right Panel",
      dimX: rightEndGeometry.parameters.width,
      dimY: rightEndGeometry.parameters.height,
      dimZ: rightEndGeometry.parameters.depth,
    })

    // Back
    const backGeometry = assembly.back.mesh.geometry as THREE.BoxGeometry
    parts.push({
      partName: "Back Panel",
      dimX: backGeometry.parameters.width,
      dimY: backGeometry.parameters.height,
      dimZ: backGeometry.parameters.depth,
    })

    // Top: For base cabinets, this is actually a Base Rail
    const topGeometry = assembly.top.mesh.geometry as THREE.BoxGeometry
    const topDims = {
      x: topGeometry.parameters.width,
      y: topGeometry.parameters.height,
      z: topGeometry.parameters.depth,
    }

    if (assembly.cabinetType === "base") {
      parts.push({
        partName: "Base Rail",
        dimX: topDims.x,
        dimY: topDims.y,
        dimZ: topDims.z,
      })
    } else {
      parts.push({
        partName: "Top Panel",
        dimX: topDims.x,
        dimY: topDims.y,
        dimZ: topDims.z,
      })
    }

    // Bottom
    if (
      (assembly.cabinetType === "base" ||
        assembly.cabinetType === "tall" ||
        assembly.cabinetType === "wardrobe") &&
      assembly.bottom
    ) {
      const bottomGeometry = assembly.bottom.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Bottom Panel",
        dimX: bottomGeometry.parameters.width,
        dimY: bottomGeometry.parameters.height,
        dimZ: bottomGeometry.parameters.depth,
      })
    }

    // Shelves
    assembly.shelves.forEach((shelf, index) => {
      const shelfGeometry = shelf.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: `Shelf ${index + 1}`,
        dimX: shelfGeometry.parameters.width,
        dimY: shelfGeometry.parameters.height,
        dimZ: shelfGeometry.parameters.depth,
      })
    })

    // Doors
    assembly.doors.forEach((door, index) => {
      const doorGeometry = door.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: `Door ${index + 1}`,
        dimX: doorGeometry.parameters.width,
        dimY: doorGeometry.parameters.height,
        dimZ: doorGeometry.parameters.depth,
      })
    })

    // Drawers
    assembly.drawers.forEach((drawer, index) => {
      const drawerGeometry = drawer.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: `Drawer Front ${index + 1}`,
        dimX: drawerGeometry.parameters.width,
        dimY: drawerGeometry.parameters.height,
        dimZ: drawerGeometry.parameters.depth,
      })
    })

    return parts
  }

  // Helper methods

  private calculateCommonPanelDimensions(assembly: CarcassAssembly): {
    panelWidth: number
    effectiveDepth: number
  } {
    const thickness = assembly.config.material.getThickness()
    const panelWidth = calculatePanelWidth(
      assembly.dimensions.width,
      thickness
    )
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
    const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions(assembly)
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
        const drawerHeight = assembly.config.wardrobeDrawerHeight || 220
        const buffer = assembly.config.wardrobeDrawerBuffer || 50
        const totalDrawerHeight = drawerQuantity * drawerHeight
        startHeight = totalDrawerHeight + buffer + thickness
      } else {
        startHeight = thickness + 100
      }

      const endHeight = assembly.dimensions.height - thickness - 100

      const shelfPositions = calculateShelfPositions(
        startHeight,
        endHeight,
        assembly.config.shelfCount,
        assembly.config.shelfSpacing
      )

      const { panelWidth, effectiveDepth } = this.calculateCommonPanelDimensions(assembly)

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
          diameter: 50,
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

