import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { WsProduct } from '@/types/erpTypes'
import { toNum, clampValue, getDefaultDimValue } from '../utils/dimensionUtils'

export interface DimensionInputProps {
  /** Dimension ID */
  id: string
  /** Dimension object from WsProduct */
  dimObj: WsProduct['dims'][string]
  /** Current value */
  value: number | string
  /** Editing buffer value (for temporary input state) */
  editingValue?: string
  /** Whether the input is disabled */
  disabled: boolean
  /** Badges to display (e.g., "Width", "Height") */
  badges: string[]
  /** Value change callback */
  onValueChange: (id: string, value: number | string) => void
  /** Editing buffer change callback */
  onEditingChange: (id: string, value: string | undefined) => void
  /** Reset to default callback */
  onReset: (id: string) => void
  /** Optional validation function - returns error message or undefined */
  onValidate?: (id: string, value: number) => string | undefined
}

/**
 * Single dimension input component
 * Handles both range (slider + number input) and select types
 */
export const DimensionInput: React.FC<DimensionInputProps> = ({
  id,
  dimObj,
  value,
  editingValue,
  disabled,
  badges,
  onValueChange,
  onEditingChange,
  onReset,
  onValidate
}) => {
  const handleRangeNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing (including temporarily out-of-range) until blur
    onEditingChange(id, e.target.value)
  }

  const handleRangeNumberBlur = () => {
    const raw = editingValue
    if (raw === undefined) return

    if (raw.trim() === '') {
      // Empty input -> revert to previous stored value
      onEditingChange(id, undefined)
      return
    }

    let val = Number(raw)
    if (isNaN(val)) {
      // Invalid number -> revert
      onEditingChange(id, undefined)
      return
    }

    // Clamp to min/max only now (after full entry)
    val = clampValue(val, dimObj.min, dimObj.max)

    // Run validation if provided
    if (onValidate) {
      const error = onValidate(id, val)
      if (error) {
        onEditingChange(id, undefined)
        return
      }
    }

    onValueChange(id, val)
    onEditingChange(id, undefined)
  }

  const handleRangeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value)
    if (isNaN(val)) return

    val = clampValue(val, dimObj.min, dimObj.max)

    // Run validation if provided
    if (onValidate) {
      const error = onValidate(id, val)
      if (error) return
    }

    onValueChange(id, val)
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange(id, e.target.value)
  }

  const handleReset = () => {
    onReset(id)
  }

  // Calculate default value for comparison
  const _defVal = getDefaultDimValue(dimObj)

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {dimObj.dim}
        </label>
        <div className="flex items-center gap-2">
          {badges.map(badge => (
            <span
              key={badge}
              className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {dimObj.valueType === 'range' ? (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <input
              type="number"
              disabled={disabled}
              className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
              value={editingValue !== undefined ? editingValue : String(value ?? dimObj.defaultValue ?? dimObj.min)}
              min={dimObj.min}
              max={dimObj.max}
              onChange={handleRangeNumberChange}
              onBlur={handleRangeNumberBlur}
            />
            <button
              type="button"
              disabled={disabled}
              title="Reset dimension"
              onClick={handleReset}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            >
              <RotateCcw size={14} />
            </button>
            <span className="text-sm text-gray-500">mm</span>
          </div>
          <input
            type="range"
            disabled={disabled}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            value={toNum(value ?? dimObj.defaultValue ?? dimObj.min)}
            min={dimObj.min}
            max={dimObj.max}
            onChange={handleRangeSliderChange}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{dimObj.min}</span>
            <span>{dimObj.max}</span>
          </div>
        </div>
      ) : (
        <select
          disabled={disabled}
          className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
          value={String(value ?? dimObj.defaultValue ?? (dimObj.options?.[0] ?? ''))}
          onChange={handleSelectChange}
        >
          {dimObj.options?.map(opt => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export default DimensionInput
