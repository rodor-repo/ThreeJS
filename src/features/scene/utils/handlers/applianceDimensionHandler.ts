import type { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { toastThrottled } from "@/features/cabinets/ui/ProductPanel"
import {
  getApplianceGapValues,
  getApplianceWidthConstraints,
  getApplianceVisualDimensions,
  resolveApplianceGapsForWidth,
} from "./applianceGapHandler"
import { getWidthConstraints } from "./productDimensionHandler"
import { updateAllDependentComponents } from "./dependentComponentsHandler"
import { applyWidthChangeWithLock } from "./lockBehaviorHandler"
import {
  checkLeftWallOverflow,
  repositionViewCabinets,
} from "./viewRepositionHandler"
import {
  getCabinetRelativeEffectiveBounds,
  getEffectiveLeftEdge,
} from "../../lib/snapUtils"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

const getCabinetWidthConstraints = (
  cabinet: CabinetData
): { min: number; max: number } | null => {
  if (cabinet.cabinetType === "appliance") {
    return getApplianceWidthConstraints(cabinet)
  }

  return getWidthConstraints(cabinet.productId)
}

const updateApplianceWidthWithGaps = (
  cabinet: CabinetData,
  newWidth: number,
  gapTargets: { left: number; right: number }
): void => {
  cabinet.carcass.updateConfig({
    applianceLeftGap: gapTargets.left,
    applianceRightGap: gapTargets.right,
  })

  cabinet.carcass.updateDimensions({
    width: newWidth,
    height: cabinet.carcass.dimensions.height,
    depth: cabinet.carcass.dimensions.depth,
  })
}

const applyApplianceWidthWithLock = (
  cabinet: CabinetData,
  newWidth: number
): { positionChanged: boolean } | null => {
  const oldWidth = cabinet.carcass.dimensions.width
  const oldX = cabinet.group.position.x

  const lockResult = applyWidthChangeWithLock(
    cabinet,
    newWidth,
    oldWidth,
    oldX
  )

  if (!lockResult) {
    return null
  }

  const { newX, positionChanged } = lockResult
  cabinet.group.position.x = newX
  return { positionChanged }
}

const applyStandardWidthWithLock = (
  cabinet: CabinetData,
  newWidth: number
): { positionChanged: boolean } | null => {
  const oldWidth = cabinet.carcass.dimensions.width
  const oldX = cabinet.group.position.x

  const lockResult = applyWidthChangeWithLock(
    cabinet,
    newWidth,
    oldWidth,
    oldX
  )

  if (!lockResult) {
    return null
  }

  const { newX, positionChanged } = lockResult
  cabinet.group.position.set(
    newX,
    cabinet.group.position.y,
    cabinet.group.position.z
  )
  return { positionChanged }
}

const applyCabinetWidthForSync = (
  cabinet: CabinetData,
  newWidth: number,
  gapTargets?: { left: number; right: number }
): boolean => {
  if (cabinet.cabinetType === "appliance") {
    if (!gapTargets) {
      return false
    }
    updateApplianceWidthWithGaps(cabinet, newWidth, gapTargets)
    return true
  }

  cabinet.carcass.updateDimensions({
    width: newWidth,
    height: cabinet.carcass.dimensions.height,
    depth: cabinet.carcass.dimensions.depth,
  })

  return true
}

const validateWidthConstraints = (
  cabinet: CabinetData,
  newWidth: number,
  label: "paired" | "synced"
): boolean => {
  const constraints = getCabinetWidthConstraints(cabinet)
  if (!constraints) {
    return true
  }

  if (newWidth < constraints.min) {
    toastThrottled(
      `Cannot resize: ${label} cabinet would be below minimum width (${constraints.min}mm)`
    )
    return false
  }

  if (newWidth > constraints.max) {
    toastThrottled(
      `Cannot resize: ${label} cabinet would exceed maximum width (${constraints.max}mm)`
    )
    return false
  }

  return true
}

function handleApplianceSyncResize(
  selectedCabinet: CabinetData,
  selectedSyncCabinets: CabinetData[],
  newShellWidth: number,
  widthDelta: number,
  cabinets: CabinetData[],
  wallDimensions: WallDimensions,
  selectedGapTargets?: { left: number; right: number }
): boolean {
  const otherSyncCabinets = selectedSyncCabinets.filter(
    (c) => c.cabinetId !== selectedCabinet.cabinetId
  )
  if (otherSyncCabinets.length === 0) {
    return true
  }

  const deltaPerCabinet = -widthDelta / otherSyncCabinets.length
  const gapTargetsByCabinet = new Map<string, { left: number; right: number }>()

  for (const cab of otherSyncCabinets) {
    const nextWidth = cab.carcass.dimensions.width + deltaPerCabinet
    if (!validateWidthConstraints(cab, nextWidth, "synced")) {
      return false
    }

    if (cab.cabinetType === "appliance") {
      const gapTargets = resolveApplianceGapsForWidth(cab, nextWidth)
      if (!gapTargets) {
        toastThrottled("Cannot resize: synced appliance gaps exceed limits")
        return false
      }
      gapTargetsByCabinet.set(cab.cabinetId, gapTargets)
    }
  }

  const sortedSyncCabinets = [...selectedSyncCabinets].sort(
    (a, b) => getEffectiveLeftEdge(a, cabinets) - getEffectiveLeftEdge(b, cabinets)
  )

  const leftmostEdge = getEffectiveLeftEdge(sortedSyncCabinets[0], cabinets)
  if (selectedGapTargets) {
    selectedCabinet.carcass.updateConfig({
      applianceLeftGap: selectedGapTargets.left,
      applianceRightGap: selectedGapTargets.right,
    })
  }
  selectedCabinet.carcass.updateDimensions({
    width: newShellWidth,
    height: selectedCabinet.carcass.dimensions.height,
    depth: selectedCabinet.carcass.dimensions.depth,
  })

  updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
    widthChanged: true,
  })

  otherSyncCabinets.forEach((cab) => {
    const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
    const gapTargets =
      cab.cabinetType === "appliance"
        ? gapTargetsByCabinet.get(cab.cabinetId)
        : undefined

    const updated = applyCabinetWidthForSync(cab, newWidth, gapTargets)
    if (updated) {
      updateAllDependentComponents(cab, cabinets, wallDimensions, {
        widthChanged: true,
      })
    }
  })

  let currentEffectiveLeft = leftmostEdge
  sortedSyncCabinets.forEach((cab) => {
    const oldX = cab.group.position.x
    const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(
      cab,
      cabinets
    )
    const effectiveWidth = rightOffset - leftOffset
    const targetEffectiveLeft = Math.max(0, currentEffectiveLeft)
    const newX = targetEffectiveLeft - leftOffset
    cab.group.position.set(newX, cab.group.position.y, cab.group.position.z)

    if (Math.abs(newX - oldX) > 0.1) {
      updateAllDependentComponents(cab, cabinets, wallDimensions, {
        positionChanged: true,
      })
    }

    currentEffectiveLeft = targetEffectiveLeft + effectiveWidth
  })

  return true
}

