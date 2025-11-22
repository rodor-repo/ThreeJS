import type { Group } from "three"
import type {
  CarcassAssembly,
  CarcassDimensions,
  CarcassMaterial,
  CarcassMaterialData,
  DoorMaterial,
  DoorMaterialData,
} from "@/features/carcass"
import type { WsProduct } from "@/types/erpTypes"
import { CabinetData } from "@/features/scene/types"

export interface SelectedCabinetSnapshot {
  group: Group
  dimensions: CarcassDimensions
  material: CarcassMaterial
  cabinetType: string
  subcategoryId?: string
  productId?: string
  doorEnabled?: boolean
  doorCount?: number
  doorMaterial?: DoorMaterial
  overhangDoor?: boolean
  drawerEnabled?: boolean
  drawerQuantity?: number
  drawerHeights?: number[]
  carcass?: CarcassAssembly
  cabinetId: string
}

export interface ProductPanelCallbacks {
  onShelfCountChange?: (newCount: number) => void
  onDimensionsChange?: (dimensions: CarcassDimensions) => void
  onMaterialChange?: (material: Partial<CarcassMaterialData>) => void
  onKickerHeightChange?: (kickerHeight: number) => void
  onDoorToggle?: (enabled: boolean) => void
  onDoorMaterialChange?: (material: Partial<DoorMaterialData>) => void
  onDoorCountChange?: (count: number) => void
  onOverhangDoorToggle?: (overhang: boolean) => void
  onDrawerToggle?: (enabled: boolean) => void
  onDrawerQuantityChange?: (quantity: number) => void
  onDrawerHeightChange?: (
    index: number,
    height: number,
    changedId?: string
  ) => void
  onDrawerHeightsBalance?: () => void
  onDrawerHeightsReset?: () => void
  // optional debugging helper used by Debug Balance button
  onDebugBalanceTest?: () => number[] | void
}

export interface ProductPanelProps extends ProductPanelCallbacks {
  isVisible: boolean
  onClose: () => void
  selectedCabinet?: SelectedCabinetSnapshot | null
  /** When provided, ProductPanel will render dynamic dimension controls from this schema */
  wsProduct?: WsProduct
  cabinets: CabinetData[]
}

export interface DimensionRange {
  min: number
  max: number
  default: number
}

export interface DimensionConstraints {
  height: DimensionRange
  width: DimensionRange
  depth: DimensionRange
}
