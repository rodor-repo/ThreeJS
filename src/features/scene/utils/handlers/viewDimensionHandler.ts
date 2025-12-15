import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { cabinetPanelState } from "../../../cabinets/ui/ProductPanel"
import { updateAllDependentComponents } from "./dependentComponentsHandler"
import {
  applyWidthChangeWithLock,
  processGroupedCabinets,
} from "./lockBehaviorHandler"
import { repositionViewCabinets } from "./viewRepositionHandler"

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

    // Disable height and depth editing for fillers/panels added from modal
    const isModalFillerOrPanel =
      (cabinet.cabinetType === "filler" || cabinet.cabinetType === "panel") &&
      cabinet.hideLockIcons === true

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
      // Update shelf count directly on the carcass
      cabinet.carcass.updateConfig({ shelfCount: newValue })
      return // Shelf count doesn't affect dimensions, so we can return early
    } else if (doorOverhangGDIds.includes(dimObj.GDId)) {
      // Handle door overhang - convert numeric value to boolean
      let overhangDoor: boolean
      if (typeof newValue === "number") {
        overhangDoor = newValue === 1 || newValue > 0
      } else {
        const valStr = String(newValue).toLowerCase()
        overhangDoor = valStr === "yes" || valStr === "true" || valStr === "1"
      }

      // Apply door overhang to ALL top/overhead cabinets
      cabinets.forEach((cab) => {
        if (cab.cabinetType === "top") {
          cab.carcass.updateOverhangDoor(overhangDoor)
          // Update cabinetPanelState if this cabinet has the dimension
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

          // Update child cabinets when overhang changes
          updateAllDependentComponents(cab, cabinets, wallDimensions, {
            overhangChanged: true,
          })
        }
      })
      return // Door overhang doesn't affect dimensions
    } else {
      // Not a primary dimension, skip
      return
    }

    // Store old dimensions and position
    const oldWidth = cabinet.carcass.dimensions.width
    const oldHeight = cabinet.carcass.dimensions.height
    const oldDepth = cabinet.carcass.dimensions.depth
    const oldX = cabinet.group.position.x

    // Calculate deltas and detect changes
    const widthDelta = width - oldWidth
    const heightChanged = Math.abs(height - oldHeight) > 0.1
    const widthChanged = Math.abs(width - oldWidth) > 0.1
    const depthChanged = Math.abs(depth - oldDepth) > 0.1

    // Handle width changes
    if (widthDelta !== 0) {
      // Apply width change with lock behavior
      const lockResult = applyWidthChangeWithLock(
        cabinet,
        width,
        oldWidth,
        oldX
      )

      // If both locks prevent resize, skip this cabinet
      if (!lockResult) return

      const { newX, positionChanged } = lockResult

      // Update dimensions
      cabinet.carcass.updateDimensions({ width, height, depth })

      // Update position
      cabinet.group.position.set(
        newX,
        cabinet.group.position.y,
        cabinet.group.position.z
      )

      // Update all dependent components (FIXED: was missing in original)
      updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
        heightChanged,
        widthChanged,
        depthChanged,
        positionChanged,
      })

      // Handle grouped cabinets
      processGroupedCabinets(
        cabinet,
        widthDelta,
        cabinets,
        cabinetGroups,
        wallDimensions
      )

      // Reposition other cabinets in the view
      repositionViewCabinets(
        cabinet,
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
      cabinet.carcass.updateDimensions({ width, height, depth })

      // Update all dependent components (FIXED: was missing in original)
      updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
        heightChanged,
        widthChanged: false,
        depthChanged,
        positionChanged: false,
      })
    }
  })
}
