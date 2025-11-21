import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { WallDimensions } from '../types'

type Props = {
  isOpen: boolean
  onClose: () => void
  wallDimensions: WallDimensions
  wallColor: string
  onApply: (dims: WallDimensions, color: string) => void
}

export const WallSettingsModal: React.FC<Props> = ({ isOpen, onClose, wallDimensions, wallColor, onApply }) => {
  const [tempHeight, setTempHeight] = useState(wallDimensions.height)
  const [tempLength, setTempLength] = useState(wallDimensions.length)
  const [tempWallColor, setTempWallColor] = useState(wallColor)

  useEffect(() => {
    if (isOpen) {
      setTempHeight(wallDimensions.height)
      setTempLength(wallDimensions.length)
      setTempWallColor(wallColor)
    }
  }, [isOpen, wallColor, wallDimensions.height, wallDimensions.length])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-90vw">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Wall Dimensions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">Height (mm)</label>
            <input type="number" id="height" value={tempHeight} onChange={e => setTempHeight(Number(e.target.value) || 0)} min={100} max={10000} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-1">Length (mm)</label>
            <input type="number" id="length" value={tempLength} onChange={e => setTempLength(Number(e.target.value) || 0)} min={100} max={20000} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label htmlFor="wallColor" className="block text-sm font-medium text-gray-700 mb-1">Wall Color</label>
            <div className="flex items-center space-x-3">
              <input type="color" id="wallColor" value={tempWallColor} onChange={e => setTempWallColor(e.target.value)} className="w-16 h-12 border border-gray-300 rounded-md cursor-pointer" title="Click to change wall color" />
              <input type="text" value={tempWallColor} onChange={e => setTempWallColor(e.target.value)} placeholder="#dcbfa0" className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
            </div>
            <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
              <span>Preview:</span>
              <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: tempWallColor }} title={`Preview: ${tempWallColor}`} />
              <span className="font-mono text-xs">{tempWallColor}</span>
              {tempWallColor !== wallColor && (
                <span className="text-blue-600 text-xs">(Color will change)</span>
              )}
            </div>
          </div>

          {/* Current dimensions display hidden per user request */}
          {/* <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <p><strong>Current dimensions:</strong></p>
            <p>Height: {wallDimensions.height}mm</p>
            <p>Length: {wallDimensions.length}mm</p>
            <p>Thickness: 90mm (fixed)</p>
            <div className="flex items-center space-x-2 mt-2">
              <span><strong>Color:</strong></span>
              <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: wallColor }} title={`Current wall color: ${wallColor}`} />
              <span className="font-mono text-xs">{wallColor}</span>
            </div>
          </div> */}

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={() => onApply({ height: Math.max(100, tempHeight), length: Math.max(100, tempLength) }, tempWallColor)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Apply</button>
          </div>
        </div>
      </div>
    </div>
  )
}
