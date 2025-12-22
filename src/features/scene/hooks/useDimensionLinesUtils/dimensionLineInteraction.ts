import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import {
  useDimensionLineState,
  type DimensionLineId,
} from "./dimensionLineState"
import {
  useDimensionLineDrag,
} from "./dimensionLineDrag"

/**
 * Options for the dimension line interaction hook
 */
export interface UseDimensionLineInteractionOptions {
  sceneRef: React.MutableRefObject<THREE.Scene | null>
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>
  orthoCameraRef?: React.MutableRefObject<THREE.OrthographicCamera | null>
  isOrthoActiveRef?: React.MutableRefObject<boolean>
  cameraViewMode: "x" | "y" | "z" | null
  /** Canvas element to attach event listeners to */
  canvasRef?: React.MutableRefObject<HTMLElement | null>
  /** Callback when dimension lines need to be redrawn */
  onNeedRedraw?: () => void
  /** Whether dimension line interactions are enabled */
  enabled?: boolean
}

/**
 * High-level hook that coordinates dimension line state and drag interactions
 * This is the main entry point for dimension line interaction features
 */
export function useDimensionLineInteraction(options: UseDimensionLineInteractionOptions) {
  const {
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    cameraViewMode,
    canvasRef,
    onNeedRedraw,
    enabled = true,
  } = options

  // State management
  const stateHook = useDimensionLineState()
  const {
    selectedId,
    select,
    toggleSelect,
    hide,
    show,
    isHidden,
    getOffset,
    addOffsetAxis,
    resetAll,
    hasModifications,
  } = stateHook

  // Track if we need to trigger a redraw
  const needsRedrawRef = useRef(false)

  /**
   * Request a redraw of dimension lines
   */
  const requestRedraw = useCallback(() => {
    needsRedrawRef.current = true
    onNeedRedraw?.()
  }, [onNeedRedraw])

  /**
   * Handle dimension line click - toggle selection
   */
  const handleDimLineClick = useCallback(
    (id: DimensionLineId) => {
      toggleSelect(id)
    },
    [toggleSelect]
  )

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(
    (id: DimensionLineId) => {
      select(id)
    },
    [select]
  )

  /**
   * Handle drag - update offset incrementally for the specific axis
   */
  const handleDrag = useCallback(
    (id: DimensionLineId, axis: "x" | "y" | "z", delta: number) => {
      addOffsetAxis(id, axis, delta)
      requestRedraw()
    },
    [addOffsetAxis, requestRedraw]
  )

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(
    (_id: DimensionLineId, _axis: "x" | "y" | "z", _totalDelta: number) => {
      // Offset is already updated during drag, nothing special needed here
    },
    []
  )

  // Drag handling
  const dragHook = useDimensionLineDrag({
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    cameraViewMode,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    onClick: handleDimLineClick,
  })

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    findDimensionLineAt,
    canDragAt,
  } = dragHook

  /**
   * Hide the currently selected dimension line
   */
  const hideSelected = useCallback(() => {
    if (selectedId) {
      hide(selectedId)
      requestRedraw()
    }
  }, [selectedId, hide, requestRedraw])

  /**
   * Show a hidden dimension line
   */
  const showLine = useCallback(
    (id: DimensionLineId) => {
      show(id)
      requestRedraw()
    },
    [show, requestRedraw]
  )

  /**
   * Reset all dimension lines to default state
   */
  const resetAllLines = useCallback(() => {
    resetAll()
    requestRedraw()
  }, [resetAll, requestRedraw])

  /**
   * Deselect the current dimension line
   */
  const deselect = useCallback(() => {
    select(null)
  }, [select])

  // Setup event listeners on canvas
  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef?.current
    if (!canvas) return

    // Track if we're currently interacting with a dimension line
    let isDimLineInteraction = false

    const onPointerDown = (e: PointerEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return

      // Check if we hit a dimension line first
      const found = findDimensionLineAt(e.clientX, e.clientY)
      if (!found) {
        // No dimension line hit, let other handlers process
        isDimLineInteraction = false
        return
      }

      isDimLineInteraction = true
      const handled = handlePointerDown(e)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDimLineInteraction) return

      const handled = handlePointerMove(e)
      if (handled) {
        e.preventDefault()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDimLineInteraction) return

      const handled = handlePointerUp(e)
      isDimLineInteraction = false
      if (handled) {
        e.preventDefault()
      }
    }

    // Use capture phase to intercept events before other handlers
    canvas.addEventListener("pointerdown", onPointerDown, { capture: true })
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true })
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [enabled, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, findDimensionLineAt])

  // Deselect when clicking outside dimension lines (handled by checking if drag started)
  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef?.current
    if (!canvas) return

    const onClick = (e: MouseEvent) => {
      // If click didn't hit a dimension line and we have one selected, deselect
      const found = findDimensionLineAt(e.clientX, e.clientY)
      if (!found && selectedId) {
        deselect()
      }
    }

    canvas.addEventListener("click", onClick)

    return () => {
      canvas.removeEventListener("click", onClick)
    }
  }, [enabled, canvasRef, findDimensionLineAt, selectedId, deselect])

  return {
    // State
    selectedId,
    hasModifications: hasModifications(),
    
    // State access
    isHidden,
    getOffset,
    
    // Actions
    hideSelected,
    showLine,
    resetAllLines,
    deselect,
    select,
    
    // Utilities
    canDragAt,
    findDimensionLineAt,
    
    // Raw hooks for advanced usage
    stateHook,
    dragHook,
  }
}

export type DimensionLineInteractionHook = ReturnType<typeof useDimensionLineInteraction>
