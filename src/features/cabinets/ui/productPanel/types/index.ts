/**
 * Consolidated types for the ProductPanel component system
 */

// Re-export hook types
export type { PersistedPanelState } from "../hooks/usePersistence"
export type {
  PanelStateValues,
  PanelStateActions,
} from "../hooks/usePanelState"
export type { GDMapping } from "../hooks/useGDMapping"
export type { GroupCabinet } from "../hooks/useCabinetGroups"
export type { UseOffTheFloorReturn } from "../hooks/useOffTheFloor"

// Re-export utility types
export type { MaterialSelections } from "../utils/materialUtils"
export type { DimEntry, DrawerHeightValidation } from "../utils/dimensionUtils"

// Re-export main panel types
export type {
  ProductPanelProps,
  SelectedCabinetSnapshot,
  ProductPanelCallbacks,
  DimensionRange,
  DimensionConstraints,
} from "../../productPanel.types"

// Import types for local use
import type { ProductPanelProps } from "../../productPanel.types"
import type {
  MaterialOptionsResponse,
  DefaultMaterialSelections,
} from "@/server/getProductData"
import type { GDThreeJsType } from "@/types/erpTypes"
import type { GroupCabinet } from "../hooks/useCabinetGroups"

/**
 * Props for the DynamicPanel component
 */
export interface DynamicPanelProps extends ProductPanelProps {
  /** Product ID for the selected cabinet */
  productId?: string
  /** Loading state from data fetch */
  loading?: boolean
  /** Error state from data fetch */
  error?: boolean
  /** Material options from API */
  materialOptions?: MaterialOptionsResponse
  /** Default material selections from API */
  defaultMaterialSelections?: DefaultMaterialSelections
  /** Three.js GD mapping from API */
  threeJsGDs: Record<GDThreeJsType, string[]> | undefined
  /** Callback when group cabinets change */
  onGroupChange?: (cabinetId: string, groupCabinets: GroupCabinet[]) => void
  /** Initial group data for the cabinet */
  initialGroupData?: GroupCabinet[]
  /** Callback when sync cabinets change */
  onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void
  /** Initial sync data for the cabinet */
  initialSyncData?: string[]
}
