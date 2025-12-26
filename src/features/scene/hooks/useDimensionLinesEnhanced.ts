import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../types"
import type { ViewManager } from "../../cabinets/ViewManager"
import { WALL_THICKNESS } from "../lib/sceneUtils"
import { getCabinetHorizontalEdges } from "../utils/handlers/sharedCabinetUtils"
import {
  disposeGroup,
  type WallOffsetContext,
} from "./useDimensionLinesUtils/dimensionLineUtils"
import {
  wouldDimensionLinePenetrate,
  detectEmptySpacesY,
  detectEmptySpacesX,
} from "./useDimensionLinesUtils/dimensionLineDetection"
import {
  createWidthDimension,
  createHeightDimension,
  createKickerDimension,
  createDepthDimension,
  createOverallWidthDimensionEnhanced,
  createOverallHeightDimensionEnhanced,
  createBaseTallOverallWidthDimensionEnhanced,
  createEmptySpaceYDimensionEnhanced,
  createEmptySpaceXDimensionEnhanced,
  createBenchtopHeightFromFloorDimension,
  type DimensionLineOffsets,
} from "./useDimensionLinesUtils/dimensionLineCreatorsEnhanced"
import { useDimensionLineInteraction } from "./useDimensionLinesUtils/dimensionLineInteraction"

/**
 * Options for the enhanced dimension lines hook
 */
export interface UseDimensionLinesEnhancedOptions {
  sceneRef: React.MutableRefObject<THREE.Scene | null>
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>
  orthoCameraRef?: React.MutableRefObject<THREE.OrthographicCamera | null>
  isOrthoActiveRef?: React.MutableRefObject<boolean>
  canvasRef?: React.MutableRefObject<HTMLElement | null>
  cabinets: CabinetData[]
  visible?: boolean
  viewManager?: ViewManager
  wallDimensions?: WallDimensions
  cameraViewMode?: "x" | "y" | "z" | null
}

/**
 * Enhanced hook for managing dimension lines with interaction support
 * Supports dragging dimension lines in orthographic views and hiding/showing them
 */
