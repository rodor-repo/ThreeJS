import { MutableRefObject, useEffect } from "react"
import * as THREE from "three"
import { WallDimensions } from "../types"

type CameraViewMode = "x" | "y" | "z" | null

interface UseWallTransparencyParams {
  cameraViewMode: CameraViewMode
  wallRef: MutableRefObject<THREE.Group | null>
  leftWallRef: MutableRefObject<THREE.Group | null>
  rightWallRef: MutableRefObject<THREE.Group | null>
  sceneRef: MutableRefObject<THREE.Scene | null>
  wallDimensions: WallDimensions
}

export const useWallTransparency = ({
  cameraViewMode,
  wallRef,
  leftWallRef,
  rightWallRef,
  sceneRef,
  wallDimensions,
}: UseWallTransparencyParams) => {
  useEffect(() => {
    const backWallOpacity = cameraViewMode === "y" ? 0 : 0.9
    const sideWallsOpacity = cameraViewMode === "x" ? 0 : 0.9

    const updateWallOpacity = (groupRef: MutableRefObject<THREE.Group | null>, opacity: number) => {
      if (!groupRef.current) return
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshLambertMaterial
          if (material.transparent !== undefined) {
            material.opacity = opacity
            material.needsUpdate = true
          }
        }
      })
    }

    updateWallOpacity(wallRef, backWallOpacity)
    updateWallOpacity(leftWallRef, sideWallsOpacity)
    updateWallOpacity(rightWallRef, sideWallsOpacity)

    // Update additional walls (middle walls)
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child === wallRef.current) return

        if (child instanceof THREE.Group && child.children.length > 0) {
          const firstChild = child.children[0]
          if (firstChild instanceof THREE.Mesh) {
            const material = firstChild.material as THREE.MeshLambertMaterial
            if (material && material.transparent !== undefined && firstChild.geometry) {
              const geometry = firstChild.geometry as THREE.BoxGeometry
              if (geometry.parameters && geometry.parameters.width < 100) {
                const xPos = child.position.x
                const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length
                if (xPos > 0 && xPos < backWallLength) {
                  material.opacity = sideWallsOpacity
                  material.needsUpdate = true
                }
              }
            }
          }
        }
      })
    }
  }, [cameraViewMode, wallRef, leftWallRef, rightWallRef, sceneRef, wallDimensions])
}

