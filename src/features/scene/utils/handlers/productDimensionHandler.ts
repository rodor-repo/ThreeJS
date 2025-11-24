import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
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

  // Store old width and position before updating
  const oldWidth = selectedCabinet.carcass.dimensions.width
  const oldX = selectedCabinet.group.position.x
  const leftLock = selectedCabinet.leftLock ?? false
  const rightLock = selectedCabinet.rightLock ?? false

  // Calculate width delta (how much the width changed)
  const widthDelta = newDimensions.width - oldWidth

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
        console.log(
          `[Sync] Sync logic triggered! Selected sync cabinets: ${selectedSyncCabinets.length}, widthDelta: ${widthDelta}`
        )

        // Sort cabinets by X position (left to right)
        const sortedSyncCabinets = [...selectedSyncCabinets].sort(
          (a, b) => a.group.position.x - b.group.position.x
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

        // Calculate initial sync width and positions
        const leftmostX = sortedSyncCabinets[0].group.position.x
        const rightmostCabinet =
          sortedSyncCabinets[sortedSyncCabinets.length - 1]
        const rightmostX =
          rightmostCabinet.group.position.x +
          rightmostCabinet.carcass.dimensions.width
        const initialSyncWidth = rightmostX - leftmostX

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

        // Calculate new sync width
        const newSyncWidth = initialSyncWidth + widthDelta

        // Get cabinets to the right of the changing cabinet
        const cabinetsToRight = sortedSyncCabinets.slice(
          changingCabinetIndex + 1
        )
        const cabinetsToLeft = sortedSyncCabinets.slice(0, changingCabinetIndex)

        // Distribute width delta among other selected synced cabinets
        // Repositioning depends on position in X-SyncList:
        // - Rightmost cabinets: resize and maintain right edge position (move left)
        // - Middle cabinets: resize and reposition left based on adjustments from right
        if (cabinetsToRight.length > 0) {
          // Distribute delta among cabinets to the right
          // Negative delta (width decreased) means other cabinets increase width
          // Positive delta (width increased) means other cabinets decrease width
          const deltaPerCabinet = -widthDelta / cabinetsToRight.length

          // Store rightmost right edge to maintain it
          const rightmostCabinet = cabinetsToRight[cabinetsToRight.length - 1]
          const rightmostRightEdge =
            rightmostCabinet.group.position.x +
            rightmostCabinet.carcass.dimensions.width

          // Process from rightmost to leftmost (right to left)
          // Rightmost: Size adjustment, extend left (right edge fixed), Position: No move (right edge stays fixed)
          // Middle: Size adjustment, extend left, Position: Move left by width increase of cabinets to the right

          // First, calculate width increases for all cabinets
          const widthIncreases: number[] = []
          for (let i = 0; i < cabinetsToRight.length; i++) {
            widthIncreases.push(deltaPerCabinet)
          }

          // Process from rightmost to leftmost
          // IMPORTANT: Process rightmost first, then middle cabinets
          // This ensures we can calculate cumulative shifts correctly
          for (let i = cabinetsToRight.length - 1; i >= 0; i--) {
            const cab = cabinetsToRight[i]
            const oldWidth = cab.carcass.dimensions.width
            const newWidth = oldWidth + deltaPerCabinet
            const oldCabX = cab.group.position.x

            if (i === cabinetsToRight.length - 1) {
              // Cabinet #3 (rightmost):
              // - Size adjustment: +deltaPerCabinet
              // - Direction: Like locked on right (extend toward X negative/left)
              // - Position: No move (right edge stays fixed, so X moves left by width increase)

              // Update dimensions first
              cab.carcass.updateDimensions({
                width: newWidth,
                height: cab.carcass.dimensions.height,
                depth: cab.carcass.dimensions.depth,
              })

              const newCabX = rightmostRightEdge - newWidth
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newCabX)

              console.log(
                `[Sync] Rightmost cabinet (index ${i}): oldX=${oldCabX.toFixed(
                  2
                )}, newWidth=${newWidth.toFixed(
                  2
                )}, rightEdge=${rightmostRightEdge.toFixed(
                  2
                )}, newX=${newCabX.toFixed(2)}, clampedX=${clampedX.toFixed(2)}`
              )

              cab.group.position.set(
                clampedX,
                cab.group.position.y,
                cab.group.position.z
              )
            } else {
              // Cabinet #2 (middle):
              // - Size adjustment: +deltaPerCabinet (e.g., +50mm)
              // - Direction: Like locked from right (extend toward X negative/left)
              // - Position: Move left by cumulative width increase of cabinets to the right

              // Calculate how many cabinets are to the right (higher indices)
              const cabinetsToRightCount = cabinetsToRight.length - (i + 1)
              // Each cabinet to the right increased by deltaPerCabinet
              // Example: If #3 (1 cabinet to the right) increased by 50mm, #2 moves left by 50mm
              const cumulativeWidthIncrease =
                cabinetsToRightCount * deltaPerCabinet

              // Update dimensions first
              cab.carcass.updateDimensions({
                width: newWidth,
                height: cab.carcass.dimensions.height,
                depth: cab.carcass.dimensions.depth,
              })

              // Move left by the cumulative width increase
              // This ensures Cabinet #2 moves left by the width increase of Cabinet #3
              const newCabX = oldCabX - cumulativeWidthIncrease

              // Clamp to wall boundaries
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newCabX)

              console.log(
                `[Sync] Middle cabinet (index ${i}): oldX=${oldCabX.toFixed(
                  2
                )}, cumulativeWidthIncrease=${cumulativeWidthIncrease.toFixed(
                  2
                )}, newX=${newCabX.toFixed(2)}, clampedX=${clampedX.toFixed(
                  2
                )}, newWidth=${newWidth.toFixed(2)}`
              )

              // Set position - this should move Cabinet #2 left by cumulativeWidthIncrease
              // Use set() with all three coordinates to ensure position is updated
              cab.group.position.set(
                clampedX,
                cab.group.position.y,
                cab.group.position.z
              )

              // Force update matrix to ensure position change is applied
              cab.group.updateMatrixWorld(true)

              // Verify position was set correctly
              const actualX = cab.group.position.x
              console.log(
                `[Sync] Position set - Expected: ${clampedX.toFixed(
                  2
                )}, Actual: ${actualX.toFixed(2)}, Difference: ${(
                  actualX - clampedX
                ).toFixed(2)}`
              )

              if (Math.abs(actualX - clampedX) > 0.1) {
                console.warn(
                  `[Sync] ⚠️ Position mismatch! Expected ${clampedX.toFixed(
                    2
                  )}, got ${actualX.toFixed(2)}`
                )
              } else {
                console.log(
                  `[Sync] ✅ Position set correctly for middle cabinet`
                )
              }
            }
          }

          // Calculate total width increase for left cabinets
          const totalWidthIncrease = cabinetsToRight.length * deltaPerCabinet

          // If there are cabinets to the left of changing cabinet, shift them left too
          if (cabinetsToLeft.length > 0) {
            // Shift left by the total width increase of all right cabinets
            cabinetsToLeft.forEach((cab) => {
              const newCabX = cab.group.position.x - totalWidthIncrease
              cab.group.position.set(
                Math.max(0, newCabX), // Only clamp left boundary - right wall can be penetrated
                cab.group.position.y,
                cab.group.position.z
              )
            })
          }
        } else if (cabinetsToLeft.length > 0) {
          // All cabinets to adjust are on the left - extend right
          // Negative delta (width decreased) means left cabinets increase width
          // Positive delta (width increased) means left cabinets decrease width
          const deltaPerCabinet = -widthDelta / cabinetsToLeft.length

          // Leftmost cabinet maintains left edge, others shift right
          cabinetsToLeft.forEach((cab, index) => {
            const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
            const oldCabX = cab.group.position.x

            // Update dimensions
            cab.carcass.updateDimensions({
              width: newWidth,
              height: cab.carcass.dimensions.height,
              depth: cab.carcass.dimensions.depth,
            })

            if (index === 0) {
              // Leftmost: maintain left edge position (X stays same, extends right)
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, oldCabX)
              cab.group.position.set(
                clampedX,
                cab.group.position.y,
                cab.group.position.z
              )
            } else {
              // Middle cabinets: shift right based on cumulative width changes from left
              // Calculate cumulative shift from all cabinets to the left
              let cumulativeRightShift = 0
              for (let j = 0; j < index; j++) {
                cumulativeRightShift += deltaPerCabinet
              }
              const newCabX = oldCabX + cumulativeRightShift
              cab.group.position.set(
                Math.max(0, newCabX), // Only clamp left boundary - right wall can be penetrated
                cab.group.position.y,
                cab.group.position.z
              )
            }
          })
        }

        // Sync logic applied - skip pair system and lock system
        return
      }
      // If sync didn't apply (not enough synced cabinets selected), continue to normal logic
    }

    // Handle lock states and pair system (only if sync logic didn't apply)
    // Note: We're still inside the widthDelta !== 0 check from line 1560
    if (leftLock && rightLock) {
      // Both locks are active - cannot resize width
      alert("Cannot resize width when both left and right edges are locked")
      return
    } else if (leftLock) {
      // Left edge is locked - keep left edge fixed, move right edge
      // Position stays the same (left edge is frozen)
      // Just update dimensions
      selectedCabinet.carcass.updateDimensions(newDimensions)

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
            const newX = otherCabinet.group.position.x + widthDelta
            const clampedX = Math.max(
              0,
              Math.min(
                wallDimensions.length - otherCabinet.carcass.dimensions.width,
                newX
              )
            )
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
          }
        })
      }
    } else if (rightLock) {
      // Right edge is locked - keep right edge fixed, move left edge
      const rightEdge = oldX + oldWidth
      const newX = rightEdge - newDimensions.width

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
            const newX = otherCabinet.group.position.x - widthDelta
            const clampedX = Math.max(
              0,
              Math.min(
                wallDimensions.length - otherCabinet.carcass.dimensions.width,
                newX
              )
            )
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
          }
        })
      }
    } else {
      // Neither lock is active - cabinet can extend/shrink by half widthDelta in both directions
      // Center position stays fixed, extends equally in both positive and negative X directions
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
            const newX = otherCabinet.group.position.x - halfDelta
            const clampedX = Math.max(
              0,
              Math.min(
                wallDimensions.length - otherCabinet.carcass.dimensions.width,
                newX
              )
            )
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
          }
          // Move cabinets on the RIGHT side by halfDelta (positive X direction)
          // Cabinet is on the RIGHT if it extends even 1mm toward positive X
          else if (otherX > changingLeftEdge) {
            const newX = otherCabinet.group.position.x + halfDelta
            const clampedX = Math.max(
              0,
              Math.min(
                wallDimensions.length - otherCabinet.carcass.dimensions.width,
                newX
              )
            )
            otherCabinet.group.position.set(
              clampedX,
              otherCabinet.group.position.y,
              otherCabinet.group.position.z
            )
          }
        })
      }
    }
  } else {
    // Width didn't change, just update other dimensions
    selectedCabinet.carcass.updateDimensions(newDimensions)
  }
}
