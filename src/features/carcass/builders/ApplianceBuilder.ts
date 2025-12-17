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

    // Get gap configuration
    const topGap = config.applianceTopGap || 0
    const leftGap = config.applianceLeftGap || 0
    const rightGap = config.applianceRightGap || 0

    // Calculate visual dimensions based on gaps
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

    // Position visual with gaps
    visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap)
    assembly._applianceVisual = visual
    assembly.group.add(visual.group)

    // Position at origin (Y=0, on the floor like base cabinets)
    assembly.group.position.set(0, 0, 0)
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

      visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap)
      // also update config if needed (e.g. if type changed via panel, though usually config is recreated? no, visual is kept)
      if (config.fridgeDoorCount) {
        visual.setFridgeConfig(
          config.fridgeDoorCount,
          config.fridgeDoorSide || "left"
        )
      }
    }
  }

  /**
   * Returns empty array - appliances are completely filtered from nesting/part exports
   * They are not manufactured parts, just placeholders for real appliances
   */
  getPartDimensions(_assembly: CarcassAssembly): PartDimension[] {
    return []
  }
}
