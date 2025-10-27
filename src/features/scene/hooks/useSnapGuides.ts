import { useCallback, useRef } from "react"
import * as THREE from "three"
import type { SnapGuideData } from "../lib/snapUtils"
import type { WallDimensions } from "../types"

/**
 * Hook for managing snap guide visual feedback
 * Creates and manages THREE.Line objects that show snap alignment
 */
export const useSnapGuides = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  wallDimensions: WallDimensions
) => {
  const snapLinesRef = useRef<THREE.Line[]>([])

  /**
   * Clear all existing snap guide lines from the scene
   */
  const clearSnapGuides = useCallback(() => {
    if (!sceneRef.current) return

    snapLinesRef.current.forEach((line) => {
      sceneRef.current!.remove(line)
      line.geometry.dispose()
      if (line.material instanceof THREE.Material) {
        line.material.dispose()
      }
    })

    snapLinesRef.current = []
  }, [sceneRef])

  /**
   * Update snap guides based on current snap state
   * Creates visual lines showing where snapping is occurring
   */
  const updateSnapGuides = useCallback(
    (guides: SnapGuideData[]) => {
      // Clear existing guides first
      clearSnapGuides()

      if (!sceneRef.current || guides.length === 0) return

      // Create new guide lines for each snap point
      guides.forEach((guide) => {
        let line: THREE.Line

        if (guide.type === "vertical" && guide.position.x !== undefined) {
          // Create vertical line at X position
          const x = guide.position.x
          const geometry = new THREE.BufferGeometry()
          const points = [
            new THREE.Vector3(x, 0, 0),
            new THREE.Vector3(x, wallDimensions.height, 0),
          ]
          geometry.setFromPoints(points)

          const material = new THREE.LineDashedMaterial({
            color: guide.color,
            linewidth: 2,
            dashSize: 20,
            gapSize: 10,
            opacity: 0.8,
            transparent: true,
          })

          line = new THREE.Line(geometry, material)
          line.computeLineDistances() // Required for dashed lines
        } else if (
          guide.type === "horizontal" &&
          guide.position.y !== undefined
        ) {
          // Create horizontal line at Y position
          const y = guide.position.y
          const geometry = new THREE.BufferGeometry()
          const points = [
            new THREE.Vector3(0, y, 0),
            new THREE.Vector3(wallDimensions.length, y, 0),
          ]
          geometry.setFromPoints(points)

          const material = new THREE.LineDashedMaterial({
            color: guide.color,
            linewidth: 2,
            dashSize: 20,
            gapSize: 10,
            opacity: 0.8,
            transparent: true,
          })

          line = new THREE.Line(geometry, material)
          line.computeLineDistances() // Required for dashed lines
        } else {
          return // Invalid guide data
        }

        // Position guide slightly in front (Z-axis) to ensure visibility
        line.position.z = 10
        line.renderOrder = 999 // Render on top of other objects

        sceneRef.current!.add(line)
        snapLinesRef.current.push(line)
      })
    },
    [sceneRef, wallDimensions, clearSnapGuides]
  )

  return {
    updateSnapGuides,
    clearSnapGuides,
  }
}
