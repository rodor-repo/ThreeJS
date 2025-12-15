import { useEffect } from "react"
import type { WsProduct } from "@/types/erpTypes"
import type { GDMapping } from "./useGDMapping"
import { SelectedCabinetSnapshot } from "../../productPanel.types"
import { syncCabinetDimensionsToValues } from "../utils/dimensionUtils"

/**
 * Event detail for productPanel:updateDim
 */
export interface UpdateDimEventDetail {
  id: string
  value: number
}

/**
 * Options for the dimension events hook
 */
export interface UseDimensionEventsOptions {
  /** Cabinet ID - events are ignored if undefined */
  cabinetId: string | undefined
  /** Selected cabinet for dimension sync on rejection */
  selectedCabinet: SelectedCabinetSnapshot | undefined
  /** WsProduct dims for dimension mapping */
  dims: WsProduct["dims"] | undefined
  /** GD mapping for dimension type detection */
  gdMapping: GDMapping
  /** Callback when a dimension value should be updated */
  onValueUpdate: (id: string, value: number) => void
  /** Callback to update persisted state for a single value */
  onPersistedValueUpdate?: (id: string, value: number) => void
  /** Callback when values should be synced from cabinet dimensions (rejection) */
  onValuesSync: (values: Record<string, number | string>) => void
  /** Callback to update persisted values on sync */
  onPersistedValuesSync?: (values: Record<string, number | string>) => void
}

/**
 * Hook to handle custom window events for dimension updates
 *
 * Events handled:
 * - productPanel:updateDim: Updates a single dimension value from external source
 * - productPanel:dimensionRejected: Syncs values from cabinet dimensions when a change is rejected
 */
export function useDimensionEvents(options: UseDimensionEventsOptions): void {
  const {
    cabinetId,
    selectedCabinet,
    dims,
    gdMapping,
    onValueUpdate,
    onPersistedValueUpdate,
    onValuesSync,
    onPersistedValuesSync,
  } = options

  // Handle productPanel:updateDim events
  useEffect(() => {
    if (!cabinetId) return

    const handler = (e: Event) => {
      const ev = e as CustomEvent<UpdateDimEventDetail>
      const payload = ev.detail || (e as MessageEvent).data

      if (!payload || typeof payload.id !== "string") return

      const id = payload.id
      const valNum = Number(payload.value)

      if (isNaN(valNum)) return

      // Update local state
      onValueUpdate(id, valNum)

      // Update persisted state
      onPersistedValueUpdate?.(id, valNum)
    }

    window.addEventListener("productPanel:updateDim", handler)
    return () => {
      window.removeEventListener("productPanel:updateDim", handler)
    }
  }, [cabinetId, onValueUpdate, onPersistedValueUpdate])

  // Handle productPanel:dimensionRejected events
  useEffect(() => {
    if (!cabinetId || !selectedCabinet || !dims) return

    const handler = () => {
      // When a dimension change is rejected (e.g., constraint violation),
      // we need to sync the local values state back to the actual cabinet dimensions.
      //
      // We can't simply do setValues(prev => ({ ...prev })) because by the time this
      // event fires, the local `values` state has already been updated with the rejected
      // value (e.g., 501). We need to read from selectedCabinet.dimensions (the source
      // of truth, still at 500) and explicitly overwrite the incorrect local state.

      const syncedValues = syncCabinetDimensionsToValues(
        {}, // Start fresh - we only want to sync dimension values
        dims,
        gdMapping,
        selectedCabinet.dimensions
      )

      // Merge synced dimension values with callback
      onValuesSync(syncedValues)

      // Update persisted state
      onPersistedValuesSync?.(syncedValues)
    }

    window.addEventListener("productPanel:dimensionRejected", handler)
    return () => {
      window.removeEventListener("productPanel:dimensionRejected", handler)
    }
  }, [
    cabinetId,
    selectedCabinet,
    dims,
    gdMapping,
    onValuesSync,
    onPersistedValuesSync,
  ])
}

/**
 * Dispatch a dimension update event
 * Useful for external components to trigger dimension changes
 */
export function dispatchDimensionUpdate(id: string, value: number): void {
  const event = new CustomEvent<UpdateDimEventDetail>(
    "productPanel:updateDim",
    {
      detail: { id, value },
    }
  )
  window.dispatchEvent(event)
}

/**
 * Dispatch a dimension rejected event
 * Triggers sync of values from cabinet dimensions
 */
export function dispatchDimensionRejected(): void {
  const event = new CustomEvent("productPanel:dimensionRejected")
  window.dispatchEvent(event)
}
