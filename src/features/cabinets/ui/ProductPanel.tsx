/**
 * ProductPanel - Thin wrapper for cabinet property editing
 * 
 * This file provides a clean public API for the ProductPanel component.
 * The actual implementation lives in the productPanel/ subfolder.
 * 
 * @module ProductPanel
 */

import React from "react"
import { DynamicPanelWithQuery } from "./productPanel/DynamicPanelWithQuery"
import type { ProductPanelProps } from "./productPanel.types"

// Re-exports for backward compatibility
export { toNum } from "./productPanel/utils/dimensionUtils"
export { toastThrottled } from "./productPanel/utils/toastUtils"
export {
  cabinetPanelState,
  type PersistedPanelState,
} from "./productPanel/hooks/usePersistence"

/**
 * ProductPanel component for editing cabinet dimensions and materials.
 * 
 * Features:
 * - Dynamic dimension controls based on WsProduct schema
 * - Material selection with color picker
 * - View assignment for cabinet grouping
 * - Pair and sync functionality for linked cabinets
 * - Off-the-floor positioning for fillers and panels
 * - Real-time price calculation
 * - State persistence across panel reopens
 * 
 * @example
 * ```tsx
 * <ProductPanel
 *   isVisible={showPanel}
 *   onClose={() => setShowPanel(false)}
 *   selectedCabinet={selectedCabinetSnapshot}
 *   onDimensionsChange={handleDimensionsChange}
 *   onMaterialChange={handleMaterialChange}
 *   viewManager={viewManager}
 *   allCabinets={cabinets}
 * />
 * ```
 */
const ProductPanel: React.FC<ProductPanelProps> = (props) => {
  return <DynamicPanelWithQuery {...props} />
}

export default ProductPanel
