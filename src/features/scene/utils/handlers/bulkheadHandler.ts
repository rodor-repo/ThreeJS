import * as THREE from "three"
import { WsProducts } from "@/types/erpTypes"
import { CabinetData, CabinetType, WallDimensions } from "../../types"
import { hasLeftAdjacentCabinet, hasRightAdjacentCabinet } from "./bulkheadPositionHandler"

type CreateCabinetFn = (
  cabinetType: CabinetType,
  subcategoryId: string,
  options: {
    productId: string
    customDimensions?: {
      width?: number
      height?: number
      depth?: number
    }
    additionalProps?: Record<string, unknown>
  }
) => CabinetData | null | undefined

interface BulkheadHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  wallDimensions: WallDimensions
  createCabinet: CreateCabinetFn
  deleteCabinet: (id: string) => void
}

export const handleBulkheadSelect = (
  cabinetId: string,
  productId: string,
  params: BulkheadHandlerParams
) => {
  const { cabinets, wsProducts, wallDimensions, createCabinet } = params
  if (!wsProducts) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (
    !parentCabinet ||
    (parentCabinet.cabinetType !== "base" &&
      parentCabinet.cabinetType !== "top" &&
      parentCabinet.cabinetType !== "tall")
  ) {
    return
  }

  const productEntry = wsProducts.products[productId]
  if (!productEntry) return

  const designId = productEntry.designId
  const designEntry = wsProducts.designs[designId || ""]
  if (!designEntry || designEntry.type3D !== "bulkhead") return

  const subcategoryId = productEntry.subCategoryId

  const existingBulkheadCabinet = cabinets.find(
    (c) => c.cabinetType === "bulkhead" && c.bulkheadParentCabinetId === cabinetId
  )
  if (existingBulkheadCabinet) return

  // Effective width (parent + children)
  const childCabinets = cabinets.filter(
    (c) =>
      c.parentCabinetId === cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  let minX = parentCabinet.group.position.x
  let maxX = parentCabinet.group.position.x + parentCabinet.carcass.dimensions.width

  childCabinets.forEach((child) => {
    const childLeft = child.group.position.x
    const childRight = child.group.position.x + child.carcass.dimensions.width
    if (childLeft < minX) minX = childLeft
    if (childRight > maxX) maxX = childRight
  })

  const effectiveWidth = maxX - minX

  const cabinetTopY = parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height
  const bulkheadHeight = Math.max(0, wallDimensions.height - cabinetTopY)

  const bulkheadCabinet = createCabinet("bulkhead", subcategoryId, {
    productId,
    customDimensions: {
      width: effectiveWidth,
      height: bulkheadHeight,
      depth: parentCabinet.carcass.dimensions.depth,
    },
    additionalProps: {
      viewId: parentCabinet.viewId,
      bulkheadParentCabinetId: cabinetId,
      hideLockIcons: true,
    },
  })

  if (!bulkheadCabinet) return

  const cabinetWorldPos = new THREE.Vector3()
  parentCabinet.group.getWorldPosition(cabinetWorldPos)

  const bulkheadWorldPos = new THREE.Vector3(
    minX + effectiveWidth / 2,
    cabinetTopY + bulkheadHeight / 2,
    cabinetWorldPos.z + parentCabinet.carcass.dimensions.depth - 16 / 2
  )

  bulkheadCabinet.group.position.copy(bulkheadWorldPos)
  bulkheadCabinet.group.name = `bulkhead_${parentCabinet.cabinetId}`

  if (parentCabinet.cabinetType === "top" || parentCabinet.cabinetType === "tall") {
    const leftAdjacentCabinet = hasLeftAdjacentCabinet(parentCabinet, cabinets)
    const rightAdjacentCabinet = hasRightAdjacentCabinet(parentCabinet, cabinets)
    const currentCabinetDepth = parentCabinet.carcass.dimensions.depth

    let needsLeftReturn = leftAdjacentCabinet === null
    if (leftAdjacentCabinet) {
      const leftAdjacentDepth = leftAdjacentCabinet.carcass.dimensions.depth
      needsLeftReturn = currentCabinetDepth > leftAdjacentDepth
    }

    let needsRightReturn = rightAdjacentCabinet === null
    if (rightAdjacentCabinet) {
      const rightAdjacentDepth = rightAdjacentCabinet.carcass.dimensions.depth
      needsRightReturn = currentCabinetDepth > rightAdjacentDepth
    }

    const frontEdgeOffsetZ = parentCabinet.carcass.dimensions.depth - 16
    const returnDepth = frontEdgeOffsetZ
    const returnHeight = bulkheadHeight
    const offsetX = effectiveWidth / 2

    if (needsLeftReturn) {
      bulkheadCabinet.carcass.addBulkheadReturn("left", returnHeight, returnDepth, offsetX)
    }

    if (needsRightReturn) {
      bulkheadCabinet.carcass.addBulkheadReturn("right", returnHeight, returnDepth, offsetX)
    }
  }
}

export const handleBulkheadToggle = (
  cabinetId: string,
  enabled: boolean,
  params: BulkheadHandlerParams
) => {
  const { cabinets, deleteCabinet } = params
  if (enabled) return

  const cabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!cabinet || (cabinet.cabinetType !== "top" && cabinet.cabinetType !== "tall")) return

  const existingBulkheadCabinet = cabinets.find(
    (c) => c.cabinetType === "bulkhead" && c.bulkheadParentCabinetId === cabinetId
  )

  if (existingBulkheadCabinet) {
    existingBulkheadCabinet.carcass?.dispose()
    deleteCabinet(existingBulkheadCabinet.cabinetId)
  }
}

