import { useEffect, useRef } from "react"
import type { CabinetData } from "@/features/scene/types"
import type { WsProduct } from "@/types/erpTypes"
import type {
  MaterialOptionsResponse,
  DefaultMaterialSelections,
} from "@/server/getProductData"
import type { GDMapping } from "./useGDMapping"
import { SelectedCabinetSnapshot } from "../../productPanel.types"
import type { PersistedPanelState } from "./usePersistence"
import type { MaterialSelections } from "../utils/materialUtils"
import { buildApiDefaults, mergeSelections } from "../utils/materialUtils"
import {
  buildDefaultValues,
  syncCabinetDimensionsToValues,
} from "../utils/dimensionUtils"
import { getPartDataManager } from "@/nesting/PartDataManager"

/**
 * Initialization result containing all computed state
 */
export interface InitializationResult {
  values: Record<string, number | string>
  materialColor: string
  materialSelections: MaterialSelections
  shouldApply3D: boolean
}

/**
 * Options for the initialization hook
 */
export interface UseInitializationOptions {
  /** Cabinet ID - initialization skipped if undefined */
  cabinetId: string | undefined
  /** WsProduct data with dims */
  wsProduct: WsProduct | undefined
  /** Material options from API */
  materialOptions: MaterialOptionsResponse | undefined
  /** Default material selections from API */
  defaultMaterialSelections: DefaultMaterialSelections | undefined
  /** Selected cabinet for dimension sync */
  selectedCabinet: SelectedCabinetSnapshot | undefined
  /** GD mapping for dimension type detection */
  gdMapping: GDMapping
  /** Get persisted state for cabinet */
  getPersistedState: (cabinetId: string) => PersistedPanelState | undefined
  /** Set persisted state for cabinet */
  setPersistedState: (cabinetId: string, state: PersistedPanelState) => void
  /** Callback when initialization completes */
  onInitialized: (result: InitializationResult) => void
  /** Callback to apply dimensions to 3D */
  onApply3D?: (values: Record<string, number | string>) => void
  /** Callback to sync material selections to PartDataManager */
  onMaterialSelectionsSync?: (
    cabinetId: string,
    selections: MaterialSelections
  ) => void
}

/**
 * Hook to handle panel initialization when cabinet/product changes
 *
 * Handles:
 * - Loading saved state from persistence
 * - Building API defaults for materials
 * - Syncing cabinet dimensions to values
 * - Applying initial dimensions to 3D
 * - Syncing to PartDataManager
 */
export function useInitialization(options: UseInitializationOptions): void {
  const {
    cabinetId,
    wsProduct,
    materialOptions,
    defaultMaterialSelections,
    selectedCabinet,
    gdMapping,
    getPersistedState,
    setPersistedState,
    onInitialized,
    onApply3D,
    onMaterialSelectionsSync,
  } = options

  const hasInitializedRef = useRef<boolean>(false)

  // Reset initialization flag when cabinet changes
  useEffect(() => {
    hasInitializedRef.current = false
  }, [cabinetId])

  // Main initialization effect
  useEffect(() => {
    if (!wsProduct?.dims || !cabinetId) return
    if (hasInitializedRef.current) return

    hasInitializedRef.current = true

    // Get saved state
    const saved = getPersistedState(cabinetId)

    // Build default values from dims
    const defaults = buildDefaultValues(wsProduct.dims)

    // Merge with saved values
    let nextValues = saved?.values ? { ...defaults, ...saved.values } : defaults

    // Sync with current cabinet dimensions (prioritize actual dimensions)
    if (selectedCabinet) {
      nextValues = syncCabinetDimensionsToValues(
        nextValues,
        wsProduct.dims,
        gdMapping,
        selectedCabinet.dimensions
      )
    }

    // Material color
    const nextColor =
      saved?.materialColor ??
      (selectedCabinet?.material.getColour() || "#ffffff")

    // Build API defaults for materials
    const apiDefaults = buildApiDefaults(
      defaultMaterialSelections,
      materialOptions
    )

    // Merge material selections
    const nextSelections = mergeSelections(
      apiDefaults,
      saved?.materialSelections
    )

    // Persist the initialized state
    setPersistedState(cabinetId, {
      values: nextValues,
      materialColor: nextColor,
      materialSelections: nextSelections,
      price: saved?.price,
      formulas: saved?.formulas,
    })

    // Sync material selections to PartDataManager
    if (Object.keys(nextSelections).length > 0) {
      onMaterialSelectionsSync?.(cabinetId, nextSelections)
    }

    // Determine if we should apply to 3D
    const shouldApply3D = !selectedCabinet?.carcass?.defaultDimValuesApplied

    // Notify initialization complete
    onInitialized({
      values: nextValues,
      materialColor: nextColor,
      materialSelections: nextSelections,
      shouldApply3D,
    })

    // Apply to 3D if needed
    if (shouldApply3D) {
      onApply3D?.(nextValues)
      // Mark as applied (this mutates the carcass object)
      if (selectedCabinet?.carcass) {
        selectedCabinet.carcass.defaultDimValuesApplied = true
      }
    }
  }, [
    wsProduct?.dims,
    cabinetId,
    materialOptions,
    defaultMaterialSelections,
    selectedCabinet,
    gdMapping,
    getPersistedState,
    setPersistedState,
    onInitialized,
    onApply3D,
    onMaterialSelectionsSync,
  ])
}

