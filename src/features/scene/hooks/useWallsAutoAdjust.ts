import { useEffect, useMemo } from "react"
import type { ViewId, ViewManager } from "../../cabinets/ViewManager"
import { WALL_THICKNESS } from "../lib/sceneUtils"
import type { CabinetData, WallDimensions } from "../types"
import { getCabinetHorizontalEdges } from "../utils/handlers/sharedCabinetUtils"

type UseWallsAutoAdjustOptions = {
  cabinets: CabinetData[]
  wallDimensions: WallDimensions
  viewManager: ViewManager
  applyDimensions: (dimensions: WallDimensions, color?: string, zoomLevel?: number) => void
  zoomLevel?: number
  /** Version counter that triggers recalculation when cabinet positions change via dragging */
  positionVersion?: number
}

export const useWallsAutoAdjust = ({
  cabinets,
  wallDimensions,
  viewManager,
  applyDimensions,
  zoomLevel = 1.5,
  positionVersion = 0,
}: UseWallsAutoAdjustOptions) => {
  const cabinetPositionsKey = useMemo(
    () =>
      cabinets
        .map(
          (c) =>
            `${c.cabinetId}-${c.group.position.x}-${c.carcass.dimensions.width}`
        )
        .join(","),
    // positionVersion forces recalculation when cabinets are dragged
    // (since cabinet.group.position is mutated, cabinets array ref doesn't change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cabinets, positionVersion]
  )

  const additionalWallsKey = useMemo(
    () =>
      wallDimensions.additionalWalls
        ?.map((w) => `${w.id}-${w.distanceFromLeft}`)
        .join(","),
    [wallDimensions.additionalWalls]
  )

  useEffect(() => {
    if (!wallDimensions.rightWallViewId || wallDimensions.rightWallViewId === "none") {
      return
    }

    const cabinetIds = viewManager.getCabinetsInView(
      wallDimensions.rightWallViewId as ViewId
    )
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId)
    )

    if (viewCabinets.length === 0) return

    let rightmostX = 0
    viewCabinets.forEach((cabinet) => {
      const { right } = getCabinetHorizontalEdges(cabinet)
      if (right > rightmostX) {
        rightmostX = right
      }
    })

    const currentBackWallLength =
      wallDimensions.backWallLength ?? wallDimensions.length
    // When wall is linked to a view, follow the view's rightmost edge (expand AND shrink)
    // Cabinets outside the view are allowed to go beyond the wall boundary
    if (
      rightmostX > currentBackWallLength ||
      Math.abs(rightmostX - currentBackWallLength) > 1
    ) {
      applyDimensions({
        ...wallDimensions,
        backWallLength: Math.max(100, rightmostX),
        length: Math.max(100, rightmostX),
      }, undefined, zoomLevel)
    }
  }, [
    applyDimensions,
    cabinetPositionsKey,
    cabinets,
    zoomLevel,
    viewManager,
    wallDimensions,
  ])

  useEffect(() => {
    const currentBackWallLength =
      wallDimensions.backWallLength ?? wallDimensions.length
    let needsUpdate = false
    const newDimensions: WallDimensions = { ...wallDimensions }

    // Only auto-expand for all cabinets if the right wall is NOT linked to a view
    // When linked to a view, cabinets outside the view are allowed to go beyond the wall
    const isWallLinkedToView = wallDimensions.rightWallViewId && wallDimensions.rightWallViewId !== "none"
    
    if (!isWallLinkedToView) {
      let rightmostCabinetEdge = 0
      cabinets.forEach((cabinet) => {
        const { right } = getCabinetHorizontalEdges(cabinet)
        if (right > rightmostCabinetEdge) {
          rightmostCabinetEdge = right
        }
      })

      if (rightmostCabinetEdge > currentBackWallLength) {
        newDimensions.backWallLength = Math.max(100, rightmostCabinetEdge)
        newDimensions.length = Math.max(100, rightmostCabinetEdge)
        needsUpdate = true
      }
    }

    if (wallDimensions.additionalWalls && wallDimensions.additionalWalls.length > 0) {
      const updatedAdditionalWalls = wallDimensions.additionalWalls.map((wall) => {
        const wallThickness = wall.thickness ?? WALL_THICKNESS
        
        // Check if this additional wall is linked to a view
        if (wall.viewId && wall.viewId !== "none") {
          // Wall is linked to a view - follow the view's rightmost edge (like constant right wall)
          const cabinetIds = viewManager.getCabinetsInView(wall.viewId as ViewId)
          const viewCabinets = cabinets.filter((c) =>
            cabinetIds.includes(c.cabinetId)
          )

          if (viewCabinets.length === 0) return wall

          // Find rightmost edge of cabinets in the linked view
          let rightmostX = 0
          viewCabinets.forEach((cabinet) => {
            const { right } = getCabinetHorizontalEdges(cabinet)
            if (right > rightmostX) {
              rightmostX = right
            }
          })

          // Position wall at the rightmost edge (expand AND shrink to follow the view)
          if (Math.abs(wall.distanceFromLeft - rightmostX) > 1) {
            return {
              ...wall,
              distanceFromLeft: Math.max(0, rightmostX),
            }
          }

          return wall
        }

        // Wall is NOT linked to a view - only expand when cabinets penetrate
        const wallLeft = wall.distanceFromLeft
        const wallRight = wall.distanceFromLeft + wallThickness

        let maxPenetration = 0
        cabinets.forEach((cabinet) => {
          const { left: cabinetLeft, right: cabinetRight } = getCabinetHorizontalEdges(cabinet)

          if (cabinetLeft < wallRight && cabinetRight > wallLeft) {
            const penetration = Math.max(0, cabinetRight - wallRight)
            if (penetration > maxPenetration) {
              maxPenetration = penetration
            }
          }
        })

        if (maxPenetration > 0) {
          return {
            ...wall,
            distanceFromLeft: wall.distanceFromLeft + maxPenetration,
          }
        }

        return wall
      })

      const wallsChanged = updatedAdditionalWalls.some(
        (wall, index) =>
          wall.distanceFromLeft !==
          wallDimensions.additionalWalls![index].distanceFromLeft
      )

      if (wallsChanged) {
        newDimensions.additionalWalls = updatedAdditionalWalls
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      applyDimensions(newDimensions, undefined, zoomLevel)
    }
  }, [
    additionalWallsKey,
    applyDimensions,
    cabinetPositionsKey,
    cabinets,
    zoomLevel,
    wallDimensions,
    viewManager
  ])
}
