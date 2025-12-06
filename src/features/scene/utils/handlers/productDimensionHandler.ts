import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { toastThrottled } from "@/features/cabinets/ui/ProductPanel"
import { getClient } from "@/app/QueryProvider"
import { getProductData } from "@/server/getProductData"
import { updateChildCabinets } from "./childCabinetHandler"
import { updateKickerPosition } from "./kickerPositionHandler"
import { updateBulkheadPosition } from "./bulkheadPositionHandler"
import {
  getCabinetRelativeEffectiveBounds,
  getEffectiveLeftEdge,
  getEffectiveRightEdge
} from "../../lib/snapUtils"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

// Helper to get width constraints from React Query cache
const getWidthConstraints = (
  productId: string | undefined
): { min: number; max: number } | null => {
  if (!productId) return null

  const productData = getClient().getQueryData(["productData", productId]) as
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

  // Helper function to check if two cabinets are paired
  const areCabinetsPaired = (
    cabinetId1: string,
    cabinetId2: string
  ): boolean => {
    // Check if cabinetId2 is in cabinetId1's group
    const group1 = cabinetGroups.get(cabinetId1)
    if (group1 && group1.some((c) => c.cabinetId === cabinetId2)) {
      return true
    }
    // Check if cabinetId1 is in cabinetId2's group
    const group2 = cabinetGroups.get(cabinetId2)
    if (group2 && group2.some((c) => c.cabinetId === cabinetId1)) {
      return true
    }
    return false
  }

  // Helper function to check if pushing left cabinets would exceed the left wall
  // Returns the overflow amount (how much it would go past x=0) or null if OK
  const checkLeftWallOverflow = (
    pushAmount: number,
    changingCabinetId: string,
    changingRightEdge: number,
    viewId: ViewId
  ): number | null => {
    if (!viewManager || pushAmount <= 0) return null

    const cabinetsInView = viewManager.getCabinetsInView(viewId)
    let maxOverflow: number | null = null

    for (const cabId of cabinetsInView) {
      if (cabId === changingCabinetId) continue

      const cab = cabinets.find((c) => c.cabinetId === cabId)
      if (!cab) continue

      // Skip paired cabinets
      if (areCabinetsPaired(changingCabinetId, cab.cabinetId)) continue

      // Check if this cabinet is to the LEFT of the changing cabinet
      const cabRightEdge = cab.group.position.x + cab.carcass.dimensions.width
      if (cabRightEdge < changingRightEdge) {
        const newX = cab.group.position.x - pushAmount
        if (newX < 0) {
          const overflow = Math.abs(newX)
          if (maxOverflow === null || overflow > maxOverflow) {
            maxOverflow = overflow
          }
        }
      }
    }

    return maxOverflow
  }

  // Store old width and position before updating
  const oldWidth = selectedCabinet.carcass.dimensions.width
  const oldHeight = selectedCabinet.carcass.dimensions.height
  const oldDepth = selectedCabinet.carcass.dimensions.depth
  const oldX = selectedCabinet.group.position.x
  const leftLock = selectedCabinet.leftLock ?? false
  const rightLock = selectedCabinet.rightLock ?? false

  // Calculate width delta (how much the width changed)
  const widthDelta = newDimensions.width - oldWidth
  
  // Detect which dimensions changed
  const heightChanged = Math.abs(newDimensions.height - oldHeight) > 0.1
  const widthChanged = Math.abs(newDimensions.width - oldWidth) > 0.1
  const depthChanged = Math.abs(newDimensions.depth - oldDepth) > 0.1

  // Check for sync relationships - sync logic overrides lock system and pair system
  if (widthDelta !== 0) {
    // Get sync relationships for the changing cabinet
    const syncCabinetsForThis =
      cabinetSyncs.get(selectedCabinet.cabinetId) || []

    // Check if the changing cabinet is part of a sync relationship
    const isChangingCabinetSynced = syncCabinetsForThis.length > 0

    if (isChangingCabinetSynced) {
      // Get all cabinets that are synced with the changing cabinet (including itself)
      const allSyncedCabinetIds = new Set([
        selectedCabinet.cabinetId,
        ...syncCabinetsForThis,
      ])

      // Check which of the selected cabinets are actually in the sync list
      const selectedSyncCabinets = selectedCabinets.filter((cab) =>
        allSyncedCabinetIds.has(cab.cabinetId)
      )

      // If we have multiple selected synced cabinets, apply sync logic
      // (ignore cabinets that are selected but not in sync list)
      if (selectedSyncCabinets.length > 1) {
        // Calculate how many other cabinets need to absorb the delta
        const otherSyncCabinets = selectedSyncCabinets.filter(
          (c) => c.cabinetId !== selectedCabinet.cabinetId
        )
        const deltaPerCabinet = -widthDelta / otherSyncCabinets.length

        // Validate width constraints for all synced cabinets BEFORE applying changes
        for (const cab of otherSyncCabinets) {
          const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
          const constraints = getWidthConstraints(cab.productId)
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

        // Calculate initial sync width and positions using effective edges (includes fillers/panels)
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
        const isRightmost =
          changingCabinetIndex === sortedSyncCabinets.length - 1

        console.log(
          `[Sync] Changing cabinet index: ${changingCabinetIndex}, isLeftmost: ${isLeftmost}, isRightmost: ${isRightmost}`
        )

        // Update the changing cabinet
        // If it's the leftmost, keep X position fixed (left edge fixed)
        // If it's not leftmost, we may need to adjust position
        if (isLeftmost) {
          // Leftmost cabinet: keep X position fixed, only update dimensions
          selectedCabinet.carcass.updateDimensions(newDimensions)
        } else {
          // Not leftmost: update dimensions, position may need adjustment
          selectedCabinet.carcass.updateDimensions(newDimensions)
          // Position will be adjusted by cabinets to the left if needed
        }
        
        // Update child cabinets (fillers/panels) when parent changes
        updateChildCabinets(selectedCabinet, cabinets, {
          heightChanged,
          widthChanged,
          depthChanged,
          positionChanged: false
        })
        
        // Update kicker position when parent dimensions change
        if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
          updateKickerPosition(selectedCabinet, cabinets, {
            dimensionsChanged: true
          })
        }
        
        // Update bulkhead position when parent dimensions change
        if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'top' || selectedCabinet.cabinetType === 'tall') {
          updateBulkheadPosition(selectedCabinet, cabinets, wallDimensions, {
            heightChanged: true,
            widthChanged: true,
            depthChanged: true,
            positionChanged: false
          })
        }

        // Distribute width delta among other synced cabinets
        // The algorithm is simple:
        // 1. Update all widths (changing cabinet gets new width, others shrink/grow proportionally)
        // 2. Reposition all cabinets left-to-right, maintaining edge-to-edge contact
        // This ensures: leftmost left edge fixed, rightmost right edge fixed (total width preserved)

        // otherSyncCabinets and deltaPerCabinet were already calculated above for validation
        const sortedOtherSyncCabinets = sortedSyncCabinets.filter(
          (c) => c.cabinetId !== selectedCabinet.cabinetId
        )

        console.log(
          `[Sync] Distributing delta: widthDelta=${widthDelta}, otherCabinets=${sortedOtherSyncCabinets.length}, deltaPerCabinet=${deltaPerCabinet}`
        )

        // Update widths for all other synced cabinets
        sortedOtherSyncCabinets.forEach((cab) => {
          const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
          cab.carcass.updateDimensions({
            width: newWidth,
            height: cab.carcass.dimensions.height,
            depth: cab.carcass.dimensions.depth,
          })
          updateChildCabinets(cab, cabinets, {
            widthChanged: true
          })
          if (cab.cabinetType === 'base' || cab.cabinetType === 'tall') {
            updateKickerPosition(cab, cabinets, {
              dimensionsChanged: true
            })
          }
          if (
            cab.cabinetType === 'base' ||
            cab.cabinetType === 'top' ||
            cab.cabinetType === 'tall'
          ) {
            updateBulkheadPosition(cab, cabinets, wallDimensions, {
              heightChanged: true,
              widthChanged: true,
              depthChanged: false,
              positionChanged: false
            })
          }
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
          cab.group.position.set(
            newX,
            cab.group.position.y,
            cab.group.position.z
          )
          
          // Update child cabinets (fillers/panels) when parent position changes due to sync
          if (Math.abs(newX - oldX) > 0.1) {
            updateChildCabinets(cab, cabinets, {
              positionChanged: true
            })
            
            // Update kicker position when parent position changes
            if (cab.cabinetType === 'base' || cab.cabinetType === 'tall') {
              updateKickerPosition(cab, cabinets, {
                positionChanged: true
              })
            }
          }
          
          currentEffectiveLeft = targetEffectiveLeft + effectiveWidth
        })

        console.log(
          `[Sync] Final effective right edge: ${currentEffectiveLeft.toFixed(
            2
          )}, expected: ${rightmostEdge.toFixed(2)}`
        )

        // Sync logic applied - skip pair system and lock system
        return
      }
      // If sync didn't apply (not enough synced cabinets selected), continue to normal logic
    }

    // Validate pair constraints BEFORE applying any changes
    const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
    if (groupData && groupData.length > 0) {
      for (const groupCabinet of groupData) {
        const groupedCabinet = cabinets.find(
          (c) => c.cabinetId === groupCabinet.cabinetId
        )
        if (!groupedCabinet) continue

        const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
        const newGroupedWidth =
          groupedCabinet.carcass.dimensions.width + proportionalDelta

        const constraints = getWidthConstraints(groupedCabinet.productId)
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
      }
    }

    // Handle lock states and pair system (only if sync logic didn't apply)
    // Note: We're still inside the widthDelta !== 0 check from line 1560
    if (leftLock && rightLock) {
      // Both locks are active - cannot resize width
      toastThrottled(
        "Cannot resize width when both left and right edges are locked"
      )
      return
    } else if (leftLock) {
      // Left edge is locked - keep left edge fixed, move right edge
      // Position stays the same (left edge is frozen)
      // Just update dimensions
      selectedCabinet.carcass.updateDimensions(newDimensions)
      
      // Update child cabinets (fillers/panels) when parent changes
      updateChildCabinets(selectedCabinet, cabinets, {
        heightChanged,
        widthChanged,
        depthChanged,
        positionChanged: false
      })
      
      // Update kicker position when parent dimensions change
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
        updateKickerPosition(selectedCabinet, cabinets, {
          dimensionsChanged: true
        })
      }
      
      // Update bulkhead position when parent dimensions change (left lock - width changes, position stays same)
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'top' || selectedCabinet.cabinetType === 'tall') {
        updateBulkheadPosition(selectedCabinet, cabinets, wallDimensions, {
          heightChanged,
          widthChanged,
          depthChanged,
          positionChanged: false
        })
      }

      // Handle grouped cabinets (Pair system) - apply proportional width changes
      // Only apply if sync didn't apply
      const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
      if (groupData && groupData.length > 0) {
        groupData.forEach((groupCabinet) => {
          const groupedCabinet = cabinets.find(
            (c) => c.cabinetId === groupCabinet.cabinetId
          )
          if (!groupedCabinet) return

          // Calculate proportional width change
          const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
          const newGroupedWidth =
            groupedCabinet.carcass.dimensions.width + proportionalDelta

          // Respect lock properties of grouped cabinet
          const groupedLeftLock = groupedCabinet.leftLock ?? false
          const groupedRightLock = groupedCabinet.rightLock ?? false

          if (groupedLeftLock && groupedRightLock) {
            // Both locks active - cannot resize
            return
          } else if (groupedLeftLock) {
            // Left locked - extend to right
            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })
            
            // Update child cabinets (fillers/panels) when parent width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true
            })
            
            // Update kicker position when parent dimensions change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true
              })
            }
            
            // Update bulkhead position when parent dimensions change (paired cabinet, left lock, leftLock branch)
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: false
              })
            }
          } else if (groupedRightLock) {
            // Right locked - extend to left
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedRightEdge = groupedOldX + groupedOldWidth
            const groupedNewX = groupedRightEdge - newGroupedWidth

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, right lock)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          } else {
            // Neither lock - extend equally from center
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedCenterX = groupedOldX + groupedOldWidth / 2
            const groupedNewX = groupedCenterX - newGroupedWidth / 2

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, no lock)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          }
        })
      }

      // If cabinet belongs to a view, move all other cabinets to the right of this one
      if (
        selectedCabinet.viewId &&
        selectedCabinet.viewId !== "none" &&
        viewManager
      ) {
        const cabinetsInSameView = viewManager.getCabinetsInView(
          selectedCabinet.viewId as ViewId
        )
        const changingLeftEdge = oldX

        cabinetsInSameView.forEach((cabinetId) => {
          if (cabinetId === selectedCabinet.cabinetId) return

          const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
          if (!otherCabinet) return

          // Skip if cabinets are paired
          if (
            areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)
          ) {
            return
          }

          // Cabinet is on the RIGHT if it extends even 1mm toward positive X
          // Check if other cabinet's left edge is to the right of changing cabinet's left edge
          if (otherCabinet.group.position.x > changingLeftEdge) {
            const oldX = otherCabinet.group.position.x
            const newX = otherCabinet.group.position.x + widthDelta
            // Only clamp left boundary - right wall can be penetrated (auto-adjusts)
            const clampedX = Math.max(0, newX)
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position changes due to view repositioning
            if (Math.abs(clampedX - oldX) > 0.1) {
              updateChildCabinets(otherCabinet, cabinets, {
                positionChanged: true
              })
              
              // Update kicker position when parent position changes
              if (otherCabinet.cabinetType === 'base' || otherCabinet.cabinetType === 'tall') {
                updateKickerPosition(otherCabinet, cabinets, {
                  positionChanged: true
                })
              }
            }
          }
        })
      }
    } else if (rightLock) {
      // Right edge is locked - keep right edge fixed, move left edge
      const rightEdge = oldX + oldWidth
      const newX = rightEdge - newDimensions.width

      // Validate: check if pushing left cabinets would exceed the left wall
      if (
        selectedCabinet.viewId &&
        selectedCabinet.viewId !== "none" &&
        widthDelta > 0 // Only check when expanding (pushing left cabinets further left)
      ) {
        const overflow = checkLeftWallOverflow(
          widthDelta,
          selectedCabinet.cabinetId,
          rightEdge,
          selectedCabinet.viewId as ViewId
        )
        if (overflow !== null) {
          toastThrottled(
            `Cannot expand width: a cabinet would be pushed ${overflow.toFixed(
              0
            )}mm past the left wall. Please reduce the width or move cabinets first.`
          )
          // Emit event to sync ProductPanel UI with actual dimensions
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("productPanel:dimensionRejected")
            )
          }
          return
        }
      }

      // Update dimensions first
      selectedCabinet.carcass.updateDimensions(newDimensions)

      // Clamp new X position to wall bounds
      // Only clamp left boundary - right wall can be penetrated
      const clampedX = Math.max(0, newX)

      // Update cabinet position (move left edge)
      selectedCabinet.group.position.set(
        clampedX,
        selectedCabinet.group.position.y,
        selectedCabinet.group.position.z
      )
      
      // Update child cabinets (fillers/panels) when parent changes
      updateChildCabinets(selectedCabinet, cabinets, {
        heightChanged,
        widthChanged,
        depthChanged,
        positionChanged: Math.abs(clampedX - oldX) > 0.1
      })
      
      // Update kicker position when parent dimensions/position change
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
        updateKickerPosition(selectedCabinet, cabinets, {
          dimensionsChanged: true,
          positionChanged: Math.abs(clampedX - oldX) > 0.1
        })
      }
      
      // Update bulkhead position when parent dimensions/position change
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'top' || selectedCabinet.cabinetType === 'tall') {
        updateBulkheadPosition(selectedCabinet, cabinets, wallDimensions, {
          heightChanged: true,
          widthChanged: true,
          depthChanged: true,
          positionChanged: Math.abs(clampedX - oldX) > 0.1
        })
      }

      // Handle grouped cabinets - apply proportional width changes
      const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
      if (groupData && groupData.length > 0) {
        groupData.forEach((groupCabinet) => {
          const groupedCabinet = cabinets.find(
            (c) => c.cabinetId === groupCabinet.cabinetId
          )
          if (!groupedCabinet) return

          // Calculate proportional width change
          const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
          const newGroupedWidth =
            groupedCabinet.carcass.dimensions.width + proportionalDelta

          // Respect lock properties of grouped cabinet
          const groupedLeftLock = groupedCabinet.leftLock ?? false
          const groupedRightLock = groupedCabinet.rightLock ?? false

          if (groupedLeftLock && groupedRightLock) {
            // Both locks active - cannot resize
            return
          } else if (groupedLeftLock) {
            // Left locked - extend to right
            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })
            
            // Update child cabinets (fillers/panels) when parent width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true
            })
            
            // Update kicker position when parent dimensions change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true
              })
            }
            
            // Update bulkhead position when parent dimensions change (paired cabinet, left lock, rightLock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: false
              })
            }
          } else if (groupedRightLock) {
            // Right locked - extend to left
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedRightEdge = groupedOldX + groupedOldWidth
            const groupedNewX = groupedRightEdge - newGroupedWidth

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, right lock, rightLock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          } else {
            // Neither lock - extend equally from center
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedCenterX = groupedOldX + groupedOldWidth / 2
            const groupedNewX = groupedCenterX - newGroupedWidth / 2

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, no lock, rightLock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          }
        })
      }

      // If cabinet belongs to a view, move all other cabinets to the left of this one
      if (
        selectedCabinet.viewId &&
        selectedCabinet.viewId !== "none" &&
        viewManager
      ) {
        const cabinetsInSameView = viewManager.getCabinetsInView(
          selectedCabinet.viewId as ViewId
        )
        const changingRightEdge = oldX + oldWidth

        cabinetsInSameView.forEach((cabinetId) => {
          if (cabinetId === selectedCabinet.cabinetId) return

          const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
          if (!otherCabinet) return

          // Skip if cabinets are paired
          if (
            areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)
          ) {
            return
          }

          // Cabinet is on the LEFT if it extends even 1mm toward negative X
          // Check if other cabinet's right edge is to the left of changing cabinet's right edge
          if (
            otherCabinet.group.position.x +
              otherCabinet.carcass.dimensions.width <
            changingRightEdge
          ) {
            const oldX = otherCabinet.group.position.x
            const newX = otherCabinet.group.position.x - widthDelta
            // Only clamp left boundary - right wall can be penetrated (auto-adjusts)
            const clampedX = Math.max(0, newX)
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position changes due to view repositioning
            if (Math.abs(clampedX - oldX) > 0.1) {
              updateChildCabinets(otherCabinet, cabinets, {
                positionChanged: true
              })
              
              // Update kicker position when parent position changes
              if (otherCabinet.cabinetType === 'base' || otherCabinet.cabinetType === 'tall') {
                updateKickerPosition(otherCabinet, cabinets, {
                  positionChanged: true
                })
              }
            }
          }
        })
      }
    } else {
      // Neither lock is active - cabinet can extend/shrink by half widthDelta in both directions
      // Center position stays fixed, extends equally in both positive and negative X directions

      // Validate: check if pushing left cabinets would exceed the left wall
      // In neither lock mode, left cabinets get pushed by halfDelta
      if (
        selectedCabinet.viewId &&
        selectedCabinet.viewId !== "none" &&
        widthDelta > 0 // Only check when expanding (pushing left cabinets further left)
      ) {
        const halfDelta = widthDelta / 2
        const changingRightEdge = oldX + oldWidth
        const overflow = checkLeftWallOverflow(
          halfDelta,
          selectedCabinet.cabinetId,
          changingRightEdge,
          selectedCabinet.viewId as ViewId
        )
        if (overflow !== null) {
          toastThrottled(
            `Cannot expand width: a cabinet would be pushed ${overflow.toFixed(
              0
            )}mm past the left wall. Please reduce the width or move cabinets first.`
          )
          // Emit event to sync ProductPanel UI with actual dimensions
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("productPanel:dimensionRejected")
            )
          }
          return
        }
      }

      // Calculate center position
      const centerX = oldX + oldWidth / 2
      // Calculate new left edge position (center - half of new width)
      const newX = centerX - newDimensions.width / 2

      // Clamp new X position to wall bounds
      // Only clamp left boundary - right wall can be penetrated
      const clampedX = Math.max(0, newX)

      // Update dimensions first
      selectedCabinet.carcass.updateDimensions(newDimensions)

      // Update cabinet position (center remains fixed, extends equally both sides)
      selectedCabinet.group.position.set(
        clampedX,
        selectedCabinet.group.position.y,
        selectedCabinet.group.position.z
      )
      
      // Update child cabinets (fillers/panels) when parent changes
      updateChildCabinets(selectedCabinet, cabinets, {
        heightChanged,
        widthChanged,
        depthChanged,
        positionChanged: Math.abs(clampedX - oldX) > 0.1
      })
      
      // Update kicker position when parent dimensions/position change
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
        updateKickerPosition(selectedCabinet, cabinets, {
          dimensionsChanged: true,
          positionChanged: Math.abs(clampedX - oldX) > 0.1
        })
      }
      
      // Update bulkhead position when parent dimensions/position change
      if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'top' || selectedCabinet.cabinetType === 'tall') {
        updateBulkheadPosition(selectedCabinet, cabinets, wallDimensions, {
          heightChanged: true,
          widthChanged: true,
          depthChanged: true,
          positionChanged: Math.abs(clampedX - oldX) > 0.1
        })
      }

      // Handle grouped cabinets - apply proportional width changes
      const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
      if (groupData && groupData.length > 0) {
        groupData.forEach((groupCabinet) => {
          const groupedCabinet = cabinets.find(
            (c) => c.cabinetId === groupCabinet.cabinetId
          )
          if (!groupedCabinet) return

          // Calculate proportional width change
          const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
          const newGroupedWidth =
            groupedCabinet.carcass.dimensions.width + proportionalDelta

          // Respect lock properties of grouped cabinet
          const groupedLeftLock = groupedCabinet.leftLock ?? false
          const groupedRightLock = groupedCabinet.rightLock ?? false

          if (groupedLeftLock && groupedRightLock) {
            // Both locks active - cannot resize
            return
          } else if (groupedLeftLock) {
            // Left locked - extend to right
            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })
            
            // Update child cabinets (fillers/panels) when parent width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true
            })
            
            // Update kicker position when parent dimensions change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true
              })
            }
            
            // Update bulkhead position when parent dimensions change (paired cabinet, left lock, no-lock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: false
              })
            }
          } else if (groupedRightLock) {
            // Right locked - extend to left
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedRightEdge = groupedOldX + groupedOldWidth
            const groupedNewX = groupedRightEdge - newGroupedWidth

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, right lock, no-lock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          } else {
            // Neither lock - extend equally from center
            const groupedOldX = groupedCabinet.group.position.x
            const groupedOldWidth = groupedCabinet.carcass.dimensions.width
            const groupedCenterX = groupedOldX + groupedOldWidth / 2
            const groupedNewX = groupedCenterX - newGroupedWidth / 2

            groupedCabinet.carcass.updateDimensions({
              width: newGroupedWidth,
              height: groupedCabinet.carcass.dimensions.height,
              depth: groupedCabinet.carcass.dimensions.depth,
            })

            const clampedX = Math.max(
              0,
              groupedNewX // Right wall can be penetrated - no right boundary limit
            )
            groupedCabinet.group.position.set(
              clampedX,
              groupedCabinet.group.position.y,
              groupedCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position/width changes
            updateChildCabinets(groupedCabinet, cabinets, {
              widthChanged: true,
              positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
            })
            
            // Update kicker position when parent dimensions/position change
            if (groupedCabinet.cabinetType === 'base' || groupedCabinet.cabinetType === 'tall') {
              updateKickerPosition(groupedCabinet, cabinets, {
                dimensionsChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
            
            // Update bulkhead position when parent dimensions/position change (paired cabinet, no lock, no-lock branch)
            if (groupedCabinet.cabinetType === 'top' || groupedCabinet.cabinetType === 'tall') {
              updateBulkheadPosition(groupedCabinet, cabinets, wallDimensions, {
                widthChanged: true,
                positionChanged: Math.abs(clampedX - groupedOldX) > 0.1
              })
            }
          }
        })
      }

      // Move other cabinets in the view based on half delta
      // All cabinets on the RIGHT side move by halfDelta in positive X direction
      // All cabinets on the LEFT side move by halfDelta in negative X direction
      if (
        selectedCabinet.viewId &&
        selectedCabinet.viewId !== "none" &&
        viewManager
      ) {
        const cabinetsInSameView = viewManager.getCabinetsInView(
          selectedCabinet.viewId as ViewId
        )
        const halfDelta = widthDelta / 2
        const changingLeftEdge = oldX
        const changingRightEdge = oldX + oldWidth

        cabinetsInSameView.forEach((cabinetId) => {
          if (cabinetId === selectedCabinet.cabinetId) return

          const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
          if (!otherCabinet) return

          // Skip if cabinets are paired
          if (
            areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)
          ) {
            return
          }

          const otherX = otherCabinet.group.position.x
          const otherWidth = otherCabinet.carcass.dimensions.width
          const otherRight = otherX + otherWidth

          // Move cabinets on the LEFT side by halfDelta (negative X direction)
          // Cabinet is on the LEFT if it extends even 1mm toward negative X
          if (otherRight < changingRightEdge) {
            const oldX = otherCabinet.group.position.x
            const newX = otherCabinet.group.position.x - halfDelta
            // Only clamp left boundary - right wall can be penetrated (auto-adjusts)
            const clampedX = Math.max(0, newX)
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position changes due to view repositioning
            if (Math.abs(clampedX - oldX) > 0.1) {
              updateChildCabinets(otherCabinet, cabinets, {
                positionChanged: true
              })
              
              // Update kicker position when parent position changes
              if (otherCabinet.cabinetType === 'base' || otherCabinet.cabinetType === 'tall') {
                updateKickerPosition(otherCabinet, cabinets, {
                  positionChanged: true
                })
              }
            }
          }
          // Move cabinets on the RIGHT side by halfDelta (positive X direction)
          // Cabinet is on the RIGHT if it extends even 1mm toward positive X
          else if (otherX > changingLeftEdge) {
            const oldX = otherCabinet.group.position.x
            const newX = otherCabinet.group.position.x + halfDelta
            // Only clamp left boundary - right wall can be penetrated (auto-adjusts)
            const clampedX = Math.max(0, newX)
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
            
            // Update child cabinets (fillers/panels) when parent position changes due to view repositioning
            if (Math.abs(clampedX - oldX) > 0.1) {
              updateChildCabinets(otherCabinet, cabinets, {
                positionChanged: true
              })
              
              // Update kicker position when parent position changes
              if (otherCabinet.cabinetType === 'base' || otherCabinet.cabinetType === 'tall') {
                updateKickerPosition(otherCabinet, cabinets, {
                  positionChanged: true
                })
              }
            }
          }
        })
      }
    }
  } else {
    // Width didn't change, just update other dimensions
    selectedCabinet.carcass.updateDimensions(newDimensions)
    
    // Update child cabinets (fillers/panels) when parent changes
    updateChildCabinets(selectedCabinet, cabinets, {
      heightChanged,
      widthChanged: false,
      depthChanged,
      positionChanged: false
    })
    
    // Update kicker position when parent dimensions change
    if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
      updateKickerPosition(selectedCabinet, cabinets, {
        dimensionsChanged: true
      })
    }
    
    // If selected cabinet is a child filler/panel, update parent kicker when child dimensions change
    if (
      selectedCabinet.parentCabinetId &&
      (selectedCabinet.cabinetType === 'filler' || selectedCabinet.cabinetType === 'panel') &&
      selectedCabinet.hideLockIcons === true &&
      (widthChanged || depthChanged) // Only width and depth affect kicker extension
    ) {
      const parentCabinet = cabinets.find(c => c.cabinetId === selectedCabinet.parentCabinetId)
      if (parentCabinet && (parentCabinet.cabinetType === 'base' || parentCabinet.cabinetType === 'tall')) {
        updateKickerPosition(parentCabinet, cabinets, {
          dimensionsChanged: true
        })
      }
    }
    
    // Update bulkhead position when parent dimensions change (height or depth changed)
    if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'top' || selectedCabinet.cabinetType === 'tall') {
      updateBulkheadPosition(selectedCabinet, cabinets, wallDimensions, {
        heightChanged,
        widthChanged: false,
        depthChanged,
        positionChanged: false
      })
    }
  }
}