const applyApplianceWidthChange = (
  newShellWidth: number,
  params: {
    selectedCabinet: CabinetData
    selectedCabinets: CabinetData[]
    cabinets: CabinetData[]
    cabinetSyncs: Map<string, string[]>
    cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  },
  options?: { selectedGapTargets?: { left: number; right: number } }
): boolean => {
  const {
    selectedCabinet,
    selectedCabinets,
    cabinets,
    cabinetSyncs,
    cabinetGroups,
    viewManager,
    wallDimensions,
  } = params

  const oldShellWidth = selectedCabinet.carcass.dimensions.width
  const oldX = selectedCabinet.group.position.x
  const widthDelta = newShellWidth - oldShellWidth

  if (Math.abs(widthDelta) <= 0.1) {
    if (options?.selectedGapTargets) {
      selectedCabinet.carcass.updateConfig({
        applianceLeftGap: options.selectedGapTargets.left,
        applianceRightGap: options.selectedGapTargets.right,
      })
      selectedCabinet.carcass.updateDimensions({
        width: newShellWidth,
        height: selectedCabinet.carcass.dimensions.height,
        depth: selectedCabinet.carcass.dimensions.depth,
      })
    }
    return true
  }

  const syncCabinetsForThis =
    cabinetSyncs.get(selectedCabinet.cabinetId) || []
  const isChangingCabinetSynced = syncCabinetsForThis.length > 0

  if (isChangingCabinetSynced) {
    const allSyncedCabinetIds = new Set([
      selectedCabinet.cabinetId,
      ...syncCabinetsForThis,
    ])
    const selectedSyncCabinets = selectedCabinets.filter((cab) =>
      allSyncedCabinetIds.has(cab.cabinetId)
    )

    if (selectedSyncCabinets.length > 1) {
      return handleApplianceSyncResize(
        selectedCabinet,
        selectedSyncCabinets,
        newShellWidth,
        widthDelta,
        cabinets,
        wallDimensions,
        options?.selectedGapTargets
      )
    }
  }

  const groupData = cabinetGroups.get(selectedCabinet.cabinetId) || []
  const gapTargetsByCabinet = new Map<string, { left: number; right: number }>()

  for (const groupCabinet of groupData) {
    const groupedCabinet = cabinets.find(
      (c) => c.cabinetId === groupCabinet.cabinetId
    )
    if (!groupedCabinet) continue

    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
    const newGroupedWidth =
      groupedCabinet.carcass.dimensions.width + proportionalDelta

    if (!validateWidthConstraints(groupedCabinet, newGroupedWidth, "paired")) {
      return false
    }

    if (groupedCabinet.cabinetType === "appliance") {
      const gapTargets = resolveApplianceGapsForWidth(
        groupedCabinet,
        newGroupedWidth
      )
      if (!gapTargets) {
        toastThrottled("Cannot resize: paired appliance gaps exceed limits")
        return false
      }
      gapTargetsByCabinet.set(groupedCabinet.cabinetId, gapTargets)
    }
  }

  if (
    selectedCabinet.viewId &&
    selectedCabinet.viewId !== "none" &&
    widthDelta > 0
  ) {
    const leftLock = selectedCabinet.leftLock ?? false
    const rightLock = selectedCabinet.rightLock ?? false
    const pushAmount = rightLock
      ? widthDelta
      : !leftLock && !rightLock
        ? widthDelta / 2
        : 0

    if (pushAmount > 0) {
      if (oldX - pushAmount < -0.1) {
        toastThrottled("Cannot expand: cabinet would hit the left wall")
        return false
      }

      const rightEdge = oldX + oldShellWidth
      const overflow = checkLeftWallOverflow(
        pushAmount,
        selectedCabinet.cabinetId,
        rightEdge,
        selectedCabinet.viewId as ViewId,
        cabinets,
        cabinetGroups,
        viewManager
      )

      if (overflow !== null) {
        toastThrottled(
          `Cannot expand width: a cabinet would be pushed ${overflow.toFixed(
            0
          )}mm past the left wall. Please reduce the width or move cabinets first.`
        )
        return false
      }
    }
  }

  const lockResult = applyApplianceWidthWithLock(
    selectedCabinet,
    newShellWidth
  )

  if (!lockResult) {
    toastThrottled("Cannot resize width when both left and right edges are locked")
    return false
  }

  if (options?.selectedGapTargets) {
    selectedCabinet.carcass.updateConfig({
      applianceLeftGap: options.selectedGapTargets.left,
      applianceRightGap: options.selectedGapTargets.right,
    })
  }
  selectedCabinet.carcass.updateDimensions({
    width: newShellWidth,
    height: selectedCabinet.carcass.dimensions.height,
    depth: selectedCabinet.carcass.dimensions.depth,
  })

  updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
    widthChanged: true,
    positionChanged: lockResult.positionChanged,
  })

  for (const groupCabinet of groupData) {
    const groupedCabinet = cabinets.find(
      (c) => c.cabinetId === groupCabinet.cabinetId
    )
    if (!groupedCabinet) continue

    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
    const newGroupedWidth =
      groupedCabinet.carcass.dimensions.width + proportionalDelta

    if (groupedCabinet.cabinetType === "appliance") {
      const gapTargets = gapTargetsByCabinet.get(groupedCabinet.cabinetId)
      if (!gapTargets) continue

      const gapLockResult = applyApplianceWidthWithLock(
        groupedCabinet,
        newGroupedWidth
      )
      if (!gapLockResult) {
        continue
      }

      updateApplianceWidthWithGaps(groupedCabinet, newGroupedWidth, gapTargets)

      updateAllDependentComponents(
        groupedCabinet,
        cabinets,
        wallDimensions,
        {
          widthChanged: true,
          positionChanged: gapLockResult.positionChanged,
        }
      )
      continue
    }

    const lockApplyResult = applyStandardWidthWithLock(
      groupedCabinet,
      newGroupedWidth
    )
    if (!lockApplyResult) continue

    groupedCabinet.carcass.updateDimensions({
      width: newGroupedWidth,
      height: groupedCabinet.carcass.dimensions.height,
      depth: groupedCabinet.carcass.dimensions.depth,
    })

    updateAllDependentComponents(groupedCabinet, cabinets, wallDimensions, {
      widthChanged: true,
      positionChanged: lockApplyResult.positionChanged,
    })
  }

  repositionViewCabinets(
    selectedCabinet,
    widthDelta,
    oldX,
    oldShellWidth,
    cabinets,
    cabinetGroups,
    viewManager,
    wallDimensions
  )

  return true
}

