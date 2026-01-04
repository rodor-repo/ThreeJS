import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { toastThrottled } from "@/features/cabinets/ui/ProductPanel"
import { getClient } from "@/app/QueryProvider"
import { getProductData } from "@/server/getProductData"
import { priceQueryKeys } from "@/features/cabinets/ui/productPanel/utils/queryKeys"
import {
  getCabinetRelativeEffectiveBounds,
  getEffectiveLeftEdge,
  getEffectiveRightEdge,
} from "../../lib/snapUtils"
import { updateAllDependentComponents } from "./dependentComponentsHandler"
import {
  applyWidthChangeWithLock,
} from "./lockBehaviorHandler"
import {
  getApplianceWidthConstraints,
  resolveApplianceGapsForWidth,
} from "./applianceGapHandler"
import {
  repositionViewCabinets,
  checkLeftWallOverflow,
} from "./viewRepositionHandler"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

// Helper to get width constraints from React Query cache
export const getWidthConstraints = (
  productId: string | undefined
): { min: number; max: number } | null => {
  if (!productId) return null

  const productData = getClient().getQueryData(priceQueryKeys.productData(productId)) as
    | Awaited<ReturnType<typeof getProductData>>
    | undefined

  if (!productData) return null

  const { product: wsProduct, threeJsGDs } = productData
  const widthGDIds = threeJsGDs?.["width"] || []

  for (const [, dimObj] of Object.entries(wsProduct?.dims || {})) {
    if (dimObj.GDId && widthGDIds.includes(dimObj.GDId)) {
      if (typeof dimObj.min === "number" && typeof dimObj.max === "number") {
        return { min: dimObj.min, max: dimObj.max }
      }
    }
  }

  return null
}

const getCabinetWidthConstraints = (
  cabinet: CabinetData
): { min: number; max: number } | null => {
  if (cabinet.cabinetType === "appliance") {
    return getApplianceWidthConstraints(cabinet)
  }

  return getWidthConstraints(cabinet.productId)
}

const applyGroupedWidthChanges = (
  sourceCabinet: CabinetData,
  widthDelta: number,
  cabinets: CabinetData[],
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>,
  wallDimensions: WallDimensions,
  applianceGapTargets?: Map<string, { left: number; right: number }>
): void => {
  const groupData = cabinetGroups.get(sourceCabinet.cabinetId)
  if (!groupData || groupData.length === 0) return

  groupData.forEach((groupCabinet) => {
    const groupedCabinet = cabinets.find(
      (c) => c.cabinetId === groupCabinet.cabinetId
    )
    if (!groupedCabinet) return

    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
    const newGroupedWidth =
      groupedCabinet.carcass.dimensions.width + proportionalDelta

    const result = applyWidthChangeWithLock(
      groupedCabinet,
      newGroupedWidth,
      groupedCabinet.carcass.dimensions.width,
      groupedCabinet.group.position.x
    )

    if (!result) return

    const { newX, positionChanged } = result

    if (groupedCabinet.cabinetType === "appliance") {
      const gapTargets =
        applianceGapTargets?.get(groupedCabinet.cabinetId) ||
        resolveApplianceGapsForWidth(groupedCabinet, newGroupedWidth)

      if (!gapTargets) {
        return
      }

      groupedCabinet.carcass.updateConfig({
        applianceLeftGap: gapTargets.left,
        applianceRightGap: gapTargets.right,
      })
    }

    groupedCabinet.carcass.updateDimensions({
      width: newGroupedWidth,
      height: groupedCabinet.carcass.dimensions.height,
      depth: groupedCabinet.carcass.dimensions.depth,
    })

    groupedCabinet.group.position.set(
      newX,
      groupedCabinet.group.position.y,
      groupedCabinet.group.position.z
    )

    updateAllDependentComponents(groupedCabinet, cabinets, wallDimensions, {
      widthChanged: true,
      positionChanged,
    })
  })
}

// Helper to dispatch dimension rejected event
const dispatchDimensionRejected = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("productPanel:dimensionRejected"))
  }
}

