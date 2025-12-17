import _ from "lodash"
import {
  CarcassAssembly,
  CarcassDimensions,
  CabinetType,
  CarcassConfig,
} from "@/features/carcass"
import { CabinetData } from "@/features/scene/types"
import { fetchProductData } from "@/features/carcass/utils/drawer-constraint-utils"
import { getGDMapping } from "../ui/productPanel/hooks/useGDMapping"
import {
  buildDefaultValues,
  buildDimsList,
  getExtractedDimensions,
} from "../ui/productPanel/utils/dimensionUtils"

type Defaults = Record<CabinetType, CarcassDimensions>

const defaultDimensions: Defaults = {
  top: { width: 600, height: 600, depth: 300 },
  base: { width: 600, height: 720, depth: 600 },
  tall: { width: 600, height: 2400, depth: 600 },
  wardrobe: { width: 600, height: 2400, depth: 600 }, // Same as tall cabinet
  // Panel: width = thickness (16mm), height = panel height, depth = panel face width
  panel: { width: 16, height: 720, depth: 600 },
  // Filler defaults (for linear filler - same structure as panel, just smaller depth):
  // width = panel thickness (16mm), height = panel height, depth = panel face width (100mm)
  // For L-shape filler: width = face panel width (the gap), depth is ignored (return is always 40mm total)
  filler: { width: 16, height: 720, depth: 100 },
  // Kicker: width = cabinet width, height = kicker height (leg height), depth = thickness (16mm)
  kicker: { width: 600, height: 150, depth: 16 },
  // Bulkhead: width = cabinet width, height = gap to ceiling, depth = thickness (16mm)
  bulkhead: { width: 600, height: 200, depth: 16 },
  // UnderPanel: width = cabinet width, height = thickness (16mm), depth = parent depth - 20
  underPanel: { width: 600, height: 16, depth: 280 },
  benchtop: { width: 2000, height: 40, depth: 600 }, // Standard benchtop size
  // Appliance: standard built-in appliance dimensions
  appliance: { width: 600, height: 820, depth: 600 },
}

const getProductDefaultDimensions = (productId: string | undefined) => {
  if (!productId) return {}

  const productData = fetchProductData(productId)
  const wsProduct = productData?.product
  const threeJsGDs = productData?.threeJsGDs
  if (!wsProduct || !threeJsGDs) return {}

  const gdMapping = getGDMapping(threeJsGDs)
  const defaults = buildDefaultValues(wsProduct.dims)
  const dimsList = buildDimsList(wsProduct.dims)

  const extracted = getExtractedDimensions(
    defaults,
    dimsList,
    gdMapping
  )

  return {
    width: extracted.width || undefined,
    height: extracted.height || undefined,
    depth: extracted.depth || undefined,
  }
}

// Default configurations per cabinet type
const getDefaultConfig = (
  type: CabinetType,
  subcategoryId: string,
  opts?: {
    fillerType?: "linear" | "l-shape"
    fillerReturnPosition?: "left" | "right"
    wardrobeDrawerQuantity?: number
    wardrobeDrawerHeight?: number
    wardrobeDrawerBuffer?: number
    applianceType?: "dishwasher" | "washingMachine" | "sideBySideFridge"
  }
): Partial<CarcassConfig> => {
  const baseConfig: Partial<CarcassConfig> = {
    shelfCount: 0,
    shelfSpacing: 0,
    doorEnabled: false,
    drawerEnabled: false,
  }

  switch (type) {
    case "top":
      return { shelfCount: 2, shelfSpacing: 300 }
    case "base":
      if (subcategoryId === "drawer") {
        return {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: true,
          drawerQuantity: 3,
          drawerHeights: [],
        }
      }
      return { shelfCount: 2, shelfSpacing: 300 }
    case "tall":
      return { shelfCount: 4, shelfSpacing: 300 }
    case "wardrobe":
      return {
        shelfCount: 4,
        shelfSpacing: 300,
        doorEnabled: false,
        drawerEnabled: true,
        drawerQuantity: opts?.wardrobeDrawerQuantity ?? 0,
        wardrobeDrawerHeight: opts?.wardrobeDrawerHeight ?? 220,
        wardrobeDrawerBuffer: opts?.wardrobeDrawerBuffer ?? 50,
      }
    case "filler":
      return {
        ...baseConfig,
        fillerType: opts?.fillerType || "linear",
        fillerReturnPosition: opts?.fillerReturnPosition || "left",
      }
    case "panel":
    case "kicker":
    case "bulkhead":
    case "underPanel":
      return baseConfig
    case "appliance":
      return {
        ...baseConfig,
        applianceType: opts?.applianceType || "dishwasher",
        applianceTopGap: 0,
        applianceLeftGap: 0,
        applianceRightGap: 0,
      }
    default:
      return { shelfCount: 2, shelfSpacing: 300 }
  }
}

