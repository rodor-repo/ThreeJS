import { useEffect, useMemo } from "react"
import type { ViewId, ViewManager } from "../../cabinets/ViewManager"
import { WALL_THICKNESS } from "../lib/sceneUtils"
import type { CabinetData, WallDimensions } from "../types"

type UseWallsAutoAdjustOptions = {
  cabinets: CabinetData[]
  wallDimensions: WallDimensions
  viewManager: ViewManager
  applyDimensions: (dimensions: WallDimensions, color?: string, zoomLevel?: number) => void
  zoomLevel?: number
}

export const useWallsAutoAdjust = ({
  cabinets,
  wallDimensions,
  viewManager,
  applyDimensions,
  zoomLevel = 1.5,
}: UseWallsAutoAdjustOptions) => {
  const cabinetPositionsKey = useMemo(
    () =>
      cabinets
        .map(
          (c) =>
            `${c.cabinetId}-${c.group.position.x}-${c.carcass.dimensions.width}`
        )
        .join(","),
    [cabinets]
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
      const cabinetRightEdge =
        cabinet.group.position.x + cabinet.carcass.dimensions.width
      if (cabinetRightEdge > rightmostX) {
        rightmostX = cabinetRightEdge
      }
    })

    const currentBackWallLength =
      wallDimensions.backWallLength ?? wallDimensions.length
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

    let rightmostCabinetEdge = 0
    cabinets.forEach((cabinet) => {
      const cabinetRightEdge =
        cabinet.group.position.x + cabinet.carcass.dimensions.width
      if (cabinetRightEdge > rightmostCabinetEdge) {
        rightmostCabinetEdge = cabinetRightEdge
      }
    })

    if (rightmostCabinetEdge > currentBackWallLength) {
      newDimensions.backWallLength = Math.max(100, rightmostCabinetEdge)
      newDimensions.length = Math.max(100, rightmostCabinetEdge)
      needsUpdate = true
    }

    if (wallDimensions.additionalWalls && wallDimensions.additionalWalls.length > 0) {
      const updatedAdditionalWalls = wallDimensions.additionalWalls.map((wall) => {
        const wallThickness = wall.thickness ?? WALL_THICKNESS
        const wallLeft = wall.distanceFromLeft
        const wallRight = wall.distanceFromLeft + wallThickness

        let maxPenetration = 0
        cabinets.forEach((cabinet) => {
          const cabinetLeft = cabinet.group.position.x
          const cabinetRight =
            cabinet.group.position.x + cabinet.carcass.dimensions.width

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
  ])
}
