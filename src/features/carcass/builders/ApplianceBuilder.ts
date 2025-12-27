import * as THREE from "three"
import { CarcassAssembly } from "../CarcassAssembly"
import { CabinetBuilder, PartDimension } from "./CabinetBuilder"
import { ApplianceShell } from "../parts/ApplianceShell"
import { ApplianceVisual } from "../parts/ApplianceVisual"

// Kicker panel thickness (same as standard panel thickness)
const KICKER_PANEL_THICKNESS = 16

// Kicker panel color (light gray to differentiate from appliance)
const KICKER_COLOR = 0xd0d0d0

/**
 * Creates kicker panel meshes for appliance base covering
 */
function createKickerPanels(
  visualWidth: number,
  visualDepth: number,
  kickerHeight: number,
  leftGap: number,
  rightGap: number
): { front: THREE.Mesh; left: THREE.Mesh; right: THREE.Mesh; group: THREE.Group } {
  const group = new THREE.Group()
  group.name = "appliance_kicker"

  const material = new THREE.MeshStandardMaterial({
    color: KICKER_COLOR,
    roughness: 0.7,
    metalness: 0.1,
  })

  // Front panel: covers the front of the kicker area
  const frontGeometry = new THREE.BoxGeometry(visualWidth, kickerHeight, KICKER_PANEL_THICKNESS)
  const front = new THREE.Mesh(frontGeometry, material)
  front.name = "kicker_front"
  // Position at front of appliance, centered on visual width
  front.position.set(0, kickerHeight / 2, visualDepth / 2 - KICKER_PANEL_THICKNESS / 2)

  // Left panel: covers the left side of the kicker area
  const leftGeometry = new THREE.BoxGeometry(KICKER_PANEL_THICKNESS, kickerHeight, visualDepth - KICKER_PANEL_THICKNESS)
  const left = new THREE.Mesh(leftGeometry, material.clone())
  left.name = "kicker_left"
  // Position at left side, behind the front panel
  left.position.set(-visualWidth / 2 + KICKER_PANEL_THICKNESS / 2, kickerHeight / 2, -KICKER_PANEL_THICKNESS / 2)

  // Right panel: covers the right side of the kicker area
  const rightGeometry = new THREE.BoxGeometry(KICKER_PANEL_THICKNESS, kickerHeight, visualDepth - KICKER_PANEL_THICKNESS)
  const right = new THREE.Mesh(rightGeometry, material.clone())
  right.name = "kicker_right"
  // Position at right side, behind the front panel
  right.position.set(visualWidth / 2 - KICKER_PANEL_THICKNESS / 2, kickerHeight / 2, -KICKER_PANEL_THICKNESS / 2)

  group.add(front, left, right)

  return { front, left, right, group }
}

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

    // Get gap and kicker configuration
    const topGap = config.applianceTopGap || 0
    const leftGap = config.applianceLeftGap || 0
    const rightGap = config.applianceRightGap || 0
    const kickerHeight = config.applianceKickerHeight || 100

    // Calculate visual dimensions based on gaps and kicker
    const visualWidth = Math.max(10, width - leftGap - rightGap)
    const visualHeight = Math.max(10, height - topGap - kickerHeight)

    // Create visual (decorative inner object)
    const visual = new ApplianceVisual({
      width: visualWidth,
      height: visualHeight,
      depth,
      applianceType: config.applianceType || "dishwasher",
      fridgeDoorCount: config.fridgeDoorCount,
      fridgeDoorSide: config.fridgeDoorSide,
    })

    // Position visual with gaps and on top of kicker
    visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap, kickerHeight)
    assembly._applianceVisual = visual
    assembly.group.add(visual.group)

    // Create kicker panels at the base
    if (kickerHeight > 0) {
      const kicker = createKickerPanels(visualWidth, depth, kickerHeight, leftGap, rightGap)
      // Position kicker group at shell center (matching visual group X,Z positioning)
      const xOffset = (leftGap - rightGap) / 2
      kicker.group.position.set(width / 2 + xOffset, 0, depth / 2)
      assembly._applianceKicker = kicker
      assembly.group.add(kicker.group)
    }

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

    // Update visual with gap offsets and kicker height
    const visual = assembly._applianceVisual as ApplianceVisual | undefined
    if (visual) {
      const topGap = config.applianceTopGap || 0
      const leftGap = config.applianceLeftGap || 0
      const rightGap = config.applianceRightGap || 0
      const kickerHeight = config.applianceKickerHeight || 100

      visual.updateDimensions(width, height, depth, topGap, leftGap, rightGap, kickerHeight)
      // also update config if needed (e.g. if type changed via panel, though usually config is recreated? no, visual is kept)
      if (config.fridgeDoorCount) {
        visual.setFridgeConfig(
          config.fridgeDoorCount,
          config.fridgeDoorSide || "left"
        )
      }
    }

    // Update kicker panels
    const kickerHeight = config.applianceKickerHeight || 100
    const kicker = assembly._applianceKicker as { front: THREE.Mesh; left: THREE.Mesh; right: THREE.Mesh; group: THREE.Group } | undefined
    if (kicker && kickerHeight > 0) {
      const topGap = config.applianceTopGap || 0
      const leftGap = config.applianceLeftGap || 0
      const rightGap = config.applianceRightGap || 0
      const visualWidth = Math.max(10, width - leftGap - rightGap)

      // Update front panel
      kicker.front.geometry.dispose()
      kicker.front.geometry = new THREE.BoxGeometry(visualWidth, kickerHeight, KICKER_PANEL_THICKNESS)
      kicker.front.position.set(0, kickerHeight / 2, depth / 2 - KICKER_PANEL_THICKNESS / 2)

      // Update left panel
      kicker.left.geometry.dispose()
      kicker.left.geometry = new THREE.BoxGeometry(KICKER_PANEL_THICKNESS, kickerHeight, depth - KICKER_PANEL_THICKNESS)
      kicker.left.position.set(-visualWidth / 2 + KICKER_PANEL_THICKNESS / 2, kickerHeight / 2, -KICKER_PANEL_THICKNESS / 2)

      // Update right panel
      kicker.right.geometry.dispose()
      kicker.right.geometry = new THREE.BoxGeometry(KICKER_PANEL_THICKNESS, kickerHeight, depth - KICKER_PANEL_THICKNESS)
      kicker.right.position.set(visualWidth / 2 - KICKER_PANEL_THICKNESS / 2, kickerHeight / 2, -KICKER_PANEL_THICKNESS / 2)

      // Update group position for gap offsets (matching visual group X,Z positioning)
      const xOffset = (leftGap - rightGap) / 2
      kicker.group.position.set(width / 2 + xOffset, 0, depth / 2)
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
