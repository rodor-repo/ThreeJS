import * as THREE from "three"
import _ from "lodash"
import {
  CarcassAssembly,
  CarcassDimensions,
  CabinetType,
} from "@/components/Carcass"

export type CabinetData = {
  group: THREE.Group
  carcass: CarcassAssembly
  cabinetType: CabinetType
  subcategoryId: string
}

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
  }
): CabinetData => {
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

  let carcass: CarcassAssembly
  switch (type) {
    case "top":
      carcass = CarcassAssembly.createTopCabinet(dimensions, {
        shelfCount: 2,
        shelfSpacing: 300,
      })
      break
    case "base":
      if (subcategoryId === "drawer") {
        const drawerDimensions = { ...dimensions, height: 730 }
        carcass = CarcassAssembly.createBaseCabinet(drawerDimensions, {
          shelfCount: 0,
          shelfSpacing: 0,
          doorEnabled: false,
          drawerEnabled: true,
          drawerQuantity: 3,
          drawerHeights: [],
        })
      } else {
        carcass = CarcassAssembly.createBaseCabinet(dimensions, {
          shelfCount: 2,
          shelfSpacing: 300,
        })
      }
      break
    case "tall":
      carcass = CarcassAssembly.createTallCabinet(dimensions, {
        shelfCount: 4,
        shelfSpacing: 300,
      })
      break
    default:
      carcass = CarcassAssembly.createTopCabinet(dimensions, {
        shelfCount: 2,
        shelfSpacing: 300,
      })
  }

  // position by index to avoid overlap if desired
  const index = opts?.indexOffset ?? 0
  const spacing = opts?.spacing ?? 100
  carcass.group.position.x = index * (dimensions.width + spacing)

  return {
    group: carcass.group,
    carcass,
    cabinetType: type,
    subcategoryId,
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
