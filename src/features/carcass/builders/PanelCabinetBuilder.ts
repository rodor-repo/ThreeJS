import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { CarcassPanel } from "../parts/CarcassPanel"

export class PanelCabinetBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    // For panel cabinet:
    // dimensions.width = panel thickness (X axis)
    // dimensions.height = panel height (Y axis)
    // dimensions.depth = panel face width (Z axis)
    assembly.panel = new CarcassPanel({
      height: assembly.dimensions.height,
      panelWidth: assembly.dimensions.depth, // depth of cabinet = width of panel face
      thickness: assembly.dimensions.width, // width of cabinet = thickness of panel
      material: assembly.config.material.getMaterial(),
    })

    assembly.group.add(assembly.panel.group)

    // Position panel cabinet (no legs for panel type)
    assembly.group.position.set(0, 0, 0)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    if (assembly.panel) {
      assembly.panel.updateDimensions(
        assembly.dimensions.height,
        assembly.dimensions.depth, // depth of cabinet = width of panel face
        assembly.dimensions.width // width of cabinet = thickness of panel
      )
    }
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []

    if (assembly.panel) {
      // CarcassPanel: Get actual dimensions from geometry
      const panelGeometry = assembly.panel.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Panel",
        dimX: panelGeometry.parameters.width,
        dimY: panelGeometry.parameters.height,
        dimZ: panelGeometry.parameters.depth,
      })
    }

    return parts
  }
}

