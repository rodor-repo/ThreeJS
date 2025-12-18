import * as THREE from "three"
import _ from "lodash"
import { WsProducts } from "@/types/erpTypes"
import { CabinetData } from "../../types"
import { Benchtop } from "@/features/carcass/parts/Benchtop"

interface BenchtopHandlerParams {
  cabinets: CabinetData[]
  wsProducts: WsProducts | null | undefined
  addCabinetData: (cabinetData: CabinetData) => CabinetData | null
  deleteCabinet: (id: string) => void
}

/**
 * Calculates the effective benchtop dimensions, considering child fillers/panels
 * 
 * Length = Cabinet Width + any child filler/panel widths
 * Starting X = Lowest X value (cabinet left edge or child filler/panel left edge)
 */
export function getEffectiveBenchtopDimensions(
  parentCabinet: CabinetData,
  allCabinets: CabinetData[]
): { effectiveLength: number; effectiveLeftX: number } {
  const parentX = parentCabinet.group.position.x
  const parentWidth = parentCabinet.carcass.dimensions.width
  const parentLeftX = parentX
  const parentRightX = parentX + parentWidth

  let minX = parentLeftX
  let maxX = parentRightX

  // Find all child fillers/panels attached to this cabinet
  const childCabinets = allCabinets.filter(
    (c) =>
      c.parentCabinetId === parentCabinet.cabinetId &&
      (c.cabinetType === "filler" || c.cabinetType === "panel") &&
      c.hideLockIcons === true
  )

  // Extend benchtop to include children
  childCabinets.forEach((child) => {
    const childLeftX = child.group.position.x
    const childWidth = child.carcass.dimensions.width
    const childRightX = childLeftX + childWidth

    if (childLeftX < minX) {
      minX = childLeftX
    }
    if (childRightX > maxX) {
      maxX = childRightX
    }
  })

  const effectiveLength = maxX - minX
  const effectiveLeftX = minX

  return { effectiveLength, effectiveLeftX }
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
 * Creates a benchtop for a cabinet.
 * Benchtop is created independently without going through cabinetFactory.
 */
export const handleBenchtopSelect = (
  cabinetId: string,
  productId: string | null,
  params: BenchtopHandlerParams
) => {
  const { cabinets, wsProducts, addCabinetData } = params
  if (!wsProducts) return

  const parentCabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!parentCabinet || parentCabinet.cabinetType !== "base") {
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
  // Length = effective length (cabinet + children)
  // Thickness = 38mm (fixed)
  // Depth = parent cabinet depth + 20mm (fixed) + front overhang
  const benchtopLength = effectiveLength
  const benchtopThickness = 38
  const FIXED_DEPTH_EXTENSION = 20 // Fixed 20mm extension beyond cabinet
  
  // Default overhangs for child benchtops
  const frontOverhang = 20 // Default 20mm front overhang
  const leftOverhang = 0   // Default 0 left overhang
  const rightOverhang = 0  // Default 0 right overhang

  // Depth = Parent Depth + 20mm (fixed) + Front Overhang
  const benchtopDepth = parentCabinet.carcass.dimensions.depth + FIXED_DEPTH_EXTENSION + frontOverhang

  // Generate unique cabinet ID
  const benchtopCabinetId = `benchtop-${_.uniqueId()}-${Math.random().toString(36).slice(2, 8)}`

  // Create the Benchtop geometry - simple cube with overhangs
  const benchtop = new Benchtop(
    benchtopLength, 
    benchtopThickness, 
    benchtopDepth,
    frontOverhang,
    leftOverhang,
    rightOverhang
  )

  // Create group to hold the benchtop
  const group = new THREE.Group()
  group.name = `benchtop_${parentCabinet.cabinetId}`
  group.add(benchtop.mesh)
  group.userData.benchtop = benchtop

  // Position benchtop:
  // X = effectiveLeftX (lowest X value - left edge of cabinet or child filler)
  // Y = parent cabinet top (parentY + parentHeight)
  // Z = parentZ (same as parent - starts from back wall)
  const parentY = parentCabinet.group.position.y
  const parentHeight = parentCabinet.carcass.dimensions.height
  const parentZ = parentCabinet.group.position.z

  group.position.set(
    effectiveLeftX,
    parentY + parentHeight,
    parentZ
  )

  // Create minimal CabinetData for the benchtop
  // Note: benchtop has no real carcass, just a simple dimensions wrapper with config for DynamicPanel compatibility
  const benchtopCabinetData: CabinetData = {
    group,
    carcass: {
      group,
      dimensions: {
        width: benchtopLength,
        height: benchtopThickness,
        depth: benchtopDepth,
      },
      // Minimal config for DynamicPanel compatibility
      config: {
        // Benchtops don't have doors, drawers, or shelves
        doorEnabled: false,
        doorCount: 0,
        drawerEnabled: false,
        drawerQuantity: 0,
        shelfCount: 0,
      },
      // Minimal methods - benchtops don't have carcass features
      updateDimensions: (newDims: { width?: number; height?: number; depth?: number }) => {
        if (newDims.width !== undefined) benchtopCabinetData.carcass.dimensions.width = newDims.width
        if (newDims.height !== undefined) benchtopCabinetData.carcass.dimensions.height = newDims.height
        if (newDims.depth !== undefined) benchtopCabinetData.carcass.dimensions.depth = newDims.depth
        
        // Update the actual benchtop mesh with current overhangs
        const bt = group.userData.benchtop as Benchtop
        if (bt) {
          bt.updateDimensions(
            benchtopCabinetData.carcass.dimensions.width,
            benchtopCabinetData.carcass.dimensions.height,
            benchtopCabinetData.carcass.dimensions.depth,
            benchtopCabinetData.benchtopFrontOverhang,
            benchtopCabinetData.benchtopLeftOverhang,
            benchtopCabinetData.benchtopRightOverhang
          )
        }
      },
      // Stub methods for DynamicPanel/ProductPanel compatibility - benchtops don't have these features
      updateConfig: () => {},
      updateMaterialProperties: () => {},
      updateKickerHeight: () => {},
      toggleDoors: () => {},
      updateDoorMaterial: () => {},
      updateDoorConfiguration: () => {},
      updateOverhangDoor: () => {},
      updateDoorEnabled: () => {},
      updateDoorCount: () => {},
      updateDrawerEnabled: () => {},
      updateDrawerQuantity: () => {},
      updateDrawerHeight: () => {},
      updateDrawerHeights: () => {},
      balanceDrawerHeights: () => {},
      getDrawerHeights: () => [],
      updateShelfCount: () => {},
      dispose: () => {
        const bt = group.userData.benchtop as Benchtop
        if (bt) bt.dispose()
      },
    } as CabinetData["carcass"],
    cabinetType: "benchtop",
    subcategoryId,
    productId: finalProductId,
    cabinetId: benchtopCabinetId,
    viewId: parentCabinet.viewId,
    benchtopParentCabinetId: cabinetId,
    hideLockIcons: true,
    // Overhang values for child benchtops
    benchtopFrontOverhang: frontOverhang,
    benchtopLeftOverhang: leftOverhang,
    benchtopRightOverhang: rightOverhang,
  }

  addCabinetData(benchtopCabinetData)
}

export const handleBenchtopToggle = (
  cabinetId: string,
  enabled: boolean,
  params: BenchtopHandlerParams
) => {
  const { cabinets, deleteCabinet } = params
  if (enabled) return

  const cabinet = cabinets.find((c) => c.cabinetId === cabinetId)
  if (!cabinet || cabinet.cabinetType !== "base") {
    return
  }

  const existingBenchtopCabinet = cabinets.find(
    (c) => c.cabinetType === "benchtop" && c.benchtopParentCabinetId === cabinetId
  )

  if (existingBenchtopCabinet) {
    // Dispose benchtop geometry
    const benchtop = existingBenchtopCabinet.group.userData.benchtop as Benchtop | undefined
    if (benchtop && typeof benchtop.dispose === "function") {
      benchtop.dispose()
    }

    deleteCabinet(existingBenchtopCabinet.cabinetId)
  }
}
