import { MutableRefObject } from "react"
import * as THREE from "three"
import { WsProducts } from "@/types/erpTypes"
import { CabinetData, CabinetType, WallDimensions } from "../../types"

type CreateCabinetFn = (
  cabinetType: CabinetType,
  subcategoryId: string,
  options: {
    productId: string
    productName?: string
    fillerReturnPosition?: "left" | "right"
    customDimensions?: {
      width?: number
      height?: number
      depth?: number
    }
    additionalProps?: Record<string, unknown>
  }
) => CabinetData | null | undefined

interface FillerHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  sceneRef?: MutableRefObject<THREE.Scene | null>
  wallDimensions: WallDimensions
  createCabinet: CreateCabinetFn
  updateCabinetViewId: (cabinetId: string, viewId?: string) => void
  updateCabinetLock: (cabinetId: string, leftLock: boolean, rightLock: boolean) => void
}

/**
 * Creates a filler or panel and attaches it to the specified parent cabinet.
 */
export const handleFillerSelect = (
  cabinetId: string,
  productId: string,
  side: "left" | "right",
  params: FillerHandlerParams
) => {
  const { cabinets, wsProducts, sceneRef, createCabinet, updateCabinetViewId, updateCabinetLock, wallDimensions } =
    params

  if (!wsProducts || (sceneRef && !sceneRef.current)) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!parentCabinet) return

  const productEntry = wsProducts.products[productId]
  if (!productEntry) return

  const productName = productEntry.product
  const designId = productEntry.designId
  const designEntry = wsProducts.designs[designId || ""]
  if (!designEntry) return

  const cabinetType = designEntry.type3D
  if (cabinetType !== "filler" && cabinetType !== "panel") return

  // Determine filler type from product name (only for fillers)
  const fillerType =
    cabinetType === "filler" &&
    (productName?.toLowerCase().includes("l shape") || productName?.toLowerCase().includes("l-shape"))
      ? "l-shape"
      : "linear"

  // Get filler subcategory (first filler/panel category)
  const fillersCategory = Object.entries(wsProducts.categories).find(
    ([, cat]) => cat.category.toLowerCase().includes("filler") || cat.category.toLowerCase().includes("panel")
  )
  if (!fillersCategory) return

  const [categoryId] = fillersCategory
  const fillerSubcategory = Object.entries(wsProducts.subCategories).find(([, sc]) => sc.categoryId === categoryId)
  if (!fillerSubcategory) return

  const [subcategoryId, subcategoryData] = fillerSubcategory

  // Match height to parent cabinet height
  const itemHeight = parentCabinet.carcass.dimensions.height

  // Determine filler return position for L-Shape fillers
  const fillerReturnPosition =
    cabinetType === "filler" && fillerType === "l-shape"
      ? side === "left"
        ? "right"
        : "left"
      : undefined

  // Create filler or panel
  const newCabinet = createCabinet(cabinetType, subcategoryId, {
    productId,
    productName,
    fillerReturnPosition,
    additionalProps: {
      hideLockIcons: true,
      parentCabinetId: cabinetId,
      parentSide: side,
    },
  })
  if (!newCabinet) return

  // Overhang handling for overhead cabinets
  const isOverheadWithOverhang = parentCabinet.cabinetType === "top" && parentCabinet.carcass.config.overhangDoor === true
  const overhangAmount = 20
  let finalHeight = itemHeight
  if (isOverheadWithOverhang) {
    finalHeight = itemHeight + overhangAmount
  }

  if (cabinetType === "filler") {
    newCabinet.carcass.updateDimensions({
      width: fillerType === "l-shape" ? 100 : 16,
      height: finalHeight,
      depth: fillerType === "l-shape" ? 40 : 100,
    })
  } else if (cabinetType === "panel") {
    const parentDepth = parentCabinet.carcass.dimensions.depth
    const productNameLower = productName?.toLowerCase() || ""
    const subcategoryName = subcategoryData?.subCategory?.toLowerCase() || ""
    const isEndPanel =
      productNameLower.includes("end") ||
      productNameLower.includes("side panel") ||
      subcategoryName.includes("side-panel") ||
      subcategoryName.includes("side panel")

    const panelDepth = isEndPanel ? parentDepth + 20 : 600

    newCabinet.carcass.updateDimensions({
      width: 16,
      height: finalHeight,
      depth: panelDepth,
    })
  }

  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentY = parentCabinet.group.position.y
  const parentZ = parentCabinet.group.position.z
  const parentDepth = parentCabinet.carcass.dimensions.depth

  // Align with door front edge
  const doorMaterial = parentCabinet.carcass.config.doorMaterial
  const doorThickness = doorMaterial ? doorMaterial.getThickness() : 0
  const doorOffset = 2
  const doorFrontEdgeZ = parentZ + parentDepth + doorThickness + doorOffset

  const fillerDepth = newCabinet.carcass.dimensions.depth
  const lShapeOffset = cabinetType === "filler" && fillerType === "l-shape" ? 20 : 0
  const fillerZ = doorFrontEdgeZ - fillerDepth + lShapeOffset

  let fillerY = parentY
  if (isOverheadWithOverhang) {
    fillerY = parentY - overhangAmount
  }

  if (side === "left") {
    newCabinet.group.position.set(parentX - newCabinet.carcass.dimensions.width, fillerY, fillerZ)
  } else {
    newCabinet.group.position.set(parentX + parentWidth, fillerY, fillerZ)
  }

  // Add to same view as parent
  if (parentCabinet.viewId) {
    updateCabinetViewId(newCabinet.cabinetId, parentCabinet.viewId)
  }

  // Lock states
  if (cabinetType === "filler" || cabinetType === "panel") {
    if (side === "right") {
      updateCabinetLock(newCabinet.cabinetId, true, false)
    } else {
      updateCabinetLock(newCabinet.cabinetId, false, true)
    }
  }

  // Update bulkhead if applicable
  if (parentCabinet.cabinetType === "top" || parentCabinet.cabinetType === "tall") {
    import("./bulkheadPositionHandler").then(({ updateBulkheadPosition }) => {
      setTimeout(() => {
        const updatedCabinets = [...cabinets, newCabinet]
        updateBulkheadPosition(parentCabinet, updatedCabinets, wallDimensions, {
          widthChanged: true,
        })
      }, 0)
    })
  }
}

