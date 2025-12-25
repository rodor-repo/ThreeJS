import React, { useEffect, useState } from "react"
import type { CabinetData } from "../types"

interface UserWidthSliderProps {
  cabinet: CabinetData
  onClose: () => void
  onWidthChange: (cabinetId: string, newWidth: number) => void
  minWidth?: number
  maxWidth?: number
}

export const UserWidthSlider: React.FC<UserWidthSliderProps> = ({
  cabinet,
  onClose,
  onWidthChange,
  minWidth = 200,
  maxWidth = 1200,
}) => {
  const [width, setWidth] = useState(cabinet.carcass.dimensions.width)

  // Sync width state when cabinet changes
  useEffect(() => {
    setWidth(cabinet.carcass.dimensions.width)
  }, [cabinet.carcass.dimensions.width])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = Number(e.target.value)
    setWidth(newWidth)
    // Call immediately without debounce for smooth visual feedback (matches ProductPanel behavior)
    onWidthChange(cabinet.cabinetId, newWidth)
  }

  return (
    <>
      {/* Backdrop to close on click outside */}
      <div
        className="fixed inset-0 z-40"
        data-user-width-slider
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      />

      {/* Slider container - fixed at top center */}
      <div
        className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-[280px] left-1/2 top-20 -translate-x-1/2"
        data-user-width-slider
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">
            Adjust Width
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Slider row */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-8">{minWidth}</span>
          <input
            type="range"
            min={minWidth}
            max={maxWidth}
            step={1}
            value={width}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs text-gray-500 w-10 text-right">{maxWidth}</span>
        </div>

        {/* Current value display */}
        <div className="mt-3 flex items-center justify-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-lg font-mono font-bold text-blue-700">
              {Math.round(width)}
            </span>
            <span className="text-sm text-blue-500 ml-1">mm</span>
          </div>
        </div>

        {/* Cabinet info */}
        <div className="mt-3 text-center text-xs text-gray-400">
          {cabinet.cabinetType.charAt(0).toUpperCase() + cabinet.cabinetType.slice(1)} Cabinet
        </div>
      </div>
    </>
  )
}
