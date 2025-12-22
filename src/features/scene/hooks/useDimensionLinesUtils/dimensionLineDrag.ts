import { useCallback, useRef } from "react"
import * as THREE from "three"
import type { DimensionLineId, DimensionLineType } from "./dimensionLineState"
import { parseDimensionLineId, getDragAxisForView, canDragInView } from "./dimensionLineState"

/**
 * Metadata stored in dimension line group's userData
 */
export interface DimensionLineUserData {
  isDimensionLine: true
  dimensionLineId: DimensionLineId
  dimensionLineType: DimensionLineType
}

/**
 * Type guard to check if userData contains dimension line metadata
 */
export function isDimensionLineGroup(obj: THREE.Object3D): boolean {
  const userData = obj.userData as Partial<DimensionLineUserData>
  return userData?.isDimensionLine === true && typeof userData?.dimensionLineId === "string"
}

/**
 * Get dimension line ID from a Three.js object
 */
export function getDimensionLineId(obj: THREE.Object3D): DimensionLineId | null {
  const userData = obj.userData as Partial<DimensionLineUserData>
  if (userData?.isDimensionLine && userData?.dimensionLineId) {
    return userData.dimensionLineId
  }
  return null
}

/**
 * Get dimension line type from a Three.js object
 */
export function getDimensionLineType(obj: THREE.Object3D): DimensionLineType | null {
  const userData = obj.userData as Partial<DimensionLineUserData>
  if (userData?.isDimensionLine && userData?.dimensionLineType) {
    return userData.dimensionLineType
  }
  // Try to parse from ID as fallback
  if (userData?.dimensionLineId) {
    const parsed = parseDimensionLineId(userData.dimensionLineId)
    return parsed?.type ?? null
  }
  return null
}

/**
 * Set dimension line metadata on a Three.js group
 */
export function setDimensionLineMetadata(
  group: THREE.Group,
  id: DimensionLineId,
  type: DimensionLineType
): void {
  const userData: DimensionLineUserData = {
    isDimensionLine: true,
    dimensionLineId: id,
    dimensionLineType: type,
  }
  group.userData = { ...group.userData, ...userData }
}

/**
 * Drag state for tracking mouse movements
 */
interface DragState {
  isDragging: boolean
  startPosition: THREE.Vector2
  currentId: DimensionLineId | null
  currentType: DimensionLineType | null
  currentAxis: "x" | "y" | "z" | null
  accumulatedDelta: number
}

/**
 * Options for the dimension line drag hook
 */
export interface UseDimensionLineDragOptions {
  sceneRef: React.MutableRefObject<THREE.Scene | null>
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>
  orthoCameraRef?: React.MutableRefObject<THREE.OrthographicCamera | null>
  isOrthoActiveRef?: React.MutableRefObject<boolean>
  cameraViewMode: "x" | "y" | "z" | null
  onDragStart?: (id: DimensionLineId) => void
  onDrag?: (id: DimensionLineId, axis: "x" | "y" | "z", delta: number) => void
  onDragEnd?: (id: DimensionLineId, axis: "x" | "y" | "z", totalDelta: number) => void
  onClick?: (id: DimensionLineId) => void
}

/**
 * Hook for handling dimension line dragging in orthographic views
 */
