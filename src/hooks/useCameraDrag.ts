import { useCallback, useRef } from "react"
import * as THREE from "three"
import {
  WALL_THICKNESS,
  lookAtWallCenter,
  positionCamera,
} from "../components/three/scene-utils"

export type DragState = {
  isDragging: boolean
  dragStart: { x: number; y: number }
  cameraStart: { x: number; y: number }
  zoomLevel: number
}

export type WallDims = { height: number; length: number }

export const useCameraDrag = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDims,
  isMenuOpen: boolean,
  state: DragState,
  setState: (next: Partial<DragState>) => void
) => {
  const movementSensitivity = 1.5

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!cameraRef.current) return
      if (isMenuOpen) return
      setState({
        isDragging: true,
        dragStart: {
          x: clientX / window.innerWidth,
          y: 1 - clientY / window.innerHeight,
        },
        cameraStart: {
          x: cameraRef.current.position.x,
          y: cameraRef.current.position.y,
        },
      })
    },
    [cameraRef, isMenuOpen, setState]
  )

  const move = useCallback(
    (clientX: number, clientY: number) => {
      const camera = cameraRef.current
      if (!camera) return
      if (isMenuOpen || !state.isDragging) return

      const currentMouseX = clientX / window.innerWidth
      const currentMouseY = 1 - clientY / window.innerHeight

      const deltaX =
        (currentMouseX - state.dragStart.x) *
        wallDimensions.length *
        movementSensitivity
      const deltaY =
        (currentMouseY - state.dragStart.y) *
        wallDimensions.height *
        movementSensitivity

      if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return

      const newCameraX = state.cameraStart.x - deltaX
      const newCameraY = state.cameraStart.y - deltaY

      const clampedX = Math.max(
        -wallDimensions.length * 0.5,
        Math.min(wallDimensions.length * 1.5, newCameraX)
      )
      const clampedY = Math.max(
        -wallDimensions.height * 0.5,
        Math.min(wallDimensions.height * 1.5, newCameraY)
      )

      camera.position.set(clampedX, clampedY, camera.position.z)
      const wallCenterX = wallDimensions.length / 2
      const wallCenterY = wallDimensions.height / 2
      const wallCenterZ = -WALL_THICKNESS / 2
      camera.lookAt(wallCenterX, wallCenterY, wallCenterZ)
    },
    [cameraRef, isMenuOpen, state, wallDimensions.height, wallDimensions.length]
  )

  const end = useCallback(() => {
    setState({ isDragging: false })
  }, [setState])

  const wheel = useCallback(
    (deltaY: number) => {
      const camera = cameraRef.current
      if (!camera) return
      if (isMenuOpen) {
        setState({ isDragging: false })
        return
      }
      const zoomSpeed = 0.1
      const minZoom = 0.3
      const maxZoom = 5
      let newZoom = state.zoomLevel
      newZoom =
        deltaY > 0
          ? Math.min(maxZoom, state.zoomLevel + zoomSpeed)
          : Math.max(minZoom, state.zoomLevel - zoomSpeed)
      setState({ zoomLevel: newZoom })
      if (!state.isDragging) {
        const wallCenterZ = -WALL_THICKNESS / 2
        const cameraDistance = newZoom * wallDimensions.length
        const { x, y } = camera.position
        camera.position.set(x, y, wallCenterZ + cameraDistance)
        lookAtWallCenter(camera, wallDimensions)
      }
    },
    [cameraRef, isMenuOpen, setState, state.zoomLevel, wallDimensions]
  )

  const middleClick = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    if (isMenuOpen) {
      setState({ isDragging: false })
      return
    }
    setState({ zoomLevel: 1.5 })
    positionCamera(camera, wallDimensions, 1.5)
  }, [cameraRef, isMenuOpen, setState, wallDimensions])

  return { startDrag, move, end, wheel, middleClick }
}
