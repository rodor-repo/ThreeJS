import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { KickerFace } from "../parts/KickerFace"
import { UnderPanelFace } from "../parts/UnderPanelFace"
import { BulkheadFace } from "../parts/BulkheadFace"
import { Benchtop } from "../parts/Benchtop"

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

/**
 * Builder for benchtop cabinet type.
 * Creates a simple benchtop slab that sits on top of base cabinets.
 * 
 * Dimensions mapping:
 * - width = benchtop length (X axis)
 * - height = benchtop thickness (Y axis, typically 38mm)
 * - depth = benchtop depth (Z axis, includes front overhang)
 * 
 * Overhangs are stored in config:
 * - benchtopFrontOverhang: extends depth toward +Z
 * - benchtopLeftOverhang: extends from left edge toward -X
 * - benchtopRightOverhang: extends from right edge toward +X
 */
export class BenchtopBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    // Get overhang values from config
    const frontOverhang = assembly.config.benchtopFrontOverhang ?? 0
    const leftOverhang = assembly.config.benchtopLeftOverhang ?? 0
    const rightOverhang = assembly.config.benchtopRightOverhang ?? 0

    // Create Benchtop using existing Benchtop class from parts/
    // Note: dimensions.height is used for thickness (following underPanel pattern)
    assembly._benchtop = new Benchtop(
      assembly.dimensions.width,   // length
      assembly.dimensions.height,  // thickness (38mm default)
      assembly.dimensions.depth,   // depth (including front overhang)
      frontOverhang,
      leftOverhang,
      rightOverhang
    )

    assembly.group.add(assembly._benchtop.mesh)

    // Position at origin (global positioning handled by handler)
    assembly.group.position.set(0, 0, 0)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    if (assembly._benchtop) {
      assembly._benchtop.updateDimensions(
        assembly.dimensions.width,
        assembly.dimensions.height,
        assembly.dimensions.depth,
        assembly.config.benchtopFrontOverhang,
        assembly.config.benchtopLeftOverhang,
        assembly.config.benchtopRightOverhang
      )
    }
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []
    if (assembly._benchtop) {
      const benchtopGeometry = assembly._benchtop.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Benchtop",
        dimX: benchtopGeometry.parameters.width,
        dimY: benchtopGeometry.parameters.height,
        dimZ: benchtopGeometry.parameters.depth,
      })
    }
    return parts
  }
}

