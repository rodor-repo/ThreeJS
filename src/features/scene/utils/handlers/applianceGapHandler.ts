import type { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { toastThrottled } from "@/features/cabinets/ui/ProductPanel"
import { APPLIANCE_GAP_LIMITS } from "@/features/cabinets/factory/cabinetFactory"
import { clamp } from "@/features/carcass/utils/carcass-math-utils"
import { updateAllDependentComponents } from "./dependentComponentsHandler"
import { applyWidthChangeWithLock } from "./lockBehaviorHandler"
import { checkLeftWallOverflow, repositionViewCabinets } from "./viewRepositionHandler"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

const DEFAULT_KICKER_HEIGHT = 100
const MIN_VISUAL_DIMENSION = 10

export const getApplianceGapValues = (cabinet: CabinetData) => {
  const config = cabinet.carcass.config
  return {
    topGap: config.applianceTopGap ?? 0,
    leftGap: config.applianceLeftGap ?? 0,
    rightGap: config.applianceRightGap ?? 0,
    kickerHeight: config.applianceKickerHeight ?? DEFAULT_KICKER_HEIGHT,
  }
}

export const getApplianceVisualDimensions = (cabinet: CabinetData) => {
  const { topGap, leftGap, rightGap, kickerHeight } =
    getApplianceGapValues(cabinet)
  const shellDims = cabinet.carcass.dimensions

  return {
    width: Math.max(MIN_VISUAL_DIMENSION, shellDims.width - leftGap - rightGap),
    height: Math.max(
      MIN_VISUAL_DIMENSION,
      shellDims.height - topGap - kickerHeight
    ),
    depth: shellDims.depth,
  }
}

export const getApplianceWidthConstraints = (cabinet: CabinetData) => {
  const visualWidth = getApplianceVisualDimensions(cabinet).width
  return {
    min: visualWidth + APPLIANCE_GAP_LIMITS.side.min * 2,
    max: visualWidth + APPLIANCE_GAP_LIMITS.side.max * 2,
  }
}

export const resolveApplianceGapsForWidth = (
  cabinet: CabinetData,
  targetShellWidth: number
): { left: number; right: number } | null => {
  const { leftGap, rightGap } = getApplianceGapValues(cabinet)
  const visualWidth = getApplianceVisualDimensions(cabinet).width
  const minGap = APPLIANCE_GAP_LIMITS.side.min
  const maxGap = APPLIANCE_GAP_LIMITS.side.max
  const totalGap = targetShellWidth - visualWidth
  const minTotal = minGap * 2
  const maxTotal = maxGap * 2

  if (totalGap < minTotal || totalGap > maxTotal) {
    return null
  }

  const gapDiff = leftGap - rightGap
  let nextLeft = (totalGap + gapDiff) / 2
  let nextRight = totalGap - nextLeft

  if (
    nextLeft < minGap ||
    nextLeft > maxGap ||
    nextRight < minGap ||
    nextRight > maxGap
  ) {
    nextLeft = clamp(nextLeft, minGap, maxGap)
    nextRight = totalGap - nextLeft

    if (nextRight < minGap || nextRight > maxGap) {
      nextRight = clamp(nextRight, minGap, maxGap)
      nextLeft = totalGap - nextRight

      if (nextLeft < minGap || nextLeft > maxGap) {
        return null
      }
    }
  }

  return { left: nextLeft, right: nextRight }
}

export const applyApplianceGapChange = (params: {
  cabinet: CabinetData
  gaps: { top?: number; left?: number; right?: number }
  cabinets: CabinetData[]
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
  viewManager: ViewManagerResult
  wallDimensions: WallDimensions
}): { applied: boolean; newGaps: { top: number; left: number; right: number } } => {
  const { cabinet, gaps, cabinets, cabinetGroups, viewManager, wallDimensions } =
    params

  const { topGap, leftGap, rightGap, kickerHeight } =
    getApplianceGapValues(cabinet)
  const visualDims = getApplianceVisualDimensions(cabinet)

  const newTopGap = gaps.top ?? topGap
  const newLeftGap = gaps.left ?? leftGap
  const newRightGap = gaps.right ?? rightGap

  const oldShellWidth = cabinet.carcass.dimensions.width
  const oldX = cabinet.group.position.x

  const newShellWidth = visualDims.width + newLeftGap + newRightGap
  const newShellHeight = visualDims.height + newTopGap + kickerHeight
  const newShellDepth = visualDims.depth

  const widthDelta = newShellWidth - oldShellWidth

  if (Math.abs(widthDelta) > 0.1) {
    if (cabinet.viewId && cabinet.viewId !== "none") {
      const leftLock = cabinet.leftLock ?? false
      const rightLock = cabinet.rightLock ?? false

      if (widthDelta > 0) {
        const pushAmount = rightLock
          ? widthDelta
          : !leftLock && !rightLock
            ? widthDelta / 2
            : 0

        if (pushAmount > 0) {
          if (oldX - pushAmount < -0.1) {
            toastThrottled("Cannot expand: cabinet would hit the left wall")
            return {
              applied: false,
              newGaps: { top: topGap, left: leftGap, right: rightGap },
            }
          }

          const rightEdge = oldX + oldShellWidth
          const overflow = checkLeftWallOverflow(
            pushAmount,
            cabinet.cabinetId,
            rightEdge,
            cabinet.viewId as ViewId,
            cabinets,
            cabinetGroups,
            viewManager
          )

          if (overflow !== null) {
            toastThrottled(
              `Cannot expand gaps: a cabinet would be pushed ${overflow.toFixed(
                0
              )}mm past the left wall. Please reduce the gaps or move cabinets first.`
            )
            return {
              applied: false,
              newGaps: { top: topGap, left: leftGap, right: rightGap },
            }
          }
        }
      }
    }

    const lockResult = applyWidthChangeWithLock(
      cabinet,
      newShellWidth,
      oldShellWidth,
      oldX
    )

    if (!lockResult) {
      toastThrottled("Cannot resize gaps when both left and right edges are locked")
      return {
        applied: false,
        newGaps: { top: topGap, left: leftGap, right: rightGap },
      }
    }

    const { newX } = lockResult
    cabinet.group.position.x = newX
  }

  const newConfig = {
    applianceTopGap: newTopGap,
    applianceLeftGap: newLeftGap,
    applianceRightGap: newRightGap,
  }

  cabinet.carcass.updateDimensions({
    width: newShellWidth,
    height: newShellHeight,
    depth: newShellDepth,
  })

  cabinet.carcass.updateConfig(newConfig)

  updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
    widthChanged: true,
    heightChanged: newTopGap !== topGap,
  })

  if (Math.abs(widthDelta) > 0.1) {
    repositionViewCabinets(
      cabinet,
      widthDelta,
      oldX,
      oldShellWidth,
      cabinets,
      cabinetGroups,
      viewManager,
      wallDimensions
    )
  }

  return {
    applied: true,
    newGaps: { top: newTopGap, left: newLeftGap, right: newRightGap },
  }
}
