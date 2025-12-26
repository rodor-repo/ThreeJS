import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { ApplianceShell } from "../parts/ApplianceShell"
import { ApplianceVisual } from "../parts/ApplianceVisual"

/**
 * ApplianceBuilder - Builds appliance cabinet type with two-layer architecture:
 * 1. Transparent wireframe shell (functional boundaries for snapping, dimensions, views)
 * 2. Decorative visual inner box (represents the appliance visually)
 *
 * Appliances are completely filtered from nesting/part exports.
 */
export class ApplianceBuilder implements CabinetBuilder {
  build(assembly: CarcassAssembly): void {
    const { width, height, depth } = assembly.dimensions
    const config = assembly.config

    // Create transparent wireframe shell (functional boundaries)
    const shell = new ApplianceShell({ width, height, depth })
    assembly._applianceShell = shell
    assembly.group.add(shell.group)

    // Get gap configuration (kicker is now a separate cabinet or handled by positioning)
    const topGap = config.applianceTopGap || 0
    const leftGap = config.applianceLeftGap || 0
    const rightGap = config.applianceRightGap || 0

    // Calculate visual dimensions based on gaps
    // Height is shell height minus top gap (shell height no longer includes kicker)
    const visualWidth = Math.max(10, width - leftGap - rightGap)
    const visualHeight = Math.max(10, height - topGap)

    // Create visual (decorative inner object)
    const visual = new ApplianceVisual({
      width: visualWidth,
      height: visualHeight,
      depth,
      applianceType: config.applianceType || "dishwasher",
      fridgeDoorCount: config.fridgeDoorCount,
      fridgeDoorSide: config.fridgeDoorSide,
    })

    // Position visual with gaps (kickerHeight=0 as shell starts at kicker height)
    visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap, 0)
    assembly._applianceVisual = visual
    assembly.group.add(visual.group)

    // Create legs
    assembly.createLegs()

    // Position the entire carcass correctly
    assembly.positionCarcass()
  }

  updateDimensions(assembly: CarcassAssembly): void {
    const { width, height, depth } = assembly.dimensions
    const config = assembly.config

    // Update shell
    const shell = assembly._applianceShell as ApplianceShell | undefined
    if (shell) {
      shell.updateDimensions(width, height, depth)
    }

    // Update visual with gap offsets
    const visual = assembly._applianceVisual as ApplianceVisual | undefined
    if (visual) {
      const topGap = config.applianceTopGap || 0
      const leftGap = config.applianceLeftGap || 0
      const rightGap = config.applianceRightGap || 0

      // Use kickerHeight=0 because the shell itself is positioned at kicker height
      visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap, 0)
      
      if (config.fridgeDoorCount) {
        visual.setFridgeConfig(
          config.fridgeDoorCount,
          config.fridgeDoorSide || "left"
        )
      }
    }

    // Update legs
    assembly.updateLegs()
  }

  /**
   * Returns empty array - appliances are completely filtered from nesting/part exports
   * They are not manufactured parts, just placeholders for real appliances
   */
  getPartDimensions(_assembly: CarcassAssembly): PartDimension[] {
    return []
  }
}
