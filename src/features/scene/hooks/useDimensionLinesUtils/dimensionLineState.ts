import { useCallback, useRef, useState } from "react"

/**
 * Types of dimension lines that can be identified
 */
export type DimensionLineType =
  | "width" // X-axis dimension
  | "height" // Y-axis dimension
  | "depth" // Z-axis dimension
  | "kicker" // Kicker height dimension
  | "overall-width" // Overall width across all cabinets
  | "overall-height" // Overall height for a view
  | "base-tall-width" // Overall width for base/tall only
  | "empty-x" // Empty space in X direction
  | "empty-y" // Empty space in Y direction

/**
 * Unique identifier for a dimension line
 * Format: `{type}-{cabinetId}` for cabinet-specific dims
 *         `{type}-{viewId}` for view-specific dims
 *         `{type}-overall` for scene-wide dims
 */
export type DimensionLineId = string

/**
 * Generates a unique dimension line ID
 */
export function createDimensionLineId(
  type: DimensionLineType,
  entityId: string
): DimensionLineId {
  return `${type}-${entityId}`
}

/**
 * Parses a dimension line ID to extract type and entity
 */
export function parseDimensionLineId(id: DimensionLineId): {
  type: DimensionLineType
  entityId: string
} | null {
  const match = id.match(/^([\w-]+)-(.+)$/)
  if (!match) return null
  return {
    type: match[1] as DimensionLineType,
    entityId: match[2],
  }
}

/**
 * Gets the drag axis for a dimension line type in a specific view
 * Returns the perpendicular axis that is VISIBLE in the current view
 */
export function getDragAxisForView(
  type: DimensionLineType,
  cameraViewMode: "x" | "y" | "z"
): "x" | "y" | "z" | null {
  // Get the measurement axis of the dimension
  // Width measures X, Height measures Y, Depth measures Z
  // The drag axis must be perpendicular to measurement AND visible in view
  
  switch (type) {
    case "width":
    case "overall-width":
    case "base-tall-width":
    case "empty-x":
      // Width measures X. Perpendicular: Y, Z
      // Y view (sees XY): use Y
      // X view (sees YZ): use Y (both visible, prefer Y)
      // Z view (sees XZ): use Z (Y not visible)
      return cameraViewMode === "z" ? "z" : "y"
      
    case "height":
    case "kicker":
    case "overall-height":
    case "empty-y":
      // Height measures Y. Perpendicular: X, Z
      // Y view (sees XY): use X
      // X view (sees YZ): use Z (X not visible)
      // Z view (sees XZ): use X
      return cameraViewMode === "x" ? "z" : "x"
      
    case "depth":
      // Depth measures Z. Perpendicular: X, Y
      // Y view (sees XY): use Y (both visible, prefer Y for consistency)
      // X view (sees YZ): use Y
      // Z view (sees XZ): use X (Y not visible)
      return cameraViewMode === "z" ? "x" : "y"
      
    default:
      return null
  }
}

/**
 * Gets the drag axis for a dimension line type (legacy - returns primary axis)
 * Returns the axis along which the dimension line can be dragged
 */
export function getDragAxis(
  type: DimensionLineType
): "x" | "y" | "z" | null {
  switch (type) {
    case "height":
    case "kicker":
    case "overall-height":
    case "empty-y":
      // Height dimensions have extension lines in X direction
      return "x"
    case "width":
    case "depth":
    case "overall-width":
    case "base-tall-width":
    case "empty-x":
      // Width/depth dimensions have extension lines in Y direction
      return "y"
    default:
      return null
  }
}

/**
 * Checks if a dimension line can be dragged in the current camera view
 * A drag axis must be VISIBLE on screen to allow dragging
 */
export function canDragInView(
  type: DimensionLineType,
  cameraViewMode: "x" | "y" | "z" | null
): boolean {
  if (!cameraViewMode) return false // No dragging in perspective view

  // Use the view-dependent drag axis - if we can get one, we can drag
  const dragAxis = getDragAxisForView(type, cameraViewMode)
  return dragAxis !== null
}

/**
 * 3D offset for dimension line positioning
 * Each axis stores the offset in that direction (in mm)
 */
export interface DimensionLineOffset3D {
  x: number
  y: number
  z: number
}

/**
 * State for a single dimension line
 */
export interface DimensionLineState {
  hidden: boolean
  offset: DimensionLineOffset3D // Custom offset from default position (in mm)
}

/**
 * Complete state for all dimension lines
 */
export interface DimensionLinesState {
  lines: Map<DimensionLineId, DimensionLineState>
  selectedId: DimensionLineId | null
}

/**
 * Default state for a dimension line
 */
const defaultLineState: DimensionLineState = {
  hidden: false,
  offset: { x: 0, y: 0, z: 0 },
}

/**
 * Creates the initial dimension lines state
 */
function createInitialState(): DimensionLinesState {
  return {
    lines: new Map(),
    selectedId: null,
  }
}

/**
 * Hook for managing dimension line state
 * Handles visibility, custom offsets, and selection
 */
