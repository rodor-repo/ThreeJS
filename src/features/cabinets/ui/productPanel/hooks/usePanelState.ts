import { useState, useCallback, useEffect } from "react"
import _ from "lodash"
import type { WsProduct } from "@/types/erpTypes"
import type { MaterialSelections } from "../utils/materialUtils"

/**
 * State values for the panel
 */
export interface PanelStateValues {
  /** Dimension values keyed by dimension ID */
  values: Record<string, number | string>
  /** Material color hex string */
  materialColor: string
  /** Material selections for each material ID */
  materialSelections: MaterialSelections
  /** Temporary editing buffer for number inputs (allows typing before validation) */
  editingValues: Record<string, string>
  /** Debounced inputs for price calculation */
  debouncedInputs: {
    dims: Record<string, number | string>
    materialSelections: MaterialSelections
  }
}

/**
 * Actions for updating panel state
 */
export interface PanelStateActions {
  setValues: React.Dispatch<
    React.SetStateAction<Record<string, number | string>>
  >
  setMaterialColor: React.Dispatch<React.SetStateAction<string>>
  setMaterialSelections: React.Dispatch<
    React.SetStateAction<MaterialSelections>
  >
  setEditingValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  /** Update a single dimension value */
  updateValue: (id: string, value: number | string) => void
  /** Update a single editing value (temporary buffer) */
  updateEditingValue: (id: string, value: string | undefined) => void
  /** Clear editing value for a specific dimension */
  clearEditingValue: (id: string) => void
  /** Update a single material selection */
  updateMaterialSelection: (
    materialId: string,
    selection: MaterialSelections[string]
  ) => void
  /** Reset all values to defaults */
  resetAllValues: (dims: WsProduct["dims"]) => void
  /** Reset a single value to default */
  resetValue: (id: string, dimObj: WsProduct["dims"][string]) => void
}

export type UsePanelStateReturn = PanelStateValues & PanelStateActions

/**
 * Options for initializing panel state
 */
export interface UsePanelStateOptions {
  /** Initial dimension values from WsProduct.dims */
  initialDims?: WsProduct["dims"]
  /** Initial material color */
  initialMaterialColor?: string
  /** Initial material selections */
  initialMaterialSelections?: MaterialSelections
}

/**
 * Hook to manage all panel state in one place
 * Includes debouncing for price calculation inputs
 */
export function usePanelState(
  options: UsePanelStateOptions = {}
): UsePanelStateReturn {
  const {
    initialDims,
    initialMaterialColor = "#ffffff",
    initialMaterialSelections,
  } = options

  // Build initial values from dims
  const buildInitialValues = (): Record<string, number | string> => {
    if (!initialDims) return {}
    const initial: Record<string, number | string> = {}
    Object.entries(initialDims).forEach(([id, dimObj]) => {
      initial[id] = dimObj.defaultValue
    })
    return initial
  }

  // Core state
  const [values, setValues] =
    useState<Record<string, number | string>>(buildInitialValues)
  const [materialColor, setMaterialColor] =
    useState<string>(initialMaterialColor)
  const [materialSelections, setMaterialSelections] =
    useState<MaterialSelections>(initialMaterialSelections || {})
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})

  // Debounced inputs for price calculation
  const [debouncedInputs, setDebouncedInputs] = useState({
    dims: values,
    materialSelections,
  })

  // Setup debounced updates
  useEffect(() => {
    const updater = _.debounce(
      (next: {
        dims: Record<string, number | string>
        materialSelections: MaterialSelections
      }) => {
        setDebouncedInputs(next)
      },
      400
    )
    updater({ dims: values, materialSelections })
    return () => {
      updater.cancel()
    }
  }, [values, materialSelections])

  // Update a single dimension value
  const updateValue = useCallback((id: string, value: number | string) => {
    setValues((prev) => ({ ...prev, [id]: value }))
  }, [])

  // Update editing buffer
  const updateEditingValue = useCallback(
    (id: string, value: string | undefined) => {
      if (value === undefined) {
        setEditingValues((prev) => {
          const { [id]: _, ...rest } = prev
          return rest
        })
      } else {
        setEditingValues((prev) => ({ ...prev, [id]: value }))
      }
    },
    []
  )

  // Clear editing value
  const clearEditingValue = useCallback((id: string) => {
    setEditingValues((prev) => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Update a single material selection
  const updateMaterialSelection = useCallback(
    (materialId: string, selection: MaterialSelections[string]) => {
      setMaterialSelections((prev) => ({ ...prev, [materialId]: selection }))
    },
    []
  )

  // Reset all values to defaults
  const resetAllValues = useCallback((dims: WsProduct["dims"]) => {
    if (!dims) return
    const next: Record<string, number | string> = {}
    Object.entries(dims).forEach(([id, dimObj]) => {
      if (dimObj.valueType === "range") {
        let defVal = Number(dimObj.defaultValue ?? dimObj.min ?? 0)
        if (isNaN(defVal)) defVal = 0
        if (typeof dimObj.min === "number")
          defVal = Math.max(dimObj.min, defVal)
        if (typeof dimObj.max === "number")
          defVal = Math.min(dimObj.max, defVal)
        next[id] = defVal
      } else {
        next[id] = String(dimObj.defaultValue ?? dimObj.options?.[0] ?? "")
      }
    })
    setValues(next)
    setEditingValues({})
  }, [])

  // Reset a single value to default
  const resetValue = useCallback(
    (id: string, dimObj: WsProduct["dims"][string]) => {
      let defVal: number | string
      if (dimObj.valueType === "range") {
        defVal = Number(dimObj.defaultValue ?? dimObj.min ?? 0)
        if (isNaN(defVal as number)) defVal = 0
        if (typeof dimObj.min === "number")
          defVal = Math.max(dimObj.min, defVal as number)
        if (typeof dimObj.max === "number")
          defVal = Math.min(dimObj.max, defVal as number)
      } else {
        defVal = String(dimObj.defaultValue ?? dimObj.options?.[0] ?? "")
      }
      setValues((prev) => ({ ...prev, [id]: defVal }))
      clearEditingValue(id)
    },
    [clearEditingValue]
  )

  return {
    // State values
    values,
    materialColor,
    materialSelections,
    editingValues,
    debouncedInputs,
    // State setters
    setValues,
    setMaterialColor,
    setMaterialSelections,
    setEditingValues,
    // Actions
    updateValue,
    updateEditingValue,
    clearEditingValue,
    updateMaterialSelection,
    resetAllValues,
    resetValue,
  }
}
