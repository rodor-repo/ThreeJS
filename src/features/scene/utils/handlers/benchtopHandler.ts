import { WsProducts } from "@/types/erpTypes"
import { CabinetData, CabinetType } from "../../types"
import { 
  DEFAULT_BENCHTOP_THICKNESS, 
  DEFAULT_BENCHTOP_FRONT_OVERHANG 
} from "@/features/carcass/builders/builder-constants"
import { 
  getEffectiveBenchtopDimensions, 
  calculateBenchtopDepth 
} from "../benchtopUtils"

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

interface BenchtopHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  createCabinet: CreateCabinetFn
  deleteCabinet: (id: string) => void
}

/**
 * Finds the first available benchtop product ID from wsProducts
 */
function getDefaultBenchtopProductId(wsProducts: WsProducts): string | null {
  const benchtopProducts = Object.entries(wsProducts.products).filter(([, p]) => {
    if (p.status !== 'Active' || p.enabled3D !== true) return false
    const designEntry = wsProducts.designs[p.designId]
    return designEntry?.type3D === 'benchtop'
  })

  const productsWithData = benchtopProducts.map(([id, p]) => ({
    id,
    name: p.product,
    sortNum: Number(p.sortNum),
  }))

  // Sort by sortNum and return the first one
  productsWithData.sort((a, b) => a.sortNum - b.sortNum)
  return productsWithData.length > 0 ? productsWithData[0].id : null
}

/**
 * Creates a benchtop for a base cabinet.
 * Uses the standard cabinetFactory flow via createCabinet().
 */
export const handleBenchtopSelect = (
  cabinetId: string,
  productId: string | null,
  params: BenchtopHandlerParams
) => {
  const { cabinets, wsProducts, createCabinet } = params
  if (!wsProducts) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!parentCabinet || (parentCabinet.cabinetType !== "base" && parentCabinet.cabinetType !== "appliance")) {
    return
  }

  // If no productId provided, find the default benchtop product
  const finalProductId = productId || getDefaultBenchtopProductId(wsProducts)
  if (!finalProductId) {
    console.warn("No benchtop product found in wsProducts")
    return
  }

  const productEntry = wsProducts.products[finalProductId]
  if (!productEntry) return

  const designId = productEntry.designId
  const designEntry = wsProducts.designs[designId || ""]
  if (!designEntry || designEntry.type3D !== "benchtop") return

  const subcategoryId = productEntry.subCategoryId

  // Prevent duplicate benchtop
  const existingBenchtopCabinet = cabinets.find(
    (c) => c.cabinetType === "benchtop" && c.benchtopParentCabinetId === cabinetId
  )
  if (existingBenchtopCabinet) return

  // Calculate effective dimensions
  const { effectiveLength, effectiveLeftX } = getEffectiveBenchtopDimensions(parentCabinet, cabinets)
  
  // Benchtop dimensions:
  // width = effective length (cabinet + children)
  // height = thickness (38mm fixed)
  // depth = parent cabinet depth + 20mm (fixed) + front overhang
  const benchtopThickness = DEFAULT_BENCHTOP_THICKNESS
  
  // Default overhangs for child benchtops
  const frontOverhang = DEFAULT_BENCHTOP_FRONT_OVERHANG
  const leftOverhang = 0
  const rightOverhang = 0

  const benchtopDepth = calculateBenchtopDepth(parentCabinet.carcass.dimensions.depth, frontOverhang)

  // Use createCabinet (cabinetFactory) instead of manual creation
  const benchtopCabinet = createCabinet("benchtop", subcategoryId, {
    productId: finalProductId,
    customDimensions: {
      width: effectiveLength,
      height: benchtopThickness,
      depth: benchtopDepth,
    },
    additionalProps: {
      viewId: parentCabinet.viewId,
      benchtopParentCabinetId: cabinetId,
      hideLockIcons: true,
      benchtopFrontOverhang: frontOverhang,
      benchtopLeftOverhang: leftOverhang,
      benchtopRightOverhang: rightOverhang,
    },
  })

  if (!benchtopCabinet) return

  // Position benchtop on top of parent cabinet
  const parentY = parentCabinet.group.position.y
  const parentHeight = parentCabinet.carcass.dimensions.height
  const parentZ = parentCabinet.group.position.z

  benchtopCabinet.group.position.set(
    effectiveLeftX,
    parentY + parentHeight,
    parentZ
  )
  benchtopCabinet.group.name = `benchtop_${parentCabinet.cabinetId}`
}

export const handleBenchtopToggle = (
  cabinetId: string,
  enabled: boolean,
  params: BenchtopHandlerParams
) => {
  const { cabinets, deleteCabinet } = params
  if (enabled) return

  const cabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!cabinet || (cabinet.cabinetType !== "base" && cabinet.cabinetType !== "appliance")) {
    return
  }

  const existingBenchtopCabinet = cabinets.find(
    (c) => c.cabinetType === "benchtop" && c.benchtopParentCabinetId === cabinetId
  )

  if (existingBenchtopCabinet) {
    // CarcassAssembly.dispose() handles cleanup
    existingBenchtopCabinet.carcass?.dispose()
    deleteCabinet(existingBenchtopCabinet.cabinetId)
  }
}