export const createCabinet = (
  type: CabinetType,
  subcategoryId: string,
  opts?: {
    indexOffset?: number
    spacing?: number
    customDimensions?: Partial<CarcassDimensions>
    productId?: string
    fillerType?: "linear" | "l-shape"
    fillerReturnPosition?: "left" | "right"
    // Wardrobe-specific options
    wardrobeDrawerQuantity?: number // Number of drawers at bottom (0 or more)
    wardrobeDrawerHeight?: number // Fixed drawer height (default 220mm)
    wardrobeDrawerBuffer?: number // Buffer between drawers and shelves (default 50mm)
    // Appliance-specific options
    applianceType?: "dishwasher" | "washingMachine" | "sideBySideFridge"
  }
): CabinetData => {
  const productId = opts?.productId
  if (!productId)
    throw new Error("createCabinet was called with productId undefined")

  // Defensive fallback if an unsupported type sneaks in
  const hasDefaults = !!defaultDimensions[type]
  if (!hasDefaults) {
    console.warn(
      `Unsupported cabinet type "${type}" passed to createCabinet. Falling back to 'tall'.`
    )
  }
  const resolvedType = hasDefaults ? type : "tall"
  const baseDims = _.cloneDeep(defaultDimensions[resolvedType])
  const productDefaultDims = getProductDefaultDimensions(productId)
  
  // Handle special dimension case for drawer base cabinets
  const dimensions: CarcassDimensions = {
    width: opts?.customDimensions?.width ?? productDefaultDims.width ?? baseDims.width,
    height:
      opts?.customDimensions?.height ??
      productDefaultDims.height ??
      baseDims.height,
    depth: opts?.customDimensions?.depth ?? productDefaultDims.depth ?? baseDims.depth,
  }

  // Use lodash uniqueId + random suffix to avoid collisions when creating multiple cabinets quickly
  const cabinetId = `${_.uniqueId("cabinet-")}-${Math.random().toString(36).slice(2, 8)}`

  // Get type-specific configuration
  const config = getDefaultConfig(resolvedType, subcategoryId, opts)
  
  // Create carcass using unified factory method
  const carcass = CarcassAssembly.create(
    resolvedType,
    dimensions,
    config,
    productId,
    cabinetId,
    type === "filler" && opts?.fillerType === "l-shape" 
      ? { fillerReturnPosition: opts?.fillerReturnPosition || "left" }
      : undefined
  )

  // position by index to avoid overlap if desired
  const index = opts?.indexOffset ?? 0
  const spacing = opts?.spacing ?? 100
  carcass.group.position.x = index * (dimensions.width + spacing)

  return {
    group: carcass.group,
    carcass,
    cabinetType: type,
    subcategoryId,
    productId: opts?.productId,
    cabinetId,
  }
}

export const getDefaultDimensions = (type: CabinetType): CarcassDimensions => {
  const hasDefaults = !!defaultDimensions[type]
  if (!hasDefaults) {
    console.warn(
      `Unsupported cabinet type "${type}" in getDefaultDimensions. Using 'tall' defaults.`
    )
  }
  const dims = defaultDimensions[hasDefaults ? type : "tall"]
  return { ...dims }
}