export const handleProductDimensionChange = (
  newDimensions: { width: number; height: number; depth: number },
  params: {
    selectedCabinet: CabinetData
    selectedCabinets: CabinetData[]
    cabinets: CabinetData[]
    cabinetSyncs: Map<string, string[]>
    cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  }
) => {
  const {
    selectedCabinet,
    selectedCabinets,
    cabinets,
    cabinetSyncs,
    cabinetGroups,
    viewManager,
    wallDimensions,
  } = params

  // Store old dimensions and position
  const oldWidth = selectedCabinet.carcass.dimensions.width
  const oldHeight = selectedCabinet.carcass.dimensions.height
  const oldDepth = selectedCabinet.carcass.dimensions.depth
  const oldX = selectedCabinet.group.position.x
  const leftLock = selectedCabinet.leftLock ?? false
  const rightLock = selectedCabinet.rightLock ?? false

  // Calculate deltas and detect changes
  const widthDelta = newDimensions.width - oldWidth
  const heightChanged = Math.abs(newDimensions.height - oldHeight) > 0.1
  const widthChanged = Math.abs(newDimensions.width - oldWidth) > 0.1
  const depthChanged = Math.abs(newDimensions.depth - oldDepth) > 0.1

  // Handle width changes with sync/pair/lock logic
  if (widthDelta !== 0) {
    // Check for sync relationships - sync logic overrides lock system and pair system
    const syncCabinetsForThis =
      cabinetSyncs.get(selectedCabinet.cabinetId) || []
    const isChangingCabinetSynced = syncCabinetsForThis.length > 0

    if (isChangingCabinetSynced) {
      // Handle sync logic (multiple selected synced cabinets)
      const allSyncedCabinetIds = new Set([
        selectedCabinet.cabinetId,
        ...syncCabinetsForThis,
      ])
      const selectedSyncCabinets = selectedCabinets.filter((cab) =>
        allSyncedCabinetIds.has(cab.cabinetId)
      )

      if (selectedSyncCabinets.length > 1) {
        return handleSyncResize(
          selectedCabinet,
          selectedSyncCabinets,
          newDimensions,
          widthDelta,
          cabinets,
          cabinetGroups,
          viewManager,
          wallDimensions
        )
      }
    }

    // Validate pair constraints BEFORE applying changes
    const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
    const applianceGapTargets = new Map<string, { left: number; right: number }>()
    if (groupData && groupData.length > 0) {
      for (const groupCabinet of groupData) {
        const groupedCabinet = cabinets.find(
          (c) => c.cabinetId === groupCabinet.cabinetId
        )
        if (!groupedCabinet) continue

        const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
        const newGroupedWidth =
          groupedCabinet.carcass.dimensions.width + proportionalDelta

        const constraints = getCabinetWidthConstraints(groupedCabinet)
        if (constraints) {
          if (newGroupedWidth < constraints.min) {
            toastThrottled(
              `Cannot resize: paired cabinet would be below minimum width (${constraints.min}mm)`
            )
            dispatchDimensionRejected()
            return
          }
          if (newGroupedWidth > constraints.max) {
            toastThrottled(
              `Cannot resize: paired cabinet would exceed maximum width (${constraints.max}mm)`
            )
            dispatchDimensionRejected()
            return
          }
        }

        if (groupedCabinet.cabinetType === "appliance") {
          const gapTargets = resolveApplianceGapsForWidth(
            groupedCabinet,
            newGroupedWidth
          )
          if (!gapTargets) {
            toastThrottled(
              "Cannot resize: paired appliance gaps exceed limits"
            )
            dispatchDimensionRejected()
            return
          }
          applianceGapTargets.set(groupedCabinet.cabinetId, gapTargets)
        }
      }
    }

    // Check for both locks preventing resize
    if (leftLock && rightLock) {
      toastThrottled(
        "Cannot resize width when both left and right edges are locked"
      )
      return
    }

    // Validate left wall overflow for right lock or center mode
    if (
      selectedCabinet.viewId &&
      selectedCabinet.viewId !== "none" &&
      widthDelta > 0
    ) {
      const pushAmount = rightLock ? widthDelta : widthDelta / 2
      if (rightLock || (!leftLock && !rightLock)) {
        // Check self
        if (oldX - pushAmount < -0.1) {
          toastThrottled("Cannot expand: cabinet would hit the left wall")
          dispatchDimensionRejected()
          return
        }

        const rightEdge = oldX + oldWidth
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
          dispatchDimensionRejected()
          return
        }
      }
    }

    // Apply width change with lock behavior
    const lockResult = applyWidthChangeWithLock(
      selectedCabinet,
      newDimensions.width,
      oldWidth,
      oldX
    )

    if (!lockResult) {
      // Both locks prevent resize
      return
    }

    const { newX, positionChanged } = lockResult

    // Update dimensions
    selectedCabinet.carcass.updateDimensions(newDimensions)

    // Update position
    selectedCabinet.group.position.set(
      newX,
      selectedCabinet.group.position.y,
      selectedCabinet.group.position.z
    )

    // Update all dependent components
    updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
      heightChanged,
      widthChanged,
      depthChanged,
      positionChanged,
    })

    // Handle grouped cabinets
    applyGroupedWidthChanges(
      selectedCabinet,
      widthDelta,
      cabinets,
      cabinetGroups,
      wallDimensions,
      applianceGapTargets
    )

    // Reposition other cabinets in the view
    repositionViewCabinets(
      selectedCabinet,
      widthDelta,
      oldX,
      oldWidth,
      cabinets,
      cabinetGroups,
      viewManager,
      wallDimensions
    )
  } else {
    // Width didn't change, just update other dimensions
    selectedCabinet.carcass.updateDimensions(newDimensions)

    // Update all dependent components
    updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
      heightChanged,
      widthChanged: false,
      depthChanged,
      positionChanged: false,
    })
  }
}