export function useDimensionLineState() {
  const [state, setState] = useState<DimensionLinesState>(createInitialState)
  const stateRef = useRef<DimensionLinesState>(state)
  stateRef.current = state

  /**
   * Get state for a specific dimension line
   */
  const getLineState = useCallback(
    (id: DimensionLineId): DimensionLineState => {
      return stateRef.current.lines.get(id) ?? { ...defaultLineState }
    },
    []
  )

  /**
   * Check if a dimension line is hidden
   */
  const isHidden = useCallback(
    (id: DimensionLineId): boolean => {
      return getLineState(id).hidden
    },
    [getLineState]
  )

  /**
   * Get the custom offset for a dimension line (returns full 3D offset)
   */
  const getOffset = useCallback(
    (id: DimensionLineId): DimensionLineOffset3D => {
      return getLineState(id).offset
    },
    [getLineState]
  )

  /**
   * Select a dimension line
   */
  const select = useCallback((id: DimensionLineId | null) => {
    setState((prev) => ({
      ...prev,
      selectedId: id,
    }))
  }, [])

  /**
   * Toggle selection of a dimension line
   */
  const toggleSelect = useCallback((id: DimensionLineId) => {
    setState((prev) => ({
      ...prev,
      selectedId: prev.selectedId === id ? null : id,
    }))
  }, [])

  /**
   * Hide a dimension line
   */
  const hide = useCallback((id: DimensionLineId) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      const lineState = newLines.get(id) ?? { ...defaultLineState }
      newLines.set(id, { ...lineState, hidden: true })
      return {
        ...prev,
        lines: newLines,
        selectedId: prev.selectedId === id ? null : prev.selectedId,
      }
    })
  }, [])

  /**
   * Show a hidden dimension line
   */
  const show = useCallback((id: DimensionLineId) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      const lineState = newLines.get(id) ?? { ...defaultLineState }
      newLines.set(id, { ...lineState, hidden: false })
      return {
        ...prev,
        lines: newLines,
      }
    })
  }, [])

  /**
   * Toggle visibility of a dimension line
   */
  const toggleVisibility = useCallback((id: DimensionLineId) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      const lineState = newLines.get(id) ?? { ...defaultLineState }
      const newHidden = !lineState.hidden
      newLines.set(id, { ...lineState, hidden: newHidden })
      return {
        ...prev,
        lines: newLines,
        selectedId: newHidden && prev.selectedId === id ? null : prev.selectedId,
      }
    })
  }, [])

  /**
   * Set custom offset for a dimension line (full 3D offset)
   */
  const setOffset = useCallback((id: DimensionLineId, offset: DimensionLineOffset3D) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      const lineState = newLines.get(id) ?? { ...defaultLineState }
      newLines.set(id, { ...lineState, offset })
      return {
        ...prev,
        lines: newLines,
      }
    })
  }, [])

  /**
   * Add to a specific axis of the offset (for incremental dragging)
   */
  const addOffsetAxis = useCallback((id: DimensionLineId, axis: "x" | "y" | "z", delta: number) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      const lineState = newLines.get(id) ?? { ...defaultLineState }
      const newOffset = { ...lineState.offset }
      newOffset[axis] += delta
      newLines.set(id, { ...lineState, offset: newOffset })
      return {
        ...prev,
        lines: newLines,
      }
    })
  }, [])

  /**
   * Reset a single dimension line to default state
   */
  const resetLine = useCallback((id: DimensionLineId) => {
    setState((prev) => {
      const newLines = new Map(prev.lines)
      newLines.delete(id)
      return {
        ...prev,
        lines: newLines,
        selectedId: prev.selectedId === id ? null : prev.selectedId,
      }
    })
  }, [])

  /**
   * Reset all dimension lines to default state
   */
  const resetAll = useCallback(() => {
    setState(createInitialState())
  }, [])

  /**
   * Get all hidden dimension line IDs
   */
  const getHiddenIds = useCallback((): DimensionLineId[] => {
    const hidden: DimensionLineId[] = []
    stateRef.current.lines.forEach((lineState, id) => {
      if (lineState.hidden) {
        hidden.push(id)
      }
    })
    return hidden
  }, [])

  /**
   * Check if any dimension lines have been modified (hidden or offset)
   */
  const hasModifications = useCallback((): boolean => {
    const values = Array.from(stateRef.current.lines.values())
    for (const lineState of values) {
      const hasOffset = lineState.offset.x !== 0 || lineState.offset.y !== 0 || lineState.offset.z !== 0
      if (lineState.hidden || hasOffset) {
        return true
      }
    }
    return false
  }, [])

  return {
    // State
    selectedId: state.selectedId,
    
    // Getters
    getLineState,
    isHidden,
    getOffset,
    getHiddenIds,
    hasModifications,
    
    // Selection
    select,
    toggleSelect,
    
    // Visibility
    hide,
    show,
    toggleVisibility,
    
    // Offset
    setOffset,
    addOffsetAxis,
    
    // Reset
    resetLine,
    resetAll,
  }
}

export type DimensionLineStateHook = ReturnType<typeof useDimensionLineState>
