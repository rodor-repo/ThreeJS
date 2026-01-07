import React, { useState, useEffect } from 'react'

interface KickerHeightSectionProps {
  viewId: string
  currentKickerHeight: number
  onKickerHeightChange: (viewId: string, height: number) => void
  subtitle?: string
  showSubtitle?: boolean
}

export const KickerHeightSection: React.FC<KickerHeightSectionProps> = ({
  viewId,
  currentKickerHeight,
  onKickerHeightChange,
  subtitle = "Leg Height for Base and Tall Cabinets",
  showSubtitle = true,
}) => {
  const [localKickerHeight, setLocalKickerHeight] = useState(currentKickerHeight)

  // Sync with currentKickerHeight if it changes externally
  useEffect(() => {
    setLocalKickerHeight(currentKickerHeight)
  }, [currentKickerHeight])

  const min = 16
  const max = 170

  const handleChange = (val: number) => {
    if (val >= min && val <= max) {
      setLocalKickerHeight(val)
      onKickerHeightChange(viewId, val)
    }
  }

  return (
    <div className="space-y-4">
      {showSubtitle && (
        <h4 className="font-medium text-gray-700 mb-3 text-sm">{subtitle}</h4>
      )}

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="number"
            className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
            value={localKickerHeight}
            min={min}
            max={max}
            onChange={(e) => {
              const val = Number(e.target.value)
              handleChange(val)
            }}
          />
          <span className="text-sm text-gray-500">mm</span>
        </div>
        <input
          type="range"
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          value={localKickerHeight}
          min={min}
          max={max}
          onChange={(e) => {
            const val = Number(e.target.value)
            handleChange(val)
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
