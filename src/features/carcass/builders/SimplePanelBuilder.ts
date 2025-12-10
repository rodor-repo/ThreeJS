import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { KickerFace } from "../parts/KickerFace"
import { UnderPanelFace } from "../parts/UnderPanelFace"
import { BulkheadFace } from "../parts/BulkheadFace"

export class KickerBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    assembly._kickerFace = new KickerFace({
      width: assembly.dimensions.width,
      legHeight: assembly.dimensions.height, // Use height as the kicker height
      depth: assembly.dimensions.depth,
      material: assembly.config.material.getMaterial(),
    })

    assembly.group.add(assembly._kickerFace.mesh)

    // Position at origin
    assembly.group.position.set(0, 0, 0)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    if (assembly._kickerFace) {
      assembly._kickerFace.updateDimensions(
        assembly.dimensions.width,
        assembly.dimensions.height, // legHeight
        assembly.dimensions.depth
      )
    }
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []
    if (assembly._kickerFace) {
      const kickerGeometry = assembly._kickerFace.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Kicker Face",
        dimX: kickerGeometry.parameters.width,
        dimY: kickerGeometry.parameters.height,
        dimZ: kickerGeometry.parameters.depth,
      })
    }
    return parts
  }
}

export class UnderPanelBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    assembly._underPanelFace = new UnderPanelFace({
      width: assembly.dimensions.width,
      depth: assembly.dimensions.depth,
      thickness: assembly.dimensions.height, // Use height as thickness
      material: assembly.config.material.getMaterial(),
    })

    assembly.group.add(assembly._underPanelFace.group)

    // Position at origin (global positioning handled by handler)
    assembly.group.position.set(0, 0, 0)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    if (assembly._underPanelFace) {
      assembly._underPanelFace.updateDimensions(
        assembly.dimensions.width,
        assembly.dimensions.depth,
        assembly.dimensions.height // thickness
      )
    }
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []
    if (assembly._underPanelFace) {
      const underPanelGeometry = assembly._underPanelFace.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Under Panel",
        dimX: underPanelGeometry.parameters.width,
        dimY: underPanelGeometry.parameters.height,
        dimZ: underPanelGeometry.parameters.depth,
      })
    }
    return parts
  }
}

export class BulkheadBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    assembly._bulkheadFace = new BulkheadFace({
      width: assembly.dimensions.width,
      height: assembly.dimensions.height,
      depth: assembly.dimensions.depth,
      material: assembly.config.material.getMaterial(),
    })

    assembly.group.add(assembly._bulkheadFace.mesh)

    // Position at origin
    assembly.group.position.set(0, 0, 0)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    if (assembly._bulkheadFace) {
      assembly._bulkheadFace.updateDimensions(
        assembly.dimensions.width,
        assembly.dimensions.height,
        assembly.dimensions.depth,
        0 // cabinetTopY - this will be set properly by position handler
      )
    }
    // Note: Returns are updated via dedicated methods in Assembly for now, or we could handle them here if we iterate checks
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []
    if (assembly._bulkheadFace) {
      const bulkheadGeometry = assembly._bulkheadFace.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Bulkhead Face",
        dimX: bulkheadGeometry.parameters.width,
        dimY: bulkheadGeometry.parameters.height,
        dimZ: bulkheadGeometry.parameters.depth,
      })

      // Include returns if they exist
      if (assembly._bulkheadReturnLeft) {
        const returnGeometry = assembly._bulkheadReturnLeft.mesh.geometry as THREE.BoxGeometry
        parts.push({
          partName: "Bulkhead Return Left",
          dimX: returnGeometry.parameters.width,
          dimY: returnGeometry.parameters.height,
          dimZ: returnGeometry.parameters.depth,
        })
      }
      if (assembly._bulkheadReturnRight) {
        const returnGeometry = assembly._bulkheadReturnRight.mesh.geometry as THREE.BoxGeometry
        parts.push({
          partName: "Bulkhead Return Right",
          dimX: returnGeometry.parameters.width,
          dimY: returnGeometry.parameters.height,
          dimZ: returnGeometry.parameters.depth,
        })
      }
    }
    return parts
  }
}

