import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { cabinetPanelState } from "../../../cabinets/ui/ProductPanel"
import { updateChildCabinets } from "./childCabinetHandler"

// Define the interface for the ViewManager hook result (subset used here)
interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

// Helper type for the product data map
type ProductDataMap = Map<string, any>

export const handleViewDimensionChange = (
  gdId: string,
  newValue: number,
  productDataMap: ProductDataMap,
  params: {
    cabinets: CabinetData[]
    cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  }
) => {
  const { cabinets, cabinetGroups, viewManager, wallDimensions } = params

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

  // Find all cabinets that have this GDId in their product dimensions
  const cabinetsToUpdate: Array<{
    cabinet: CabinetData
    dimId: string
    productData: any
  }> = []

  // Use the provided product data map instead of fetching
  productDataMap.forEach((productData, productId) => {
    if (!productData?.product?.dims) return

    // Find dimensions with this GDId
    const dims = productData.product.dims
    Object.entries(dims).forEach(([dimId, dimObj]: [string, any]) => {
      if (dimObj.GDId === gdId && dimObj.visible !== false) {
        // Find all cabinets with this productId
        const cabinetsWithProduct = cabinets.filter(
          (c) => c.productId === productId
        )
        cabinetsWithProduct.forEach((cabinet) => {
          cabinetsToUpdate.push({ cabinet, dimId, productData })
        })
      }
    })
  })

  // Get threeJsGDs mapping from first product (they should all have the same mapping)
  const firstProductData = cabinetsToUpdate[0]?.productData
  if (!firstProductData?.threeJsGDs) return

  const widthGDIds = firstProductData.threeJsGDs["width"] || []
  const heightGDIds = firstProductData.threeJsGDs["height"] || []
  const depthGDIds = firstProductData.threeJsGDs["depth"] || []
  const shelfQtyGDIds = firstProductData.threeJsGDs["shelfQty"] || []
  const doorOverhangGDIds = firstProductData.threeJsGDs["doorOverhang"] || []

  // Update each cabinet
  cabinetsToUpdate.forEach(({ cabinet, dimId, productData }) => {
    // Update cabinetPanelState
    const persisted = cabinetPanelState.get(cabinet.cabinetId)
    const updatedValues = { ...(persisted?.values || {}), [dimId]: newValue }
    cabinetPanelState.set(cabinet.cabinetId, {
      ...(persisted || { values: {}, materialColor: "#ffffff" }),
      values: updatedValues,
    })

    // Determine which dimension (width/height/depth/shelfQty) this GDId maps to
    const dimObj = productData.product.dims[dimId]
    if (!dimObj?.GDId) return

    let width = cabinet.carcass.dimensions.width
    let height = cabinet.carcass.dimensions.height
    let depth = cabinet.carcass.dimensions.depth
    let shelfCount: number | undefined = cabinet.carcass?.config?.shelfCount

    // Disable height and depth editing for fillers/panels added from modal
    const isModalFillerOrPanel = (cabinet.cabinetType === 'filler' || cabinet.cabinetType === 'panel') && cabinet.hideLockIcons === true
    
    if (widthGDIds.includes(dimObj.GDId)) {
      width = newValue
    } else if (heightGDIds.includes(dimObj.GDId)) {
      // Skip height updates for modal fillers/panels
      if (isModalFillerOrPanel) {
        return // Don't update height for modal fillers/panels
      }
      height = newValue
    } else if (depthGDIds.includes(dimObj.GDId)) {
      // Skip depth updates for modal fillers/panels
      if (isModalFillerOrPanel) {
        return // Don't update depth for modal fillers/panels
      }
      depth = newValue
    } else if (shelfQtyGDIds.includes(dimObj.GDId)) {
      shelfCount = newValue
      // Update shelf count directly on the carcass
      cabinet.carcass.updateConfig({ shelfCount: newValue })
      return // Shelf count doesn't affect dimensions, so we can return early
    } else if (doorOverhangGDIds.includes(dimObj.GDId)) {
      // Handle door overhang - convert numeric value to boolean
      // If it's a selection type, the value might be 1/0 or "yes"/"no"
      let overhangDoor: boolean
      if (typeof newValue === "number") {
        overhangDoor = newValue === 1 || newValue > 0
      } else {
        const valStr = String(newValue).toLowerCase()
        overhangDoor = valStr === "yes" || valStr === "true" || valStr === "1"
      }

      // Apply door overhang to ALL top/overhead cabinets, not just those with this dimension
      // This ensures all overhead cabinets get updated
      cabinets.forEach((cab) => {
        if (cab.cabinetType === "top") {
          cab.carcass.updateOverhangDoor(overhangDoor)
          // Also update cabinetPanelState if this cabinet has the dimension
          const cabPersisted = cabinetPanelState.get(cab.cabinetId)
          if (cabPersisted) {
            const cabUpdatedValues = {
              ...cabPersisted.values,
              [dimId]: newValue,
            }
            cabinetPanelState.set(cab.cabinetId, {
              ...cabPersisted,
              values: cabUpdatedValues,
            })
          }
          
          // Update child cabinets (fillers/panels) when overhang changes
          updateChildCabinets(cab, cabinets, {
            overhangChanged: true
          })
        }
      })
      return // Door overhang doesn't affect dimensions, so we can return early
    } else {
      // Not a primary dimension, skip
      return
    }

    // Store old width and position before updating
    const oldWidth = cabinet.carcass.dimensions.width
    const oldX = cabinet.group.position.x
    const leftLock = cabinet.leftLock ?? false
    const rightLock = cabinet.rightLock ?? false

    // Calculate width delta (how much the width changed)
    const widthDelta = width - oldWidth

    // Handle lock states for width changes
    if (widthDelta !== 0) {
      if (leftLock && rightLock) {
        // Both locks are active - cannot resize width
        // Skip this cabinet update
        return
      } else if (leftLock) {
        // Left edge is locked - can ONLY extend from right side (positive X direction)
        // Position stays the same (left edge is frozen)
        cabinet.carcass.updateDimensions({ width, height, depth })

        // Handle grouped cabinets - apply proportional width changes
        const groupData = cabinetGroups.get(cabinet.cabinetId)
        if (groupData && groupData.length > 0) {
          groupData.forEach((groupCabinet) => {
            const groupedCabinet = cabinets.find(
              (c) => c.cabinetId === groupCabinet.cabinetId
            )
            if (!groupedCabinet) return

            // Calculate proportional width change
            const proportionalDelta =
              (widthDelta * groupCabinet.percentage) / 100
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
              groupedCabinet.group.position.set(
                clampedX,
                groupedCabinet.group.position.y,
                groupedCabinet.group.position.z
              )
            }
          })
        }

        // If cabinet belongs to a view, handle other cabinets in the view
        if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
          const cabinetsInSameView = viewManager.getCabinetsInView(
            cabinet.viewId as ViewId
          )
          const changingLeftEdge = oldX

          // Move all cabinets on the RIGHT side by widthDelta (positive X direction)
          cabinetsInSameView.forEach((cabinetId) => {
            if (cabinetId === cabinet.cabinetId) return

            const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
            if (!otherCabinet) return

            // Skip if cabinets are paired
            if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
              return
            }

            // Cabinet is on the RIGHT if it extends even 1mm toward positive X
            // Check if other cabinet's left edge is to the right of changing cabinet's left edge
            if (otherCabinet.group.position.x > changingLeftEdge) {
              const newX = otherCabinet.group.position.x + widthDelta
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newX)

              otherCabinet.group.position.set(
                clampedX,
                otherCabinet.group.position.y,
                otherCabinet.group.position.z
              )
            }
          })
        }
      } else if (rightLock) {
        // Right edge is locked - can ONLY extend from left side (negative X direction)
        const rightEdge = oldX + oldWidth
        const leftEdge = oldX
        const newX = rightEdge - width

        // Update dimensions first
        cabinet.carcass.updateDimensions({ width, height, depth })

        // Clamp new X position to left boundary only - right wall can be penetrated
        const clampedX = Math.max(0, newX)

        // Update cabinet position (move left edge)
        cabinet.group.position.set(
          clampedX,
          cabinet.group.position.y,
          cabinet.group.position.z
        )

        // Handle grouped cabinets - apply proportional width changes
        const groupData = cabinetGroups.get(cabinet.cabinetId)
        if (groupData && groupData.length > 0) {
          groupData.forEach((groupCabinet) => {
            const groupedCabinet = cabinets.find(
              (c) => c.cabinetId === groupCabinet.cabinetId
            )
            if (!groupedCabinet) return

            // Calculate proportional width change
            const proportionalDelta =
              (widthDelta * groupCabinet.percentage) / 100
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
              groupedCabinet.group.position.set(
                clampedX,
                groupedCabinet.group.position.y,
                groupedCabinet.group.position.z
              )
            }
          })
        }

        // If cabinet belongs to a view, handle other cabinets in the view
        if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
          const cabinetsInSameView = viewManager.getCabinetsInView(
            cabinet.viewId as ViewId
          )
          const changingRightEdge = oldX + oldWidth

          // Move all cabinets on the LEFT side by widthDelta (negative X direction)
          cabinetsInSameView.forEach((cabinetId) => {
            if (cabinetId === cabinet.cabinetId) return

            const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
            if (!otherCabinet) return

            // Skip if cabinets are paired
            if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
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
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newX)

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
        const newX = centerX - width / 2

        // Clamp new X position to left boundary only - right wall can be penetrated
        const clampedX = Math.max(0, newX)

        // Update dimensions first
        cabinet.carcass.updateDimensions({ width, height, depth })

        // Update cabinet position (center remains fixed, extends equally both sides)
        cabinet.group.position.set(
          clampedX,
          cabinet.group.position.y,
          cabinet.group.position.z
        )

        // Handle grouped cabinets - apply proportional width changes
        const groupData = cabinetGroups.get(cabinet.cabinetId)
        if (groupData && groupData.length > 0) {
          groupData.forEach((groupCabinet) => {
            const groupedCabinet = cabinets.find(
              (c) => c.cabinetId === groupCabinet.cabinetId
            )
            if (!groupedCabinet) return

            // Calculate proportional width change
            const proportionalDelta =
              (widthDelta * groupCabinet.percentage) / 100
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
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

              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, groupedNewX)
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
        if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
          const cabinetsInSameView = viewManager.getCabinetsInView(
            cabinet.viewId as ViewId
          )
          const halfDelta = widthDelta / 2
          const changingLeftEdge = oldX
          const changingRightEdge = oldX + oldWidth

          cabinetsInSameView.forEach((cabinetId) => {
            if (cabinetId === cabinet.cabinetId) return

            const otherCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
            if (!otherCabinet) return

            // Skip if cabinets are paired
            if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
              return
            }

            const otherX = otherCabinet.group.position.x
            const otherWidth = otherCabinet.carcass.dimensions.width
            const otherRight = otherX + otherWidth

            // Move cabinets on the LEFT side by halfDelta (negative X direction)
            // Cabinet is on the LEFT if it extends even 1mm toward negative X
            if (otherRight < changingRightEdge) {
              const newX = otherCabinet.group.position.x - halfDelta
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newX)

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
              // Only clamp left boundary - right wall can be penetrated
              const clampedX = Math.max(0, newX)

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
      cabinet.carcass.updateDimensions({ width, height, depth })
    }
  })
}