export function useDimensionLineDrag(options: UseDimensionLineDragOptions) {
  const {
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    cameraViewMode,
    onDragStart,
    onDrag,
    onDragEnd,
    onClick,
  } = options

  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startPosition: new THREE.Vector2(),
    currentId: null,
    currentType: null,
    currentAxis: null,
    accumulatedDelta: 0,
  })

  const raycaster = useRef(new THREE.Raycaster())

  /**
   * Get the active camera (ortho or perspective)
   */
  const getActiveCamera = useCallback((): THREE.Camera | null => {
    if (isOrthoActiveRef?.current && orthoCameraRef?.current) {
      return orthoCameraRef.current
    }
    return cameraRef.current
  }, [cameraRef, orthoCameraRef, isOrthoActiveRef])

  /**
   * Find dimension line at screen position using raycasting
   */
  const findDimensionLineAt = useCallback(
    (screenX: number, screenY: number): { id: DimensionLineId; type: DimensionLineType } | null => {
      const scene = sceneRef.current
      const camera = getActiveCamera()
      if (!scene || !camera) return null

      // Convert screen coordinates to normalized device coordinates
      const rect = (camera as THREE.PerspectiveCamera).userData.canvas?.getBoundingClientRect()
      const x = rect
        ? ((screenX - rect.left) / rect.width) * 2 - 1
        : (screenX / window.innerWidth) * 2 - 1
      const y = rect
        ? -((screenY - rect.top) / rect.height) * 2 + 1
        : -(screenY / window.innerHeight) * 2 + 1

      raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera)

      // Increase raycaster threshold for lines (they're thin and hard to click)
      raycaster.current.params.Line = { threshold: 20 }

      // Get all objects in scene
      const intersects = raycaster.current.intersectObjects(scene.children, true)

      for (const intersect of intersects) {
        // Walk up the parent chain to find dimension line group
        let obj: THREE.Object3D | null = intersect.object
        while (obj) {
          if (isDimensionLineGroup(obj)) {
            const id = getDimensionLineId(obj)
            const type = getDimensionLineType(obj)
            if (id && type) {
              return { id, type }
            }
          }
          obj = obj.parent
        }
      }

      return null
    },
    [sceneRef, getActiveCamera]
  )

  /**
   * Calculate drag delta in world units based on mouse movement and drag axis
   * Maps screen movement to the correct world axis based on camera view
   */
  const calculateDragDelta = useCallback(
    (
      currentScreenPos: THREE.Vector2,
      previousScreenPos: THREE.Vector2,
      dragAxis: "x" | "y" | "z"
    ): number => {
      const camera = getActiveCamera()
      if (!camera) return 0

      // In orthographic view, we can directly convert screen delta to world delta
      if (camera instanceof THREE.OrthographicCamera) {
        const screenDeltaX = currentScreenPos.x - previousScreenPos.x
        const screenDeltaY = currentScreenPos.y - previousScreenPos.y

        // Calculate world units per pixel based on camera frustum
        const viewWidth = camera.right - camera.left
        const viewHeight = camera.top - camera.bottom
        const pixelsPerUnitX = window.innerWidth / viewWidth
        const pixelsPerUnitY = window.innerHeight / viewHeight

        // Map screen movement to world axis based on current view
        // Screen Y is inverted (increases downward, world Y increases upward)
        switch (cameraViewMode) {
          case "x":
            // X view (camera at +X looking -X): sees YZ plane
            // Screen vertical (Y) → World Y (inverted)
            // Screen horizontal (X) → World Z (inverted, right is -Z)
            if (dragAxis === "y") return -screenDeltaY / pixelsPerUnitY
            if (dragAxis === "z") return -screenDeltaX / pixelsPerUnitX
            return 0 // X axis goes into screen, can't drag
            
          case "y":
            // Y view (camera at +Z looking -Z): sees XY plane
            // Screen horizontal (X) → World X
            // Screen vertical (Y) → World Y (inverted)
            if (dragAxis === "x") return screenDeltaX / pixelsPerUnitX
            if (dragAxis === "y") return -screenDeltaY / pixelsPerUnitY
            return 0 // Z axis goes into screen, can't drag
            
          case "z":
            // Z view (camera at +Y looking -Y): sees XZ plane
            // Screen horizontal (X) → World X
            // Screen vertical (Y) → World Z (down on screen is +Z into room)
            if (dragAxis === "x") return screenDeltaX / pixelsPerUnitX
            if (dragAxis === "z") return screenDeltaY / pixelsPerUnitY
            return 0 // Y axis goes into screen, can't drag
            
          default:
            return 0
        }
      }

      return 0
    },
    [getActiveCamera, cameraViewMode]
  )

  /**
   * Handle pointer down - check if clicking on a dimension line
   */
  const handlePointerDown = useCallback(
    (event: PointerEvent): boolean => {
      // Only handle in orthographic views for dragging
      if (!cameraViewMode) return false

      const found = findDimensionLineAt(event.clientX, event.clientY)
      if (!found) return false

      // Check if this dimension line can be dragged in current view
      if (!canDragInView(found.type, cameraViewMode)) {
        // Still allow click for selection
        onClick?.(found.id)
        return true
      }

      // Get the drag axis for this view
      const dragAxis = getDragAxisForView(found.type, cameraViewMode)
      if (!dragAxis) {
        onClick?.(found.id)
        return true
      }

      dragStateRef.current = {
        isDragging: true,
        startPosition: new THREE.Vector2(event.clientX, event.clientY),
        currentId: found.id,
        currentType: found.type,
        currentAxis: dragAxis,
        accumulatedDelta: 0,
      }

      onDragStart?.(found.id)
      return true
    },
    [cameraViewMode, findDimensionLineAt, onDragStart, onClick]
  )

  /**
   * Handle pointer move - update drag if active
   */
  const handlePointerMove = useCallback(
    (event: PointerEvent): boolean => {
      const state = dragStateRef.current
      if (!state.isDragging || !state.currentId || !state.currentType || !state.currentAxis) return false

      const currentPos = new THREE.Vector2(event.clientX, event.clientY)
      const delta = calculateDragDelta(
        currentPos,
        state.startPosition,
        state.currentAxis
      )

      if (Math.abs(delta) > 0.1) {
        state.accumulatedDelta += delta
        state.startPosition.copy(currentPos)
        onDrag?.(state.currentId, state.currentAxis, delta)
      }

      return true
    },
    [calculateDragDelta, onDrag]
  )

  /**
   * Handle pointer up - end drag
   */
  const handlePointerUp = useCallback(
    (_event: PointerEvent): boolean => {
      const state = dragStateRef.current
      if (!state.isDragging) return false

      const wasDragging = Math.abs(state.accumulatedDelta) > 1 // Threshold for considering it a drag vs click

      if (state.currentId && state.currentAxis) {
        if (wasDragging) {
          onDragEnd?.(state.currentId, state.currentAxis, state.accumulatedDelta)
        } else {
          // It was a click, not a drag
          onClick?.(state.currentId)
        }
      }

      dragStateRef.current = {
        isDragging: false,
        startPosition: new THREE.Vector2(),
        currentId: null,
        currentType: null,
        currentAxis: null,
        accumulatedDelta: 0,
      }

      return wasDragging
    },
    [onDragEnd, onClick]
  )

  /**
   * Check if dimension line at position can be dragged
   */
  const canDragAt = useCallback(
    (screenX: number, screenY: number): boolean => {
      if (!cameraViewMode) return false

      const found = findDimensionLineAt(screenX, screenY)
      if (!found) return false

      return canDragInView(found.type, cameraViewMode)
    },
    [cameraViewMode, findDimensionLineAt]
  )

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    findDimensionLineAt,
    canDragAt,
    isDragging: dragStateRef.current.isDragging,
  }
}

export type DimensionLineDragHook = ReturnType<typeof useDimensionLineDrag>
