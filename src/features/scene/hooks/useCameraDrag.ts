import { useCallback, useEffect, useState, type MutableRefObject } from "react"
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
  orbitTarget: { x: number; y: number; z: number }
}

export type WallDims = { height: number; length: number }

export type OrthoControls = {
  isOrthoActiveRef: MutableRefObject<boolean>
  zoomOrthoCamera: (delta: number) => void
  panOrthoCamera: (deltaX: number, deltaY: number) => void
}

export const useCameraDrag = (
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>,
  wallDimensions: WallDims,
  isMenuOpen: boolean,
  cameraMode: "constrained" | "free",
  orthoControls?: OrthoControls
) => {
  const movementSensitivity = 1.5
  const [state, setState] = useState<DragState>(() => ({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    zoomLevel: 1.5,
    orbitRadius: wallDimensions.length * 1.5,
    orbitTheta: 0,
    orbitPhi: Math.PI / 3,
    orbitTarget: {
      x: wallDimensions.length / 2,
      y: wallDimensions.height / 2,
      z: -WALL_THICKNESS / 2,
    },
  }))

  useEffect(() => {
    if (isMenuOpen && state.isDragging) {
      setState((prev) => ({ ...prev, isDragging: false }))
    }
  }, [isMenuOpen, state.isDragging])

  const updateCameraFromOrbit = useCallback(
    (
      theta: number,
      phi: number,
      radius: number,
      target?: { x: number; y: number; z: number }
    ) => {
      const camera = cameraRef.current
      if (!camera) return

      const targetX = target?.x ?? wallDimensions.length / 2
      const targetY = target?.y ?? wallDimensions.height / 2
      const targetZ = target?.z ?? -WALL_THICKNESS / 2

      let x = targetX + radius * Math.sin(phi) * Math.cos(theta)
      let y = targetY + radius * Math.cos(phi)
      let z = targetZ + radius * Math.sin(phi) * Math.sin(theta)

      const minZ = -500
      const minY = -200
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

      // In ortho mode or free mode, store raw pixel coordinates
      if (cameraMode === "free" || orthoControls?.isOrthoActiveRef.current) {
        setState((prev) => ({
          ...prev,
          isDragging: true,
          dragStart: { x: clientX, y: clientY },
        }))
      } else {
        // In constrained mode with perspective camera, store normalized coordinates
        setState((prev) => ({
          ...prev,
          isDragging: true,
          dragStart: {
            x: clientX / window.innerWidth,
            y: 1 - clientY / window.innerHeight,
          },
          cameraStart: {
            x: cameraRef.current!.position.x,
            y: cameraRef.current!.position.y,
          },
        }))
      }
    },
    [cameraRef, cameraMode, isMenuOpen, orthoControls?.isOrthoActiveRef]
  )

  const move = useCallback(
    (clientX: number, clientY: number) => {
      if (isMenuOpen || !state.isDragging) return

      // Handle ortho camera pan
      if (orthoControls?.isOrthoActiveRef.current) {
        const deltaX = clientX - state.dragStart.x
        const deltaY = clientY - state.dragStart.y
        orthoControls.panOrthoCamera(deltaX, deltaY)
        setState((prev) => ({
          ...prev,
          dragStart: { x: clientX, y: clientY },
        }))
        return
      }

      const camera = cameraRef.current
      if (!camera) return

      if (cameraMode === "free") {
        const deltaX = clientX - state.dragStart.x
        const deltaY = clientY - state.dragStart.y
        const rotateSpeed = 0.005

        const newTheta = state.orbitTheta + deltaX * rotateSpeed
        const newPhi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, state.orbitPhi - deltaY * rotateSpeed)
        )

        setState((prev) => ({
          ...prev,
          orbitTheta: newTheta,
          orbitPhi: newPhi,
          dragStart: { x: clientX, y: clientY },
        }))

        updateCameraFromOrbit(
          newTheta,
          newPhi,
          state.orbitRadius,
          state.orbitTarget
        )
      } else {
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
    [
      cameraRef,
      cameraMode,
      isMenuOpen,
      movementSensitivity,
      orthoControls,
      state.cameraStart.x,
      state.cameraStart.y,
      state.dragStart.x,
      state.dragStart.y,
      state.isDragging,
      state.orbitPhi,
      state.orbitRadius,
      state.orbitTarget,
      state.orbitTheta,
      wallDimensions.height,
      wallDimensions.length,
      updateCameraFromOrbit,
    ]
  )

  const end = useCallback(() => {
    setState((prev) => ({ ...prev, isDragging: false }))
  }, [])

  const wheel = useCallback(
    (deltaY: number) => {
      if (isMenuOpen) {
        setState((prev) => ({ ...prev, isDragging: false }))
        return
      }

      // Handle ortho camera zoom
      if (orthoControls?.isOrthoActiveRef.current) {
        orthoControls.zoomOrthoCamera(deltaY)
        return
      }

      const camera = cameraRef.current
      if (!camera) return

      if (cameraMode === "free") {
        const zoomSpeed = wallDimensions.length * 0.1
        const minRadius = wallDimensions.length * 0.5
        const maxRadius = wallDimensions.length * 5

        const newRadius =
          deltaY > 0
            ? Math.min(maxRadius, state.orbitRadius + zoomSpeed)
            : Math.max(minRadius, state.orbitRadius - zoomSpeed)

        setState((prev) => ({ ...prev, orbitRadius: newRadius }))
        updateCameraFromOrbit(
          state.orbitTheta,
          state.orbitPhi,
          newRadius,
          state.orbitTarget
        )
      } else {
        const zoomSpeed = 0.1
        const minZoom = 0.3
        const maxZoom = 5
        const newZoom =
          deltaY > 0
            ? Math.min(maxZoom, state.zoomLevel + zoomSpeed)
            : Math.max(minZoom, state.zoomLevel - zoomSpeed)

        setState((prev) => ({ ...prev, zoomLevel: newZoom }))
        if (!state.isDragging) {
          const wallCenterZ = -WALL_THICKNESS / 2
          const cameraDistance = newZoom * wallDimensions.length
          const { x, y } = camera.position
          camera.position.set(x, y, wallCenterZ + cameraDistance)
          lookAtWallCenter(camera, wallDimensions)
        }
      }
    },
    [
      cameraRef,
      cameraMode,
      isMenuOpen,
      orthoControls,
      state.isDragging,
      state.orbitPhi,
      state.orbitRadius,
      state.orbitTarget,
      state.orbitTheta,
      state.zoomLevel,
      wallDimensions,
      updateCameraFromOrbit,
    ]
  )

  const middleClick = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    if (isMenuOpen) {
      setState((prev) => ({ ...prev, isDragging: false }))
      return
    }

    if (cameraMode === "free") {
      const defaultRadius = wallDimensions.length * 1.5
      const defaultTheta = 0
      const defaultPhi = Math.PI / 3
      const wallCenterTarget = {
        x: wallDimensions.length / 2,
        y: wallDimensions.height / 2,
        z: -WALL_THICKNESS / 2,
      }
      setState((prev) => ({
        ...prev,
        orbitRadius: defaultRadius,
        orbitTheta: defaultTheta,
        orbitPhi: defaultPhi,
        orbitTarget: wallCenterTarget,
      }))
      updateCameraFromOrbit(
        defaultTheta,
        defaultPhi,
        defaultRadius,
        wallCenterTarget
      )
    } else {
      setState((prev) => ({ ...prev, zoomLevel: 1.5 }))
      positionCamera(camera, wallDimensions, 1.5)
    }
  }, [cameraRef, cameraMode, isMenuOpen, wallDimensions, updateCameraFromOrbit])

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      if (!cameraRef.current) return
      if (isMenuOpen) return
      setState((prev) => ({
        ...prev,
        isDragging: true,
        dragStart: { x: clientX, y: clientY },
        cameraStart: {
          x: cameraRef.current!.position.x,
          y: cameraRef.current!.position.y,
        },
      }))
    },
    [cameraRef, isMenuOpen]
  )

  const movePan = useCallback(
    (clientX: number, clientY: number) => {
      const camera = cameraRef.current
      if (!camera) return
      if (isMenuOpen || !state.isDragging) return

      const deltaX = clientX - state.dragStart.x
      const deltaY = clientY - state.dragStart.y
      const distance = state.orbitRadius
      const panSpeed = distance * 0.001

      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      right.setFromMatrixColumn(camera.matrix, 0)
      up.setFromMatrixColumn(camera.matrix, 1)

      const panX = deltaX * panSpeed
      const panY = -deltaY * panSpeed

      const offsetX = panX * right.x + panY * up.x
      const offsetY = panX * right.y + panY * up.y
      const offsetZ = panX * right.z + panY * up.z

      let newCameraX = camera.position.x + offsetX
      let newCameraY = camera.position.y + offsetY
      let newCameraZ = camera.position.z + offsetZ

      const minZ = -500
      const minY = -200

      newCameraZ = Math.max(minZ, newCameraZ)
      newCameraY = Math.max(minY, newCameraY)

      const actualOffsetX = newCameraX - camera.position.x
      const actualOffsetY = newCameraY - camera.position.y
      const actualOffsetZ = newCameraZ - camera.position.z

      camera.position.x = newCameraX
      camera.position.y = newCameraY
      camera.position.z = newCameraZ

      const newTarget = {
        x: state.orbitTarget.x + actualOffsetX,
        y: state.orbitTarget.y + actualOffsetY,
        z: state.orbitTarget.z + actualOffsetZ,
      }

      setState((prev) => ({
        ...prev,
        dragStart: { x: clientX, y: clientY },
        orbitTarget: newTarget,
      }))

      camera.lookAt(newTarget.x, newTarget.y, newTarget.z)
    },
    [
      cameraRef,
      isMenuOpen,
      state.dragStart.x,
      state.dragStart.y,
      state.isDragging,
      state.orbitRadius,
      state.orbitTarget,
    ]
  )

  return {
    startDrag,
    move,
    end,
    wheel,
    middleClick,
    startPan,
    movePan,
    isDragging: state.isDragging,
    zoomLevel: state.zoomLevel,
  }
}
