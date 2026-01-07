import type { CabinetData, WallDimensions } from "../../types"
import {
  getCabinetRelativeEffectiveBounds,
  getEffectiveLeftEdge,
  getEffectiveRightEdge,
} from "../../lib/snapUtils"
import { updateAllDependentComponents } from "./dependentComponentsHandler"
import {
  getApplianceWidthConstraints,
  resolveApplianceGapsForWidth,
} from "./applianceGapHandler"
import { getWidthConstraints } from "./productDimensionHandler"
import type { FillGapsMode } from "./fillGapsTypes"
import { toastThrottled } from "@/features/cabinets/ui/ProductPanel"

type CabinetMetrics = {
  effectiveWidth: number
  extraWidth: number
}

type FillGapsParams = {
  selectedCabinets: CabinetData[]
  cabinets: CabinetData[]
  wallDimensions: WallDimensions
  mode: FillGapsMode
}

const getRightWallPosition = (wallDimensions: WallDimensions) =>
  wallDimensions.backWallLength ?? wallDimensions.length

const getCabinetWidthConstraints = (
  cabinet: CabinetData
): { min: number; max: number } | null => {
  if (cabinet.cabinetType === "appliance") {
    return getApplianceWidthConstraints(cabinet)
  }

  return getWidthConstraints(cabinet.productId)
}

const getCabinetLabel = (cabinet: CabinetData) =>
  cabinet.sortNumber ? `Cabinet ${cabinet.sortNumber}` : `Cabinet ${cabinet.cabinetId}`

export const handleFillGaps = ({
  selectedCabinets,
  cabinets,
  wallDimensions,
  mode,
}: FillGapsParams): boolean => {
  if (selectedCabinets.length < 2) return false

  const sortedSelected = [...selectedCabinets].sort(
    (a, b) => getEffectiveLeftEdge(a, cabinets) - getEffectiveLeftEdge(b, cabinets)
  )

  const leftmostCabinet = sortedSelected[0]
  const rightmostCabinet = sortedSelected[sortedSelected.length - 1]
  const rightInsideBoundary = getEffectiveRightEdge(leftmostCabinet, cabinets)
  const leftInsideBoundary = getEffectiveLeftEdge(rightmostCabinet, cabinets)
  const rightWallPosition = getRightWallPosition(wallDimensions)

  let leftBoundary = 0
  let rightBoundary = rightWallPosition
  let resizableCabinets = sortedSelected

  switch (mode) {
    case "inside":
      leftBoundary = rightInsideBoundary
      rightBoundary = leftInsideBoundary
      resizableCabinets = sortedSelected.slice(1, -1)
      break
    case "to-right-wall":
      leftBoundary = rightInsideBoundary
      rightBoundary = rightWallPosition
      resizableCabinets = sortedSelected.slice(1)
      break
    case "to-left-wall":
      leftBoundary = 0
      rightBoundary = leftInsideBoundary
      resizableCabinets = sortedSelected.slice(0, -1)
      break
    case "full-width":
    default:
      leftBoundary = 0
      rightBoundary = rightWallPosition
      resizableCabinets = sortedSelected
      break
  }

  if (resizableCabinets.length === 0) {
    toastThrottled("No cabinets available to resize for this fill mode.")
    return false
  }

  const targetWidth = rightBoundary - leftBoundary
  if (targetWidth <= 0.1) {
    toastThrottled("Fill range is too small to apply.")
    return false
  }

  const cabinetMetrics = new Map<string, CabinetMetrics>()
  let totalEffectiveWidth = 0

  resizableCabinets.forEach((cabinet) => {
    const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(
      cabinet,
      cabinets
    )
    const effectiveWidth = rightOffset - leftOffset
    const extraWidth = effectiveWidth - cabinet.carcass.dimensions.width
    cabinetMetrics.set(cabinet.cabinetId, { effectiveWidth, extraWidth })
    totalEffectiveWidth += effectiveWidth
  })

  if (totalEffectiveWidth <= 0.1) {
    return false
  }

  const scale = targetWidth / totalEffectiveWidth
  const applianceGapTargets = new Map<string, { left: number; right: number }>()
  const resizePlans: Array<{ cabinet: CabinetData; newWidth: number }> = []

  for (const cabinet of resizableCabinets) {
    const metrics = cabinetMetrics.get(cabinet.cabinetId)
    if (!metrics) continue

    const targetEffectiveWidth = metrics.effectiveWidth * scale
    const newWidth = targetEffectiveWidth - metrics.extraWidth

    if (newWidth <= 0.1) {
      toastThrottled(`${getCabinetLabel(cabinet)} cannot be resized to zero width.`)
      return false
    }

    const constraints = getCabinetWidthConstraints(cabinet)
    if (constraints) {
      if (newWidth < constraints.min) {
        toastThrottled(
          `${getCabinetLabel(cabinet)} would be below minimum width (${constraints.min}mm).`
        )
        return false
      }
      if (newWidth > constraints.max) {
        toastThrottled(
          `${getCabinetLabel(cabinet)} would exceed maximum width (${constraints.max}mm).`
        )
        return false
      }
    }

    if (cabinet.cabinetType === "appliance") {
      const gapTargets = resolveApplianceGapsForWidth(cabinet, newWidth)
      if (!gapTargets) {
        toastThrottled("Cannot resize: appliance gaps exceed limits.")
        return false
      }
      applianceGapTargets.set(cabinet.cabinetId, gapTargets)
    }

    resizePlans.push({ cabinet, newWidth })
  }

  resizePlans.forEach(({ cabinet, newWidth }) => {
    if (cabinet.cabinetType === "appliance") {
      const gapTargets = applianceGapTargets.get(cabinet.cabinetId)
      if (gapTargets) {
        cabinet.carcass.updateConfig({
          applianceLeftGap: gapTargets.left,
          applianceRightGap: gapTargets.right,
        })
      }
    }

    cabinet.carcass.updateDimensions({
      width: newWidth,
      height: cabinet.carcass.dimensions.height,
      depth: cabinet.carcass.dimensions.depth,
    })

    updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
      widthChanged: true,
    })
  })

  let currentEffectiveLeft = leftBoundary
  resizableCabinets.forEach((cabinet) => {
    const oldX = cabinet.group.position.x
    const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(
      cabinet,
      cabinets
    )
    const effectiveWidth = rightOffset - leftOffset
    const targetEffectiveLeft = Math.max(0, currentEffectiveLeft)
    const newX = targetEffectiveLeft - leftOffset

    cabinet.group.position.set(
      newX,
      cabinet.group.position.y,
      cabinet.group.position.z
    )

    if (Math.abs(newX - oldX) > 0.1) {
      updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
        positionChanged: true,
      })
    }

    currentEffectiveLeft = targetEffectiveLeft + effectiveWidth
  })

  return true
}
