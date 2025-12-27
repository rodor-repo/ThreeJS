import * as THREE from "three"
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

interface KickerHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  createCabinet: CreateCabinetFn
  deleteCabinet: (id: string) => void
}

export const handleKickerSelect = (
  cabinetId: string,
  productId: string,
  params: KickerHandlerParams
) => {
  const { cabinets, wsProducts, createCabinet } = params
  if (!wsProducts) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!parentCabinet || (parentCabinet.cabinetType !== "base" && parentCabinet.cabinetType !== "tall")) {
    return
  }

  const productEntry = wsProducts.products[productId]
  if (!productEntry) return

  const designId = productEntry.designId
  const designEntry = wsProducts.designs[designId || ""]
  if (!designEntry || designEntry.type3D !== "kicker") return

  const subcategoryId = productEntry.subCategoryId

  // Prevent duplicate kicker
  const existingKickerCabinet = cabinets.find(
    (c) => c.cabinetType === "kicker" && c.kickerParentCabinetId === cabinetId
  )
  if (existingKickerCabinet) return

  const kickerHeight = Math.max(0, parentCabinet.group.position.y)

  // Effective width (include elevated children)
  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width

  let minX = parentX
  let maxX = parentX + parentWidth

  const childCabinets = cabinets.filter(
    (c) =>
      c.parentCabinetId === cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true &&
      c.group.position.y > 0
  )

  childCabinets.forEach((child) => {
    const childLeftX = child.group.position.x
    const childRightX = childLeftX + child.carcass.dimensions.width
    if (childLeftX < minX) minX = childLeftX
    if (childRightX > maxX) maxX = childRightX
  })

  const effectiveWidth = maxX - minX
  const effectiveLeftX = minX

  const kickerCabinet = createCabinet("kicker", subcategoryId, {
    productId,
    customDimensions: {
      width: effectiveWidth,
      height: kickerHeight,
      depth: parentCabinet.carcass.dimensions.depth,
    },
    additionalProps: {
      viewId: parentCabinet.viewId,
      kickerParentCabinetId: cabinetId,
      hideLockIcons: true,
    },
  })

  if (!kickerCabinet) return

  const cabinetWorldPos = new THREE.Vector3()
  parentCabinet.group.getWorldPosition(cabinetWorldPos)

  const kickerLocalX = effectiveWidth / 2
  const kickerLocalY = -kickerHeight / 2
  const kickerLocalZ = parentCabinet.carcass.dimensions.depth - 70 + 16 / 2

  const kickerWorldPos = new THREE.Vector3(
    effectiveLeftX + kickerLocalX,
    cabinetWorldPos.y + kickerLocalY,
    cabinetWorldPos.z + kickerLocalZ
  )

  kickerCabinet.group.position.copy(kickerWorldPos)
  kickerCabinet.group.name = `kicker_${parentCabinet.cabinetId}`
}

export const handleKickerToggle = (
  cabinetId: string,
  enabled: boolean,
  params: KickerHandlerParams
) => {
  const { cabinets, deleteCabinet } = params
  if (enabled) return

  const cabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!cabinet || (cabinet.cabinetType !== "base" && cabinet.cabinetType !== "tall")) {
    return
  }

  const existingKickerCabinet = cabinets.find(
    (c) => c.cabinetType === "kicker" && c.kickerParentCabinetId === cabinetId
  )

  if (existingKickerCabinet) {
    const kickerFace = existingKickerCabinet.carcass?.kickerFace
    if (kickerFace && typeof kickerFace.dispose === "function") {
      kickerFace.dispose()
    }

    deleteCabinet(existingKickerCabinet.cabinetId)
  }
}

