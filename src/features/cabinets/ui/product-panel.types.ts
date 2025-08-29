import type { Group } from "three"
import type {
  CarcassDimensions,
  CarcassMaterial,
  CarcassMaterialData,
  DoorMaterial,
  DoorMaterialData,
} from "@/components/Carcass"

export interface SelectedCabinetSnapshot {
  group: Group
  dimensions: CarcassDimensions
  material: CarcassMaterial
  cabinetType: string
  subcategoryId?: string
  doorEnabled?: boolean
  doorCount?: number
  doorMaterial?: DoorMaterial
  overhangDoor?: boolean
  drawerEnabled?: boolean
  drawerQuantity?: number
  drawerHeights?: number[]
  carcass?: any
}

export interface ProductPanelCallbacks {
  onDimensionsChange?: (dimensions: CarcassDimensions) => void
  onMaterialChange?: (material: Partial<CarcassMaterialData>) => void
  onKickerHeightChange?: (kickerHeight: number) => void
  onDoorToggle?: (enabled: boolean) => void
  onDoorMaterialChange?: (material: Partial<DoorMaterialData>) => void
  onDoorCountChange?: (count: number) => void
  onOverhangDoorToggle?: (overhang: boolean) => void
  onDrawerToggle?: (enabled: boolean) => void
  onDrawerQuantityChange?: (quantity: number) => void
  onDrawerHeightChange?: (index: number, height: number) => void
  onDrawerHeightsBalance?: () => void
  onDrawerHeightsReset?: () => void
  // optional debugging helper used by Debug Balance button
  onDebugBalanceTest?: () => number[] | void
}

export interface ProductPanelProps extends ProductPanelCallbacks {
  isVisible: boolean
  onClose: () => void
  selectedCabinet?: SelectedCabinetSnapshot | null
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