/**
 * Handles sync resize logic when multiple synced cabinets are selected
 */
function handleSyncResize(
  selectedCabinet: CabinetData,
  selectedSyncCabinets: CabinetData[],
  newDimensions: { width: number; height: number; depth: number },
  widthDelta: number,
  cabinets: CabinetData[],
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>,
  viewManager: ViewManagerResult,
  wallDimensions: WallDimensions
): void {
  // Calculate how many other cabinets need to absorb the delta
  const otherSyncCabinets = selectedSyncCabinets.filter(
    (c) => c.cabinetId !== selectedCabinet.cabinetId
  )
  const deltaPerCabinet = -widthDelta / otherSyncCabinets.length
  const applianceGapTargets = new Map<string, { left: number; right: number }>()

  // Validate width constraints for all synced cabinets BEFORE applying changes
  for (const cab of otherSyncCabinets) {
    const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
    const constraints = getCabinetWidthConstraints(cab)
    if (constraints) {
      if (newWidth < constraints.min) {
        toastThrottled(
          `Cannot resize: synced cabinet would be below minimum width (${constraints.min}mm)`
        )
        dispatchDimensionRejected()
        return
      }
      if (newWidth > constraints.max) {
        toastThrottled(
          `Cannot resize: synced cabinet would exceed maximum width (${constraints.max}mm)`
        )
        dispatchDimensionRejected()
        return
      }
    }

    if (cab.cabinetType === "appliance") {
      const gapTargets = resolveApplianceGapsForWidth(cab, newWidth)
      if (!gapTargets) {
        toastThrottled("Cannot resize: synced appliance gaps exceed limits")
        dispatchDimensionRejected()
        return
      }
      applianceGapTargets.set(cab.cabinetId, gapTargets)
    }
  }

  console.log(
    `[Sync] Sync logic triggered! Selected sync cabinets: ${selectedSyncCabinets.length}, widthDelta: ${widthDelta}`
  )

  // Sort cabinets by effective left edge (includes fillers/panels)
  const sortedSyncCabinets = [...selectedSyncCabinets].sort(
    (a, b) =>
      getEffectiveLeftEdge(a, cabinets) - getEffectiveLeftEdge(b, cabinets)
  )

  console.log(
    `[Sync] Sorted cabinets:`,
    sortedSyncCabinets.map(
      (c, idx) =>
        `#${idx}: X=${c.group.position.x.toFixed(
          2
        )}, W=${c.carcass.dimensions.width.toFixed(2)}`
    )
  )

  // Calculate initial sync width and positions using effective edges
  const leftmostEdge = getEffectiveLeftEdge(sortedSyncCabinets[0], cabinets)
  const rightmostEdge = getEffectiveRightEdge(
    sortedSyncCabinets[sortedSyncCabinets.length - 1],
    cabinets
  )

  // Find the changing cabinet index
  const changingCabinetIndex = sortedSyncCabinets.findIndex(
    (c) => c.cabinetId === selectedCabinet.cabinetId
  )
  const isLeftmost = changingCabinetIndex === 0

  console.log(
    `[Sync] Changing cabinet index: ${changingCabinetIndex}, isLeftmost: ${isLeftmost}`
  )

  // Update the changing cabinet dimensions
  selectedCabinet.carcass.updateDimensions(newDimensions)

  // Update all dependent components for changing cabinet
  updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
    heightChanged:
      Math.abs(
        newDimensions.height - selectedCabinet.carcass.dimensions.height
      ) > 0.1,
    widthChanged: true,
    depthChanged:
      Math.abs(newDimensions.depth - selectedCabinet.carcass.dimensions.depth) >
      0.1,
    positionChanged: false,
  })

  // Update widths for all other synced cabinets
  const sortedOtherSyncCabinets = sortedSyncCabinets.filter(
    (c) => c.cabinetId !== selectedCabinet.cabinetId
  )

  console.log(
    `[Sync] Distributing delta: widthDelta=${widthDelta}, otherCabinets=${sortedOtherSyncCabinets.length}, deltaPerCabinet=${deltaPerCabinet}`
  )

  sortedOtherSyncCabinets.forEach((cab) => {
    const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
    if (cab.cabinetType === "appliance") {
      const gapTargets = applianceGapTargets.get(cab.cabinetId)
      if (!gapTargets) return
      cab.carcass.updateConfig({
        applianceLeftGap: gapTargets.left,
        applianceRightGap: gapTargets.right,
      })
    }
    cab.carcass.updateDimensions({
      width: newWidth,
      height: cab.carcass.dimensions.height,
      depth: cab.carcass.dimensions.depth,
    })
    updateAllDependentComponents(cab, cabinets, wallDimensions, {
      widthChanged: true,
    })
    console.log(
      `[Sync] Updated width for cabinet: oldWidth=${(
        newWidth - deltaPerCabinet
      ).toFixed(2)}, newWidth=${newWidth.toFixed(2)}`
    )
  })

  // Reposition all cabinets left-to-right, starting from leftmost position
  let currentEffectiveLeft = leftmostEdge
  sortedSyncCabinets.forEach((cab, index) => {
    const oldX = cab.group.position.x
    const { leftOffset, rightOffset } = getCabinetRelativeEffectiveBounds(
      cab,
      cabinets
    )
    const effectiveWidth = rightOffset - leftOffset
    const targetEffectiveLeft = Math.max(0, currentEffectiveLeft)
    const newX = targetEffectiveLeft - leftOffset
    console.log(
      `[Sync] Positioning cabinet ${index}: effectiveLeft=${targetEffectiveLeft.toFixed(
        2
      )}, effectiveWidth=${effectiveWidth.toFixed(2)}, newX=${newX.toFixed(2)}`
    )
    cab.group.position.set(newX, cab.group.position.y, cab.group.position.z)

    // Update all dependent components if position changed
    if (Math.abs(newX - oldX) > 0.1) {
      updateAllDependentComponents(cab, cabinets, wallDimensions, {
        positionChanged: true,
      })
    }

    currentEffectiveLeft = targetEffectiveLeft + effectiveWidth
  })

  console.log(
    `[Sync] Final effective right edge: ${currentEffectiveLeft.toFixed(
      2
    )}, expected: ${rightmostEdge.toFixed(2)}`
  )
}
