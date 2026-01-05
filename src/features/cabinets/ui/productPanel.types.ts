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
import type { FormulaPiece } from "@/types/formulaTypes"

export interface SelectedCabinetSnapshot {
  group: Group
  dimensions: CarcassDimensions
  material: CarcassMaterial
  cabinetType: string
  subcategoryId?: string
  productId?: string
  sortNumber?: number
  doorEnabled?: boolean
  doorCount?: number
  doorMaterial?: DoorMaterial
  overhangDoor?: boolean
  drawerEnabled?: boolean
  drawerQuantity?: number
  drawerHeights?: number[]
  carcass?: CarcassAssembly
  cabinetId: string
  viewId?: string
  hideLockIcons?: boolean
  /** For benchtop type: parent cabinet ID that this benchtop belongs to */
  benchtopParentCabinetId?: string
  /** Benchtop overhangs - only for child benchtops */
  benchtopFrontOverhang?: number
  benchtopLeftOverhang?: number
  benchtopRightOverhang?: number
  /** Benchtop thickness - only for child benchtops */
  benchtopThickness?: number
  /** Benchtop height from floor (Y position) */
  benchtopHeightFromFloor?: number
  /** Manual dimension adjustments for child cabinets (benchtops, panels) */
  manuallyEditedDelta?: {
    width?: number
    height?: number
    depth?: number
  }
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
  onViewChange?: (cabinetId: string, viewId: string) => void
  onGroupChange?: (
    cabinetId: string,
    groupCabinets: Array<{ cabinetId: string; percentage: number }>
  ) => void
  onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void
  /** Benchtop overhang change callback - only for child benchtops */
  onBenchtopOverhangChange?: (
    cabinetId: string,
    type: "front" | "left" | "right",
    value: number
  ) => void
  /** Benchtop thickness change callback - only for child benchtops */
  onBenchtopThicknessChange?: (cabinetId: string, value: number) => void
  /** Benchtop height from floor change callback */
  onBenchtopHeightFromFloorChange?: (cabinetId: string, value: number) => void
  /** Manual dimension delta change callback - for child benchtops and panels */
  onManualDimensionDeltaChange?: (
    cabinetId: string,
    dimension: "width" | "height" | "depth",
    delta: number
  ) => void
  getFormula?: (cabinetId: string, dimId: string) => string | undefined
  onFormulaChange?: (
    cabinetId: string,
    dimId: string,
    formula: string | null
  ) => void
  getFormulaLastEvaluatedAt?: (cabinetId: string) => number | undefined
}

export interface ProductPanelProps extends ProductPanelCallbacks {
  isVisible: boolean
  onClose: () => void
  selectedCabinet?: SelectedCabinetSnapshot | null
  /** When provided, ProductPanel will render dynamic dimension controls from this schema */
  wsProduct?: WsProduct
  /** View manager for grouping cabinets */
  viewManager?: ReturnType<
    typeof import("../hooks/useViewManager").useViewManager
  >
  /** All cabinets in the scene for accurate view counts */
  allCabinets?: import("@/features/scene/types").CabinetData[]
  /** Initial group data for the selected cabinet */
  initialGroupData?: Array<{ cabinetId: string; percentage: number }>
  /** Initial sync data for the selected cabinet */
  initialSyncData?: string[]
  /** Formula pieces available for composing expressions */
  formulaPieces?: FormulaPiece[]
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
