import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { CarcassPanel } from "../parts/CarcassPanel"
import { CarcassFront } from "../parts/CarcassFront"

export class FillerCabinetBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    const thickness = assembly.config.material.getThickness()
    const isLShape = assembly.config.fillerType === "l-shape"
    const fillerZPosition = 400 // Temporary fixed position until linking logic is added

    if (isLShape) {
      // L-Shape Filler:
      // - Face panel: CarcassFront (XY plane), positioned at z=0 in local coords
      // - Return panel: CarcassPanel (YZ plane), positioned behind face panel
      // - Return length = 40mm - thickness (so face thickness + return = 40mm)

      const returnLength = 40 - thickness // e.g., 40 - 16 = 24mm
      const returnPosition = assembly.config.fillerReturnPosition || "left"

      // Main face panel - back at z=0 in local coords
      assembly.frontPanel = new CarcassFront({
        width: assembly.dimensions.width,
        height: assembly.dimensions.height,
        thickness: thickness,
        material: assembly.config.material.getMaterial(),
        zPosition: 0, // Back of face panel at z=0 in local coords
      })
      assembly.group.add(assembly.frontPanel.group)

      // Return panel - positioned behind the face panel (negative z direction)
      // CarcassPanel has its back at z=0 and front at z=panelWidth
      // We want the return's front edge to meet the face panel's back (z=0)
      // So return's center.z = 0 - panelWidth/2 = -returnLength/2
      assembly.fillerReturn = new CarcassPanel({
        height: assembly.dimensions.height,
        panelWidth: returnLength, // 40mm - thickness
        thickness: thickness,
        material: assembly.config.material.getMaterial(),
      })

      // Override the default position to place return behind the face
      // CarcassPanel puts center at (thickness/2, height/2, panelWidth/2)
      // We need center.z = -returnLength/2 so front edge is at z=0
      assembly.fillerReturn.group.position.z = -returnLength / 2

      // Position return at left or right edge
      if (returnPosition === "right") {
        // Right edge: x = width - thickness
        assembly.fillerReturn.group.position.x =
          assembly.dimensions.width - thickness / 2
      }
      // For left position, default x = thickness/2 is correct

      assembly.group.add(assembly.fillerReturn.group)
    } else {
      // Linear Filler: Same structure as panel type (CarcassPanel, YZ plane)
      // Uses same dimension mapping as panel cabinet:
      // - dimensions.width = panel thickness (X axis, typically 16mm)
      // - dimensions.depth = panel face width (Z axis, typically 100mm for filler)
      assembly.panel = new CarcassPanel({
        height: assembly.dimensions.height,
        panelWidth: assembly.dimensions.depth, // depth of cabinet = width of panel face
        thickness: assembly.dimensions.width, // width of cabinet = thickness of panel
        material: assembly.config.material.getMaterial(),
      })
      assembly.group.add(assembly.panel.group)
    }

    // Position entire filler assembly at z=400mm
    assembly.group.position.set(0, 0, fillerZPosition)
  }

  updateDimensions(assembly: CarcassAssembly): void {
    const thickness = assembly.config.material.getThickness()
    const isLShape = assembly.config.fillerType === "l-shape"

    if (isLShape) {
      // L-Shape filler: update frontPanel and fillerReturn
      if (assembly.frontPanel) {
        assembly.frontPanel.updateDimensions(
          assembly.dimensions.width,
          assembly.dimensions.height,
          thickness
        )
      }

      if (assembly.fillerReturn) {
        const returnLength = 40 - thickness // Return length = 40mm - face thickness
        assembly.fillerReturn.updateDimensions(
          assembly.dimensions.height,
          returnLength,
          thickness
        )

        // Position return behind the face panel
        assembly.fillerReturn.group.position.z = -returnLength / 2

        // Update x position based on return position
        const returnPosition = assembly.config.fillerReturnPosition || "left"
        if (returnPosition === "right") {
          assembly.fillerReturn.group.position.x =
            assembly.dimensions.width - thickness / 2
        } else {
          assembly.fillerReturn.group.position.x = thickness / 2
        }
      }
    } else {
      // Linear filler: update panel (same as panel cabinet)
      if (assembly.panel) {
        assembly.panel.updateDimensions(
          assembly.dimensions.height,
          assembly.dimensions.depth, // panel face width
          assembly.dimensions.width // panel thickness (filler width)
        )
      }
    }
  }

  getPartDimensions(assembly: CarcassAssembly): PartDimension[] {
    const parts: PartDimension[] = []

    if (assembly.frontPanel) {
      // CarcassFront: Get actual dimensions from geometry
      const frontPanelGeometry = assembly.frontPanel.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Front Panel",
        dimX: frontPanelGeometry.parameters.width,
        dimY: frontPanelGeometry.parameters.height,
        dimZ: frontPanelGeometry.parameters.depth,
      })
    }

    if (assembly.fillerReturn) {
      // CarcassPanel: Get actual dimensions from geometry
      const returnGeometry = assembly.fillerReturn.mesh.geometry as THREE.BoxGeometry
      parts.push({
        partName: "Return Panel",
        dimX: returnGeometry.parameters.width,
        dimY: returnGeometry.parameters.height,
        dimZ: returnGeometry.parameters.depth,
      })
    }

    // For linear filler using panel property
    if (assembly.panel && !assembly.frontPanel) {
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

