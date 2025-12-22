import { WsProducts } from "@/types/erpTypes"
import { CabinetData, CabinetType } from "../../types"

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

interface UnderPanelHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  createCabinet: CreateCabinetFn
  deleteCabinet: (id: string) => void
}

export const handleUnderPanelSelect = (
  cabinetId: string,
  productId: string,
  params: UnderPanelHandlerParams
) => {
  const { cabinets, wsProducts, createCabinet } = params
  if (!wsProducts) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!parentCabinet || parentCabinet.cabinetType !== "top") return

  const productEntry = wsProducts.products[productId]
  if (!productEntry) return

  const designId = productEntry.designId
  const designEntry = wsProducts.designs[designId || ""]
  if (!designEntry || designEntry.type3D !== "underPanel") return

  const subcategoryId = productEntry.subCategoryId

  const existingUnderPanelCabinet = cabinets.find(
    (c) => c.cabinetType === "underPanel" && c.underPanelParentCabinetId === cabinetId
  )
  if (existingUnderPanelCabinet) return

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
  const parentDepth = parentCabinet.carcass.dimensions.depth
  const targetDepth = parentDepth - 20

  const underPanelCabinet = createCabinet("underPanel", subcategoryId, {
    productId,
    customDimensions: {
      width: effectiveWidth,
      height: 16,
      depth: targetDepth,
    },
    additionalProps: {
      viewId: parentCabinet.viewId,
      underPanelParentCabinetId: cabinetId,
      hideLockIcons: true,
    },
  })

  if (!underPanelCabinet) return

  underPanelCabinet.group.position.set(minX, parentCabinet.group.position.y, parentCabinet.group.position.z)
  underPanelCabinet.group.name = `underPanel_${parentCabinet.cabinetId}`
}

export const handleUnderPanelToggle = (
  cabinetId: string,
  enabled: boolean,
  params: UnderPanelHandlerParams
) => {
  const { cabinets, deleteCabinet } = params
  if (enabled) return

  const cabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!cabinet || cabinet.cabinetType !== "top") return

  const existingUnderPanelCabinet = cabinets.find(
    (c) => c.cabinetType === "underPanel" && c.underPanelParentCabinetId === cabinetId
  )

  if (existingUnderPanelCabinet) {
    existingUnderPanelCabinet.carcass?.dispose()
    deleteCabinet(existingUnderPanelCabinet.cabinetId)
  }
}