export function useDimensionLinesEnhanced(options: UseDimensionLinesEnhancedOptions) {
  const {
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    canvasRef,
    cabinets,
    visible = true,
    viewManager,
    wallDimensions,
    cameraViewMode,
  } = options

  const dimensionLinesRef = useRef<THREE.Group[]>([])
  const redrawTriggerRef = useRef(0)

  // Create wall offset context
  const getWallOffsetContext = useCallback(
    (): WallOffsetContext => ({
      leftWallVisible: wallDimensions?.leftWallVisible,
      rightWallVisible: wallDimensions?.rightWallVisible,
      backWallLength: wallDimensions?.backWallLength,
      length: wallDimensions?.length,
      wallThickness: WALL_THICKNESS,
    }),
    [wallDimensions]
  )

  // Trigger redraw
  const triggerRedraw = useCallback(() => {
    redrawTriggerRef.current += 1
  }, [])

  // Interaction hook for selection, dragging, and visibility
  const interaction = useDimensionLineInteraction({
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    cameraViewMode: cameraViewMode ?? null,
    canvasRef,
    onNeedRedraw: triggerRedraw,
    enabled: visible && !!cameraViewMode, // Only enable in ortho views
  })

  // Create offsets interface for creators
  const offsets: DimensionLineOffsets = {
    getOffset: interaction.getOffset,
    isHidden: interaction.isHidden,
  }

  /**
   * Update dimension lines for all cabinets
   */
  const updateDimensionLines = useCallback(() => {
    if (!sceneRef.current) return

    // Clear existing dimension lines
    dimensionLinesRef.current.forEach((group) => {
      sceneRef.current!.remove(group)
      disposeGroup(group)
    })
    dimensionLinesRef.current = []

    // If not visible, don't create dimension lines
    if (!visible) return

    const wallOffsetContext = getWallOffsetContext()

    // Helper to check if a cabinet is a child product (should be skipped for dimension lines)
    const isChildProduct = (cabinet: CabinetData): boolean => {
      if (cabinet.cabinetType === "kicker") return true
      if (cabinet.cabinetType === "bulkhead") return true
      // Only child benchtops (with parent) are skipped; independent benchtops get dimension lines
      if (cabinet.cabinetType === "benchtop" && cabinet.benchtopParentCabinetId) return true
      if (cabinet.cabinetType === "underPanel") return true
      if ((cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel") && cabinet.hideLockIcons === true) return true
      return false
    }

    // Helper to check if a cabinet is an independent benchtop
    const isIndependentBenchtop = (cabinet: CabinetData): boolean => {
      return cabinet.cabinetType === "benchtop" && !cabinet.benchtopParentCabinetId
    }

    // Group cabinets by height to determine which should show height dimension
    const cabinetsByHeight = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      if (isChildProduct(cabinet)) return
      const height = cabinet.carcass.dimensions.height
      if (!cabinetsByHeight.has(height)) {
        cabinetsByHeight.set(height, [])
      }
      cabinetsByHeight.get(height)!.push(cabinet)
    })

    // Find selected cabinet for each height
    const selectedByHeight = new Map<number, string>()
    cabinetsByHeight.forEach((cabs, height) => {
      const leftmost = cabs.reduce((prev, curr) =>
        curr.group.position.x < prev.group.position.x ? curr : prev
      )

      if (wouldDimensionLinePenetrate(leftmost, cabinets, 50)) {
        const rightmost = cabs.reduce((prev, curr) =>
          curr.group.position.x > prev.group.position.x ? curr : prev
        )
        selectedByHeight.set(height, rightmost.cabinetId)
      } else {
        selectedByHeight.set(height, leftmost.cabinetId)
      }
    })

    // Group cabinets by depth
    const cabinetsByDepth = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      if (isChildProduct(cabinet)) return
      const depth = cabinet.carcass.dimensions.depth
      if (!cabinetsByDepth.has(depth)) {
        cabinetsByDepth.set(depth, [])
      }
      cabinetsByDepth.get(depth)!.push(cabinet)
    })

    // Find selected cabinet for each depth
    const selectedByDepth = new Map<number, string>()
    cabinetsByDepth.forEach((cabs, depth) => {
      const leftmost = cabs.reduce((prev, curr) =>
        curr.group.position.x < prev.group.position.x ? curr : prev
      )

      if (wouldDimensionLinePenetrate(leftmost, cabinets, 50)) {
        const rightmost = cabs.reduce((prev, curr) =>
          curr.group.position.x > prev.group.position.x ? curr : prev
        )
        selectedByDepth.set(depth, rightmost.cabinetId)
      } else {
        selectedByDepth.set(depth, leftmost.cabinetId)
      }
    })

    // Group cabinets by kicker height
    const cabinetsByKickerHeight = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        const kickerHeight = cabinet.group.position.y
        if (!cabinetsByKickerHeight.has(kickerHeight)) {
          cabinetsByKickerHeight.set(kickerHeight, [])
        }
        cabinetsByKickerHeight.get(kickerHeight)!.push(cabinet)
      }
    })

    // Find leftmost cabinet for each kicker height
    const selectedByKickerHeight = new Map<number, string>()
    cabinetsByKickerHeight.forEach((cabs, kickerHeight) => {
      const leftmost = cabs.reduce((prev, curr) =>
        curr.group.position.x < prev.group.position.x ? curr : prev
      )
      selectedByKickerHeight.set(kickerHeight, leftmost.cabinetId)
    })

    // Helper to add dimension group if not null
    const addDimensionGroup = (group: THREE.Group | null) => {
      if (group && sceneRef.current) {
        sceneRef.current.add(group)
        dimensionLinesRef.current.push(group)
      }
    }

    // Create dimension lines for each cabinet
    cabinets.forEach((cabinet) => {
      // Skip all child products - they follow their parent and shouldn't have independent dimension lines
      if (isChildProduct(cabinet)) return

      const height = cabinet.carcass.dimensions.height
      const depth = cabinet.carcass.dimensions.depth
      const isSelectedForHeight = selectedByHeight.get(height) === cabinet.cabinetId
      const isSelectedForDepth = selectedByDepth.get(depth) === cabinet.cabinetId

      let isSelectedForKickerHeight = false
      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        const kickerHeight = cabinet.group.position.y
        isSelectedForKickerHeight = selectedByKickerHeight.get(kickerHeight) === cabinet.cabinetId
      }

      // Determine visibility based on camera view mode
      let showWidth = true
      let showHeightDim = isSelectedForHeight
      let showDepthDim = isSelectedForDepth
      let showKickerHeightDim = isSelectedForKickerHeight

      if (cameraViewMode === "x") {
        showWidth = false
        showKickerHeightDim = isSelectedForKickerHeight
      } else if (cameraViewMode === "y") {
        showDepthDim = false
        showKickerHeightDim = isSelectedForKickerHeight
      } else if (cameraViewMode === "z") {
        showHeightDim = false
        showKickerHeightDim = false
      }

      // Create individual dimension lines with metadata
      if (showWidth) {
        addDimensionGroup(createWidthDimension(cabinet, wallOffsetContext, offsets))
      }

      if (showHeightDim) {
        addDimensionGroup(createHeightDimension(cabinet, wallOffsetContext, cabinets, offsets))
      }

      if (showKickerHeightDim) {
        addDimensionGroup(createKickerDimension(cabinet, wallOffsetContext, offsets))
      }

      if (showDepthDim) {
        addDimensionGroup(createDepthDimension(cabinet, wallOffsetContext, offsets))
      }

      // Add height from floor dimension for independent benchtops
      if (isIndependentBenchtop(cabinet) && cameraViewMode !== "z") {
        addDimensionGroup(createBenchtopHeightFromFloorDimension(cabinet, offsets))
      }
    })

    // Create overall width dimension line - hide in X view
    if (cameraViewMode !== "x") {
      addDimensionGroup(createOverallWidthDimensionEnhanced(cabinets, offsets))

      // Check if we need additional overall width dimension for base/tall only
      const hasTopCabinets = cabinets.some((c) => c.cabinetType === "top")

      if (hasTopCabinets) {
        let allMinX = Infinity
        let allMaxX = -Infinity
        cabinets.forEach((cabinet) => {
          // Skip all child products
          if (isChildProduct(cabinet)) return
          const { left, right } = getCabinetHorizontalEdges(cabinet)
          allMinX = Math.min(allMinX, left)
          allMaxX = Math.max(allMaxX, right)
        })
        const overallWidthAll = allMaxX - allMinX

        const baseTallCabinets = cabinets.filter(
          (c) => c.cabinetType === "base" || c.cabinetType === "tall"
        )
        let baseTallMinX = Infinity
        let baseTallMaxX = -Infinity
        baseTallCabinets.forEach((cabinet) => {
          const { left, right } = getCabinetHorizontalEdges(cabinet)
          baseTallMinX = Math.min(baseTallMinX, left)
          baseTallMaxX = Math.max(baseTallMaxX, right)
        })
        const overallWidthBaseTall = baseTallMaxX - baseTallMinX

        if (Math.abs(overallWidthAll - overallWidthBaseTall) > 0.1) {
          addDimensionGroup(createBaseTallOverallWidthDimensionEnhanced(cabinets, offsets))
        }
      }
    }

    // Create overall height dimension for each view - hide in Z view
    if (viewManager && cameraViewMode !== "z") {
      const heightDimensions = createOverallHeightDimensionEnhanced(
        cabinets,
        viewManager,
        wallDimensions,
        offsets
      )
      heightDimensions.forEach(addDimensionGroup)
    }

    // Create dimension lines for empty spaces
    if (viewManager) {
      // Y-axis empty spaces - hide in Z view
      if (cameraViewMode !== "z") {
        const emptySpacesY = detectEmptySpacesY(cabinets, viewManager)

        const heightGroups = new Map<number, typeof emptySpacesY>()
        const SIMILAR_HEIGHT_TOLERANCE = 1

        emptySpacesY.forEach((space) => {
          let foundGroup = false
          for (const [groupHeight, spaces] of Array.from(heightGroups.entries())) {
            if (Math.abs(space.height - groupHeight) <= SIMILAR_HEIGHT_TOLERANCE) {
              spaces.push(space)
              foundGroup = true
              break
            }
          }

          if (!foundGroup) {
            heightGroups.set(space.height, [space])
          }
        })

        let emptyYIndex = 0
        heightGroups.forEach((spaces) => {
          const leftmostSpace = spaces.reduce((prev, curr) =>
            curr.leftmostX < prev.leftmostX ? curr : prev
          )

          const viewCabinetIds = viewManager.getCabinetsInView(leftmostSpace.viewId)
          const viewCabinets = cabinets.filter((c) => viewCabinetIds.includes(c.cabinetId))

          if (viewCabinets.length > 0) {
            const zPos = 30
            addDimensionGroup(
              createEmptySpaceYDimensionEnhanced(
                leftmostSpace.bottomY,
                leftmostSpace.topY,
                leftmostSpace.height,
                leftmostSpace.leftmostX,
                zPos,
                leftmostSpace.viewId,
                emptyYIndex++,
                offsets
              )
            )
          }
        })
      }

      // X-axis empty spaces - hide in X view
      if (cameraViewMode !== "x") {
        const emptySpacesX = detectEmptySpacesX(cabinets, viewManager)

        emptySpacesX.forEach((space, index) => {
          const zPos = 30
          addDimensionGroup(
            createEmptySpaceXDimensionEnhanced(
              space.leftX,
              space.rightX,
              space.width,
              space.topY,
              space.leftCabinetType,
              space.rightCabinetType,
              space.baseTopY,
              zPos,
              wallOffsetContext,
              space.viewId,
              index,
              offsets
            )
          )
        })
      }
    }
  }, [
    sceneRef,
    cabinets,
    visible,
    viewManager,
    wallDimensions,
    getWallOffsetContext,
    cameraViewMode,
    offsets,
  ])

  // Store cabinets ref and previous positions
  const cabinetsRef = useRef<CabinetData[]>([])
  const previousPositionsRef = useRef<
    Map<string, { x: number; y: number; z: number; width: number; height: number; depth: number }>
  >(new Map())
  const animationFrameRef = useRef<number | null>(null)
  const lastRedrawTriggerRef = useRef(0)

  // Update dimension lines when visibility changes
  useEffect(() => {
    updateDimensionLines()
  }, [visible, updateDimensionLines])

  // Update dimension lines when cabinets array changes
  useEffect(() => {
    cabinetsRef.current = cabinets
    updateDimensionLines()
    previousPositionsRef.current.clear()
    cabinets.forEach((cab) => {
      previousPositionsRef.current.set(cab.cabinetId, {
        x: cab.group.position.x,
        y: cab.group.position.y,
        z: cab.group.position.z,
        width: cab.carcass.dimensions.width,
        height: cab.carcass.dimensions.height,
        depth: cab.carcass.dimensions.depth,
      })
    })
  }, [cabinets.length, updateDimensionLines])

  // Animation loop for tracking position changes and redraw triggers
  useEffect(() => {
    const updateLoop = () => {
      let needsUpdate = false

      // Check for redraw trigger from interactions
      if (redrawTriggerRef.current !== lastRedrawTriggerRef.current) {
        needsUpdate = true
        lastRedrawTriggerRef.current = redrawTriggerRef.current
      }

      // Check if number of cabinets changed
      if (cabinetsRef.current.length !== previousPositionsRef.current.size) {
        needsUpdate = true
      } else {
        // Check if any cabinet position or dimension has changed
        for (const cabinet of cabinetsRef.current) {
          const prev = previousPositionsRef.current.get(cabinet.cabinetId)

          if (!prev) {
            needsUpdate = true
            break
          }

          const current = {
            x: cabinet.group.position.x,
            y: cabinet.group.position.y,
            z: cabinet.group.position.z,
            width: cabinet.carcass.dimensions.width,
            height: cabinet.carcass.dimensions.height,
            depth: cabinet.carcass.dimensions.depth,
          }

          if (
            Math.abs(prev.x - current.x) > 0.1 ||
            Math.abs(prev.y - current.y) > 0.1 ||
            Math.abs(prev.z - current.z) > 0.1 ||
            Math.abs(prev.width - current.width) > 0.1 ||
            Math.abs(prev.height - current.height) > 0.1 ||
            Math.abs(prev.depth - current.depth) > 0.1
          ) {
            needsUpdate = true
            previousPositionsRef.current.set(cabinet.cabinetId, current)
          }
        }
      }

      if (needsUpdate) {
        updateDimensionLines()
        cabinetsRef.current.forEach((cab) => {
          previousPositionsRef.current.set(cab.cabinetId, {
            x: cab.group.position.x,
            y: cab.group.position.y,
            z: cab.group.position.z,
            width: cab.carcass.dimensions.width,
            height: cab.carcass.dimensions.height,
            depth: cab.carcass.dimensions.depth,
          })
        })
      }

      animationFrameRef.current = requestAnimationFrame(updateLoop)
    }

    animationFrameRef.current = requestAnimationFrame(updateLoop)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [updateDimensionLines])

  return {
    updateDimensionLines,
    // Interaction controls
    selectedDimLineId: interaction.selectedId,
    hasModifications: interaction.hasModifications,
    hideSelected: interaction.hideSelected,
    resetAllLines: interaction.resetAllLines,
    deselect: interaction.deselect,
  }
}
