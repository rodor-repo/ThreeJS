import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import type { CabinetData, WallDimensions } from "../types"
import type { ViewManager } from "../../cabinets/ViewManager"
import { WALL_THICKNESS } from "../lib/sceneUtils"
import {
  disposeGroup,
  type WallOffsetContext,
} from "./useDimensionLinesUtils/dimensionLineUtils"
import {
  wouldDimensionLinePenetrate,
  createCabinetDimensionLines,
  createOverallWidthDimension,
  createOverallHeightDimension,
  createBaseTallOverallWidthDimension,
  detectEmptySpacesY,
  detectEmptySpacesX,
  createEmptySpaceYDimension,
  createEmptySpaceXDimension,
} from "./useDimensionLinesUtils/dimensionLineCreators"

/**
 * Hook for managing dimension lines that show cabinet measurements
 * Creates dimension lines with arrows and text labels for Height, Width, and Depth
 * Also shows dimension lines for empty spaces between cabinets in the same view
 */
export const useDimensionLines = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  cabinets: CabinetData[],
  visible: boolean = true,
  viewManager?: ViewManager,
  wallDimensions?: WallDimensions
) => {
  const dimensionLinesRef = useRef<THREE.Group[]>([])

  // Create wall offset context for use in creators
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

    // Group cabinets by height to determine which should show height dimension
    const cabinetsByHeight = new Map<number, CabinetData[]>()
    cabinets.forEach((cabinet) => {
      const height = cabinet.carcass.dimensions.height
      if (!cabinetsByHeight.has(height)) {
        cabinetsByHeight.set(height, [])
      }
      cabinetsByHeight.get(height)!.push(cabinet)
    })

    // Find selected cabinet for each height (leftmost, or rightmost if leftmost would penetrate)
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

    // Group cabinets by kicker height (base/tall only)
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

    // Create dimension lines for each cabinet
    cabinets.forEach((cabinet) => {
      const height = cabinet.carcass.dimensions.height
      const depth = cabinet.carcass.dimensions.depth
      const isSelectedForHeight =
        selectedByHeight.get(height) === cabinet.cabinetId
      const isSelectedForDepth =
        selectedByDepth.get(depth) === cabinet.cabinetId

      let isSelectedForKickerHeight = false
      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        const kickerHeight = cabinet.group.position.y
        isSelectedForKickerHeight =
          selectedByKickerHeight.get(kickerHeight) === cabinet.cabinetId
      }

      const dimensionGroup = createCabinetDimensionLines(
        cabinet,
        wallOffsetContext,
        isSelectedForHeight,
        isSelectedForDepth,
        isSelectedForKickerHeight
      )
      sceneRef.current!.add(dimensionGroup)
      dimensionLinesRef.current.push(dimensionGroup)
    })

    // Create overall width dimension line
    const overallDimension = createOverallWidthDimension(cabinets)
    if (overallDimension) {
      sceneRef.current!.add(overallDimension)
      dimensionLinesRef.current.push(overallDimension)
    }

    // Check if we need additional overall width dimension for base/tall only
    const hasTopCabinets = cabinets.some((c) => c.cabinetType === "top")

    if (hasTopCabinets) {
      // Calculate overall width including all cabinets
      let allMinX = Infinity
      let allMaxX = -Infinity
      cabinets.forEach((cabinet) => {
        const x = cabinet.group.position.x
        const width = cabinet.carcass.dimensions.width
        allMinX = Math.min(allMinX, x)
        allMaxX = Math.max(allMaxX, x + width)
      })
      const overallWidthAll = allMaxX - allMinX

      // Calculate overall width excluding top cabinets
      const baseTallCabinets = cabinets.filter(
        (c) => c.cabinetType === "base" || c.cabinetType === "tall"
      )
      let baseTallMinX = Infinity
      let baseTallMaxX = -Infinity
      baseTallCabinets.forEach((cabinet) => {
        const x = cabinet.group.position.x
        const width = cabinet.carcass.dimensions.width
        baseTallMinX = Math.min(baseTallMinX, x)
        baseTallMaxX = Math.max(baseTallMaxX, x + width)
      })
      const overallWidthBaseTall = baseTallMaxX - baseTallMinX

      // Only create additional dimension if widths are different
      if (Math.abs(overallWidthAll - overallWidthBaseTall) > 0.1) {
        const baseTallOverallDimension =
          createBaseTallOverallWidthDimension(cabinets)
        if (baseTallOverallDimension) {
          sceneRef.current!.add(baseTallOverallDimension)
          dimensionLinesRef.current.push(baseTallOverallDimension)
        }
      }
    }

    // Create overall height dimension for each view
    if (viewManager) {
      const overallHeightDimensions = createOverallHeightDimension(
        cabinets,
        viewManager,
        wallDimensions
      )
      overallHeightDimensions.forEach((dimension) => {
        sceneRef.current!.add(dimension)
        dimensionLinesRef.current.push(dimension)
      })
    }

    // Create dimension lines for empty spaces
    if (viewManager) {
      // Detect and render Y-axis empty spaces
      const emptySpacesY = detectEmptySpacesY(cabinets, viewManager)

      // Group by similar heights and only show leftmost for each group
      const heightGroups = new Map<number, typeof emptySpacesY>()
      const SIMILAR_HEIGHT_TOLERANCE = 1

      emptySpacesY.forEach((space) => {
        let foundGroup = false
        for (const [groupHeight, spaces] of Array.from(
          heightGroups.entries()
        )) {
          if (
            Math.abs(space.height - groupHeight) <= SIMILAR_HEIGHT_TOLERANCE
          ) {
            spaces.push(space)
            foundGroup = true
            break
          }
        }

        if (!foundGroup) {
          heightGroups.set(space.height, [space])
        }
      })

      // For each height group, only show the leftmost dimension
      heightGroups.forEach((spaces) => {
        const leftmostSpace = spaces.reduce((prev, curr) =>
          curr.leftmostX < prev.leftmostX ? curr : prev
        )

        const viewCabinetIds = viewManager.getCabinetsInView(
          leftmostSpace.viewId
        )
        const viewCabinets = cabinets.filter((c) =>
          viewCabinetIds.includes(c.cabinetId)
        )
        if (viewCabinets.length > 0) {
          const zPos = 30

          const emptySpaceYDimension = createEmptySpaceYDimension(
            leftmostSpace.bottomY,
            leftmostSpace.topY,
            leftmostSpace.height,
            leftmostSpace.leftmostX,
            zPos
          )
          sceneRef.current!.add(emptySpaceYDimension)
          dimensionLinesRef.current.push(emptySpaceYDimension)
        }
      })

      // Detect and render X-axis empty spaces
      const emptySpacesX = detectEmptySpacesX(cabinets, viewManager)

      emptySpacesX.forEach((space) => {
        const zPos = 30

        const emptySpaceXDimension = createEmptySpaceXDimension(
          space.leftX,
          space.rightX,
          space.width,
          space.topY,
          space.leftCabinetType,
          space.rightCabinetType,
          space.baseTopY,
          zPos,
          wallOffsetContext
        )
        sceneRef.current!.add(emptySpaceXDimension)
        dimensionLinesRef.current.push(emptySpaceXDimension)
      })
    }
  }, [
    sceneRef,
    cabinets,
    visible,
    viewManager,
    wallDimensions,
    getWallOffsetContext,
  ])

  // Store cabinets ref and previous positions to track changes
  const cabinetsRef = useRef<CabinetData[]>([])
  const previousPositionsRef = useRef<
    Map<
      string,
      {
        x: number
        y: number
        z: number
        width: number
        height: number
        depth: number
      }
    >
  >(new Map())
  const animationFrameRef = useRef<number | null>(null)

  // Update dimension lines when visibility changes
  useEffect(() => {
    updateDimensionLines()
  }, [visible, updateDimensionLines])

  // Update dimension lines when cabinets array changes (add/remove)
  useEffect(() => {
    cabinetsRef.current = cabinets
    updateDimensionLines()
    // Update previous positions
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinets.length, updateDimensionLines])

  // Update dimension lines continuously in animation loop to track position changes
  useEffect(() => {
    const updateLoop = () => {
      let needsUpdate = false

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

          // Check if position or dimensions changed
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
        // Update all positions after update
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
  }
}
