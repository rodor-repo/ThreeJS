import React from 'react'
import type { CarcassDimensions } from '@/features/carcass'

export interface OffTheFloorControlProps {
  /** Current off-the-floor value */
  value: number
  /** Editing buffer value */
  editingValue: string
  /** Value change callback */
  onValueChange: (value: number) => void
  /** Editing value change callback */
  onEditingChange: (value: string) => void
}

const MIN_VALUE = 0
const MAX_VALUE = 1200

/**
 * Off the Floor control component for fillers and panels
 * Allows adjusting the Y position of the cabinet
 */
export const OffTheFloorControl: React.FC<OffTheFloorControlProps> = ({
  value,
  editingValue,
  onValueChange,
  onEditingChange
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEditingChange(e.target.value)
  }

  const handleInputBlur = () => {
    if (editingValue === '') {
      onEditingChange('')
      return
    }

    let val = Number(editingValue)
    if (isNaN(val)) {
      onEditingChange('')
      return
    }

    val = Math.max(MIN_VALUE, Math.min(MAX_VALUE, val))
    onValueChange(val)
    onEditingChange('')
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(MIN_VALUE, Math.min(MAX_VALUE, Number(e.target.value)))
    onValueChange(val)
    onEditingChange('')
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Off the Floor
        </label>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="number"
            className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
            value={editingValue !== '' ? editingValue : String(value)}
            min={MIN_VALUE}
            max={MAX_VALUE}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
          />
          <span className="text-sm text-gray-500">mm</span>
        </div>
        <input
          type="range"
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          value={value}
          min={MIN_VALUE}
          max={MAX_VALUE}
          onChange={handleSliderChange}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{MIN_VALUE}</span>
          <span>{MAX_VALUE}</span>
        </div>
      </div>
    </div>
  )
}

export default OffTheFloorControl