export const handleApplianceWidthChange = (
  newVisualWidth: number,
  params: {
    selectedCabinet: CabinetData
    selectedCabinets: CabinetData[]
    cabinets: CabinetData[]
    cabinetSyncs: Map<string, string[]>
    cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  }
): boolean => {
  const { leftGap, rightGap } = getApplianceGapValues(params.selectedCabinet)
  const newShellWidth = newVisualWidth + leftGap + rightGap
  return applyApplianceWidthChange(newShellWidth, params)
}

export const handleApplianceHorizontalGapChange = (
  gapChange: { left?: number; right?: number },
  params: {
    selectedCabinet: CabinetData
    selectedCabinets: CabinetData[]
    cabinets: CabinetData[]
    cabinetSyncs: Map<string, string[]>
    cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  }
): { applied: boolean; newGaps: { left: number; right: number } } => {
  const { leftGap, rightGap } = getApplianceGapValues(params.selectedCabinet)
  const nextLeft = gapChange.left ?? leftGap
  const nextRight = gapChange.right ?? rightGap
  const visualWidth = getApplianceVisualDimensions(params.selectedCabinet).width
  const newShellWidth = visualWidth + nextLeft + nextRight
  const applied = applyApplianceWidthChange(newShellWidth, params, {
    selectedGapTargets: { left: nextLeft, right: nextRight },
  })

  return {
    applied,
    newGaps: applied ? { left: nextLeft, right: nextRight } : { left: leftGap, right: rightGap },
  }
}