/**
 * Sync material data to PartDataManager
 * Call this when material options or selections change
 */
export function syncToPartDataManager(
  productId: string,
  cabinetId: string,
  materialOptions: MaterialOptionsResponse | undefined,
  defaultMaterialSelections: DefaultMaterialSelections | undefined,
  materialSelections: MaterialSelections | undefined,
  selectedCabinet: SelectedCabinetSnapshot | undefined
): void {
  if (!productId) return

  const partDataManager = getPartDataManager()

  // Sync material options and defaults
  if (materialOptions && defaultMaterialSelections) {
    partDataManager.setMaterialOptions(productId, materialOptions)
    partDataManager.setDefaultMaterialSelections(
      productId,
      defaultMaterialSelections
    )
  }

  // Sync material selections
  if (materialSelections && Object.keys(materialSelections).length > 0) {
    partDataManager.setMaterialSelections(cabinetId, materialSelections)

    // Update cabinet parts to refresh door color names
    if (selectedCabinet?.carcass) {
      partDataManager.updateCabinetParts(selectedCabinet as CabinetData)
    }
  }
}

/**
 * Hook to sync material data to PartDataManager
 */
export function useMaterialSync(
  productId: string | undefined,
  cabinetId: string | undefined,
  materialOptions: MaterialOptionsResponse | undefined,
  defaultMaterialSelections: DefaultMaterialSelections | undefined,
  materialSelections: MaterialSelections | undefined,
  selectedCabinet: SelectedCabinetSnapshot | undefined
): void {
  // Sync materialOptions and defaultMaterialSelections to PartDataManager
  useEffect(() => {
    if (!productId || !materialOptions || !defaultMaterialSelections) return

    const partDataManager = getPartDataManager()
    partDataManager.setMaterialOptions(productId, materialOptions)
    partDataManager.setDefaultMaterialSelections(
      productId,
      defaultMaterialSelections
    )
  }, [productId, materialOptions, defaultMaterialSelections])

  // Sync materialSelections to PartDataManager whenever it changes
  useEffect(() => {
    if (!cabinetId || !selectedCabinet || !materialSelections) return
    if (Object.keys(materialSelections).length === 0) return

    const partDataManager = getPartDataManager()
    partDataManager.setMaterialSelections(cabinetId, materialSelections)
    // Update cabinet parts to refresh door color names
    if (selectedCabinet.carcass) {
      partDataManager.updateCabinetParts(selectedCabinet as CabinetData)
    }
  }, [cabinetId, materialSelections, selectedCabinet])
}
