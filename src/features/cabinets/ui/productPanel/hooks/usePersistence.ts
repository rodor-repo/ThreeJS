import { useCallback } from "react"
import type { MaterialSelections } from "../utils/materialUtils"

/**
 * Persisted panel state for a cabinet
 */
export type PersistedPanelState = {
  values: Record<string, number | string>
  materialColor: string
  materialSelections?: MaterialSelections
  price?: { amount: number }
}

/**
 * Global in-memory state store for cabinet panel state
 * Persists values across panel reopens within the same session
 */
export const cabinetPanelState = new Map<string, PersistedPanelState>()

// ============================================================================
// Price Invalidation Event System
// ============================================================================

/**
 * Listener type for price invalidation events
 */
export type PriceInvalidationListener = (cabinetId: string) => void

/**
 * Set of listeners subscribed to price invalidation events
 */
const priceInvalidationListeners = new Set<PriceInvalidationListener>()

/**
 * Subscribe to price invalidation events
 * @returns Unsubscribe function
 */
export function onPriceNeedsInvalidation(
  listener: PriceInvalidationListener
): () => void {
  priceInvalidationListeners.add(listener)
  return () => priceInvalidationListeners.delete(listener)
}

/**
 * Notify all listeners that a cabinet's price needs recalculation
 * Exported so handlers can trigger invalidation when updating state directly
 */
export function notifyPriceInvalidation(cabinetId: string): void {
  priceInvalidationListeners.forEach((listener) => listener(cabinetId))
}

// ============================================================================
// Persisted State Functions
// ============================================================================

/**
 * Get persisted state for a cabinet
 */
export function getPersistedState(
  cabinetId: string
): PersistedPanelState | undefined {
  return cabinetPanelState.get(cabinetId)
}

/**
 * Set full persisted state for a cabinet
 */
export function setPersistedState(
  cabinetId: string,
  state: PersistedPanelState
): void {
  cabinetPanelState.set(cabinetId, state)
  notifyPriceInvalidation(cabinetId)
}

/**
 * Update only the values in persisted state
 */
export function updatePersistedValues(
  cabinetId: string,
  values: Record<string, number | string>
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    console.warn(
      "[usePersistence] No persisted state found for cabinet:",
      cabinetId
    )
    return
  }
  setPersistedState(cabinetId, { ...current, values })
}

/**
 * Update only the material color in persisted state
 */
export function updatePersistedMaterialColor(
  cabinetId: string,
  materialColor: string
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    console.warn(
      "[usePersistence] No persisted state found for cabinet:",
      cabinetId
    )
    return
  }
  cabinetPanelState.set(cabinetId, { ...current, materialColor })
}

/**
 * Update only the material selections in persisted state
 */
export function updatePersistedMaterialSelections(
  cabinetId: string,
  materialSelections: MaterialSelections
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    console.warn(
      "[usePersistence] No persisted state found for cabinet:",
      cabinetId
    )
    return
  }
  setPersistedState(cabinetId, { ...current, materialSelections })
}

/**
 * Update only the price in persisted state
 */
export function updatePersistedPrice(
  cabinetId: string,
  price: { amount: number } | undefined
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    // Price updates can happen before full initialization - this is OK
    return
  }
  cabinetPanelState.set(cabinetId, { ...current, price })
}

/**
 * Update a single dimension value in persisted state
 */
export function updatePersistedSingleValue(
  cabinetId: string,
  dimId: string,
  value: number | string
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    throw new Error(`Cabinet panel state not found for: ${cabinetId}`)
  }
  setPersistedState(cabinetId, {
    ...current,
    values: { ...current.values, [dimId]: value },
  })
}

/**
 * Partial update - merge provided fields with existing state
 */
export function mergePersistedState(
  cabinetId: string,
  partial: Partial<PersistedPanelState>
): void {
  const current = cabinetPanelState.get(cabinetId)
  if (!current) {
    console.warn(
      "[usePersistence] No persisted state found for cabinet:",
      cabinetId
    )
    return
  }
  cabinetPanelState.set(cabinetId, { ...current, ...partial })
}

/**
 * Clear persisted state for a cabinet
 */
export function clearPersistedState(cabinetId: string): void {
  cabinetPanelState.delete(cabinetId)
}

/**
 * Check if persisted state exists for a cabinet
 */
export function hasPersistedState(cabinetId: string): boolean {
  return cabinetPanelState.has(cabinetId)
}

/**
 * Hook interface for persistence operations
 */
export interface UsePersistenceReturn {
  getPersisted: () => PersistedPanelState | undefined
  setPersisted: (state: PersistedPanelState) => void
  updateValues: (values: Record<string, number | string>) => void
  updateSingleValue: (dimId: string, value: number | string) => void
  updateMaterialColor: (color: string) => void
  updateMaterialSelections: (selections: MaterialSelections) => void
  updatePrice: (price: { amount: number } | undefined) => void
  mergePersisted: (partial: Partial<PersistedPanelState>) => void
  clearPersisted: () => void
  hasPersisted: () => boolean
}

/**
 * Hook for cabinet panel state persistence
 * Provides memoized callbacks bound to a specific cabinet ID
 */
export function usePersistence(
  cabinetId: string | undefined
): UsePersistenceReturn {
  const getPersisted = useCallback(() => {
    if (!cabinetId) return undefined
    return getPersistedState(cabinetId)
  }, [cabinetId])

  const setPersisted = useCallback(
    (state: PersistedPanelState) => {
      if (!cabinetId) return
      setPersistedState(cabinetId, state)
    },
    [cabinetId]
  )

  const updateValues = useCallback(
    (values: Record<string, number | string>) => {
      if (!cabinetId) return
      updatePersistedValues(cabinetId, values)
    },
    [cabinetId]
  )

  const updateSingleValue = useCallback(
    (dimId: string, value: number | string) => {
      if (!cabinetId) return
      updatePersistedSingleValue(cabinetId, dimId, value)
    },
    [cabinetId]
  )

  const updateMaterialColor = useCallback(
    (color: string) => {
      if (!cabinetId) return
      updatePersistedMaterialColor(cabinetId, color)
    },
    [cabinetId]
  )

  const updateMaterialSelections = useCallback(
    (selections: MaterialSelections) => {
      if (!cabinetId) return
      updatePersistedMaterialSelections(cabinetId, selections)
    },
    [cabinetId]
  )

  const updatePrice = useCallback(
    (price: { amount: number } | undefined) => {
      if (!cabinetId) return
      updatePersistedPrice(cabinetId, price)
    },
    [cabinetId]
  )

  const mergePersisted = useCallback(
    (partial: Partial<PersistedPanelState>) => {
      if (!cabinetId) return
      mergePersistedState(cabinetId, partial)
    },
    [cabinetId]
  )

  const clearPersisted = useCallback(() => {
    if (!cabinetId) return
    clearPersistedState(cabinetId)
  }, [cabinetId])

  const hasPersisted = useCallback(() => {
    if (!cabinetId) return false
    return hasPersistedState(cabinetId)
  }, [cabinetId])

  return {
    getPersisted,
    setPersisted,
    updateValues,
    updateSingleValue,
    updateMaterialColor,
    updateMaterialSelections,
    updatePrice,
    mergePersisted,
    clearPersisted,
    hasPersisted,
  }
}
