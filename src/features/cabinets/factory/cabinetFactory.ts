import _ from "lodash"
import {
  CarcassAssembly,
  CarcassDimensions,
  CabinetType,
} from "@/features/carcass"
import { CabinetData } from "@/features/scene/types"

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
  const baseDims = _.cloneDeep(defaultDimensions[hasDefaults ? type : "tall"])
  const dimensions: CarcassDimensions = {
    width: opts?.customDimensions?.width ?? baseDims.width,
    height: opts?.customDimensions?.height ?? baseDims.height,
    depth: opts?.customDimensions?.depth ?? baseDims.depth,
  }

  // Use lodash uniqueId + random suffix to avoid collisions when creating multiple cabinets quickly
  const cabinetId = `${_.uniqueId("cabinet-")}-${Math.random().toString(36).slice(2, 8)}`

  let carcass: CarcassAssembly
  switch (type) {
    case "top":
      carcass = CarcassAssembly.createTopCabinet(
        dimensions,
        {
          shelfCount: 2,
          shelfSpacing: 300,
        },
        productId,
        cabinetId
      )
      break
    case "base":
      if (subcategoryId === "drawer") {
        const drawerDimensions = { ...dimensions, height: 730 }
        carcass = CarcassAssembly.createBaseCabinet(
          drawerDimensions,
          {
            shelfCount: 0,
            shelfSpacing: 0,
            doorEnabled: false,
            drawerEnabled: true,
            drawerQuantity: 3,
            drawerHeights: [],
          },
          productId,
          cabinetId
        )
      } else {
        carcass = CarcassAssembly.createBaseCabinet(
          dimensions,
          {
            shelfCount: 2,
            shelfSpacing: 300,
          },
          productId,
          cabinetId
        )
      }
      break
    case "tall":
      carcass = CarcassAssembly.createTallCabinet(
        dimensions,
        {
          shelfCount: 4,
          shelfSpacing: 300,
        },
        productId,
        cabinetId
      )
      break
    case "panel":
      carcass = CarcassAssembly.createPanelCabinet(
        dimensions,
        {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: false,
        },
        productId,
        cabinetId
      )
      break
    case "filler":
      if (opts?.fillerType === "l-shape") {
        carcass = CarcassAssembly.createLShapeFiller(
          dimensions,
          {
            shelfCount: 0,
            shelfSpacing: 0,
            doorEnabled: false,
            drawerEnabled: false,
          },
          productId,
          cabinetId,
          opts?.fillerReturnPosition || "left"
        )
      } else {
        // Default to linear filler
        carcass = CarcassAssembly.createLinearFiller(
          dimensions,
          {
            shelfCount: 0,
            shelfSpacing: 0,
            doorEnabled: false,
            drawerEnabled: false,
          },
          productId,
          cabinetId
        )
      }
      break
    case "wardrobe":
      carcass = CarcassAssembly.createWardrobeCabinet(
        dimensions,
        {
          shelfCount: 4, // Default 4 shelves above drawers
          shelfSpacing: 300,
          doorEnabled: false, // Wardrobes never have doors
          drawerEnabled: true, // Always has drawers
          drawerQuantity: opts?.wardrobeDrawerQuantity ?? 0, // Default 2 drawers
          wardrobeDrawerHeight: opts?.wardrobeDrawerHeight ?? 220, // Fixed 220mm drawer height
          wardrobeDrawerBuffer: opts?.wardrobeDrawerBuffer ?? 50, // 50mm buffer
        },
        productId,
        cabinetId
      )
      break
    case "kicker":
      carcass = CarcassAssembly.createKicker(
        dimensions,
        {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: false,
        },
        productId,
        cabinetId
      )
      break
    case "bulkhead":
      carcass = CarcassAssembly.createBulkhead(
        dimensions,
        {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: false,
        },
        productId,
        cabinetId
      )
      break
    case "underPanel":
      carcass = CarcassAssembly.createUnderPanel(
        dimensions,
        {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: false,
        },
        productId,
        cabinetId
      )
      break
    default:
      carcass = CarcassAssembly.createTopCabinet(
        dimensions,
        {
          shelfCount: 2,
          shelfSpacing: 300,
        },
        productId,
        cabinetId
      )
  }

  // position by index to avoid overlap if desired
  const index = opts?.indexOffset ?? 0
  const spacing = opts?.spacing ?? 100
  carcass.group.position.x = index * (dimensions.width + spacing)

  // const cabinetId = `cabinet-${type}-${subcategoryId}-${
  //   opts?.productId || "default"
  // }-${index}`

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
