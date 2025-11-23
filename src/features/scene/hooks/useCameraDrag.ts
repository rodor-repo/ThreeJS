import { useCallback, useRef } from "react"
import * as THREE from "three"
import {
  WALL_THICKNESS,
  lookAtWallCenter,
  positionCamera,
} from "../lib/sceneUtils"

export type DragState = {
  isDragging: boolean
  dragStart: { x: number; y: number }
  cameraStart: { x: number; y: number }
  zoomLevel: number
  orbitRadius: number
  orbitTheta: number
  orbitPhi: number
  orbitTarget: { x: number; y: number; z: number } // Point the camera is looking at
}

export type WallDims = { height: number; length: number }

export const useCameraDrag = (
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDims,
  isMenuOpen: boolean,
  cameraMode: 'constrained' | 'free',
  state: DragState,
  setState: (next: Partial<DragState>) => void
) => {
  const movementSensitivity = 1.5

  // Helper function to update camera position from spherical coordinates
  const updateCameraFromOrbit = useCallback(
    (theta: number, phi: number, radius: number, target?: { x: number; y: number; z: number }) => {
      const camera = cameraRef.current
      if (!camera) return

      // Use provided target or fall back to wall center
      const targetX = target?.x ?? wallDimensions.length / 2
      const targetY = target?.y ?? wallDimensions.height / 2
      const targetZ = target?.z ?? -WALL_THICKNESS / 2

      // Convert spherical to cartesian coordinates relative to target
      let x = targetX + radius * Math.sin(phi) * Math.cos(theta)
      let y = targetY + radius * Math.cos(phi)
      let z = targetZ + radius * Math.sin(phi) * Math.sin(theta)

      // Apply movement limits
      const minZ = -500 // Limit Z negative to -500mm
      const minY = -200 // Limit Y negative to -200mm
      
      // Clamp camera position to limits
      z = Math.max(minZ, z)
      y = Math.max(minY, y)

      camera.position.set(x, y, z)
      camera.lookAt(targetX, targetY, targetZ)
    },
    [cameraRef, wallDimensions]
  )

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!cameraRef.current) return
      if (isMenuOpen) return

      if (cameraMode === 'free') {
        // In free mode, track starting angles for orbit
        setState({
          isDragging: true,
          dragStart: {
            x: clientX,
            y: clientY,
          },
        })
      } else {
        // Constrained mode - track normalized positions
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
      }
    },
    [cameraRef, cameraMode, isMenuOpen, setState]
  )

  const move = useCallback(
    (clientX: number, clientY: number) => {
      const camera = cameraRef.current
      if (!camera) return
      if (isMenuOpen || !state.isDragging) return

      if (cameraMode === 'free') {
        // Free mode - orbit camera rotation (reversed: mouse left = camera right, mouse up = camera down)
        const deltaX = clientX - state.dragStart.x
        const deltaY = clientY - state.dragStart.y

        // Rotation sensitivity
        const rotateSpeed = 0.005

        // Update spherical coordinates (reversed directions)
        const newTheta = state.orbitTheta + deltaX * rotateSpeed // Reversed: + instead of -
        const newPhi = Math.max(
          0.1, // Prevent gimbal lock at top
          Math.min(Math.PI - 0.1, state.orbitPhi - deltaY * rotateSpeed) // Reversed: - instead of +
        )

        setState({
          orbitTheta: newTheta,
          orbitPhi: newPhi,
          dragStart: { x: clientX, y: clientY },
        })

        updateCameraFromOrbit(newTheta, newPhi, state.orbitRadius, state.orbitTarget)
      } else {
        // Constrained mode - pan camera
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
      }
    },
    [cameraRef, cameraMode, isMenuOpen, state, wallDimensions, movementSensitivity, setState, updateCameraFromOrbit]
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

      if (cameraMode === 'free') {
        // Free mode - adjust orbit radius (zoom toward/away from target)
        const zoomSpeed = wallDimensions.length * 0.1
        const minRadius = wallDimensions.length * 0.5
        const maxRadius = wallDimensions.length * 5

        const newRadius =
          deltaY > 0
            ? Math.min(maxRadius, state.orbitRadius + zoomSpeed)
            : Math.max(minRadius, state.orbitRadius - zoomSpeed)

        setState({ orbitRadius: newRadius })
        updateCameraFromOrbit(state.orbitTheta, state.orbitPhi, newRadius, state.orbitTarget)
      } else {
        // Constrained mode - zoom
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
      }
    },
    [cameraRef, cameraMode, isMenuOpen, setState, state, wallDimensions, updateCameraFromOrbit]
  )

  const middleClick = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    if (isMenuOpen) {
      setState({ isDragging: false })
      return
    }

    if (cameraMode === 'free') {
      // Reset to default orbit position
      const defaultRadius = wallDimensions.length * 1.5
      const defaultTheta = 0
      const defaultPhi = Math.PI / 3
      const wallCenterTarget = {
        x: wallDimensions.length / 2,
        y: wallDimensions.height / 2,
        z: -WALL_THICKNESS / 2
      }
      setState({
        orbitRadius: defaultRadius,
        orbitTheta: defaultTheta,
        orbitPhi: defaultPhi,
        orbitTarget: wallCenterTarget,
      })
      updateCameraFromOrbit(defaultTheta, defaultPhi, defaultRadius, wallCenterTarget)
    } else {
      setState({ zoomLevel: 1.5 })
      positionCamera(camera, wallDimensions, 1.5)
    }
  }, [cameraRef, cameraMode, isMenuOpen, setState, wallDimensions, updateCameraFromOrbit])

  // Pan camera in free mode (right-click drag)
  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      if (!cameraRef.current) return
      if (isMenuOpen) return
      setState({
        isDragging: true,
        dragStart: { x: clientX, y: clientY },
        cameraStart: {
          x: cameraRef.current.position.x,
          y: cameraRef.current.position.y,
        },
      })
    },
    [cameraRef, isMenuOpen, setState]
  )

  const movePan = useCallback(
    (clientX: number, clientY: number) => {
      const camera = cameraRef.current
      if (!camera) return
      if (isMenuOpen || !state.isDragging) return

      // Calculate delta from last frame (not from start!)
      const deltaX = clientX - state.dragStart.x
      const deltaY = clientY - state.dragStart.y

      // Pan sensitivity (adjust based on distance from target for proper feel)
      const distance = state.orbitRadius
      const panSpeed = distance * 0.001

      // Get camera's local axes
      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      right.setFromMatrixColumn(camera.matrix, 0) // Right vector
      up.setFromMatrixColumn(camera.matrix, 1) // Up vector

      // Calculate pan offset in world space (reversed: mouse left = camera right, mouse up = camera down)
      const panX = deltaX * panSpeed // Reversed: + instead of -
      const panY = -deltaY * panSpeed // Reversed: - instead of +

      // Pan both camera and target
      const offsetX = panX * right.x + panY * up.x
      const offsetY = panX * right.y + panY * up.y
      const offsetZ = panX * right.z + panY * up.z

      // Calculate new position
      let newCameraX = camera.position.x + offsetX
      let newCameraY = camera.position.y + offsetY
      let newCameraZ = camera.position.z + offsetZ

      // Apply movement limits
      const minZ = -500 // Limit Z negative to -500mm
      const minY = -200 // Limit Y negative to -200mm
      
      // Clamp camera position to limits
      newCameraZ = Math.max(minZ, newCameraZ)
      newCameraY = Math.max(minY, newCameraY)

      // Calculate actual offset after clamping
      const actualOffsetX = newCameraX - camera.position.x
      const actualOffsetY = newCameraY - camera.position.y
      const actualOffsetZ = newCameraZ - camera.position.z

      camera.position.x = newCameraX
      camera.position.y = newCameraY
      camera.position.z = newCameraZ

      // Update orbit target to maintain relative position (using actual offsets)
      const newTarget = {
        x: state.orbitTarget.x + actualOffsetX,
        y: state.orbitTarget.y + actualOffsetY,
        z: state.orbitTarget.z + actualOffsetZ,
      }

      // Update state
      setState({
        dragStart: { x: clientX, y: clientY },
        orbitTarget: newTarget
      })

      camera.lookAt(newTarget.x, newTarget.y, newTarget.z)
    },
    [cameraRef, isMenuOpen, setState, state.dragStart.x, state.dragStart.y, state.isDragging, state.orbitRadius, state.orbitTarget]
  )

  return { startDrag, move, end, wheel, middleClick, startPan, movePan }
}
