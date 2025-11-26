import * as THREE from "three"
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
}

export const createCabinet = (
  type: CabinetType,
  subcategoryId: string,
  opts?: {
    indexOffset?: number
    spacing?: number
    customDimensions?: Partial<CarcassDimensions>
    productId?: string
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

  const cabinetId = `cabinet-${Date.now()}`

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
