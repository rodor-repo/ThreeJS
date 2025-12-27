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
 * Check if a cabinet supports benchtop (base cabinets or dishwasher/washingMachine appliances)
 */
function supportsBenchtop(cabinet: CabinetData): boolean {
  if (cabinet.cabinetType === "base") return true
  if (cabinet.cabinetType === "appliance") {
    const applianceType = cabinet.carcass?.config?.applianceType
    return applianceType === "dishwasher" || applianceType === "washingMachine"
  }
  return false
}

/**
 * Creates a benchtop for a base cabinet or appliance (dishwasher/washingMachine).
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
  if (!parentCabinet || !supportsBenchtop(parentCabinet)) {
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

  const isAppliance = parentCabinet.cabinetType === "appliance"
  const benchtopThickness = DEFAULT_BENCHTOP_THICKNESS

  // Calculate effective dimensions including child fillers/panels (applies to both base cabinets and appliances)
  const { effectiveLength, effectiveLeftX } = getEffectiveBenchtopDimensions(parentCabinet, cabinets)

  let benchtopWidth: number
  let benchtopDepth: number
  let benchtopX: number
  let frontOverhang = 0
  let leftOverhang = 0
  let rightOverhang = 0

  if (isAppliance) {
    // For appliances (dishwasher/washingMachine):
    // Use effective length (shell + child fillers/panels), no overhangs
    // The benchtop sits exactly on top of the shell
    benchtopWidth = effectiveLength
    benchtopDepth = parentCabinet.carcass.dimensions.depth
    benchtopX = effectiveLeftX
  } else {
    // For base cabinets:
    // Use effective dimensions including child fillers/panels
    // Default overhangs for child benchtops
    frontOverhang = DEFAULT_BENCHTOP_FRONT_OVERHANG
    
    benchtopWidth = effectiveLength
    benchtopDepth = calculateBenchtopDepth(parentCabinet.carcass.dimensions.depth, frontOverhang)
    benchtopX = effectiveLeftX
  }

  // Use createCabinet (cabinetFactory) instead of manual creation
  const benchtopCabinet = createCabinet("benchtop", subcategoryId, {
    productId: finalProductId,
    customDimensions: {
      width: benchtopWidth,
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
    benchtopX,
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
  if (!cabinet || !supportsBenchtop(cabinet)) {
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
