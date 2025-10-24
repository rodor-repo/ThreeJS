import React from 'react'
import { Move, Focus } from 'lucide-react'

type Props = {
  isDragging: boolean
  cameraMode: 'constrained' | 'free'
  onToggleMode: () => void
  onReset: () => void
  onClear: () => void
  onX: () => void
  onY: () => void
  onZ: () => void
}

export const CameraControls: React.FC<Props> = ({ isDragging, cameraMode, onToggleMode, onReset, onClear, onX, onY, onZ }) => {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
      <button
        onClick={onToggleMode}
        className={`${cameraMode === 'free' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-teal-600 hover:bg-teal-700'} text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
        title={cameraMode === 'free' ? 'Free Camera Mode (Click to switch to Constrained)' : 'Constrained Camera Mode (Click to switch to Free Orbit)'}
      >
        <Focus size={24} />
      </button>

      <button
        onClick={onReset}
        className={`${isDragging ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
        title="3D View: Drag to move camera • Wheel: Zoom • Middle click: Reset"
      >
        <Move size={24} />
      </button>

      <button
        onClick={onClear}
        className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Clear all cabinets"
      >
        <div className="flex items-center justify-center w-6 h-6">
          <span className="text-lg font-bold">C</span>
        </div>
      </button>

      <button
        onClick={onX}
        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="X View: Side view of wall (profile)"
      >
        <div className="flex items-center justify-center w-6 h-6">
          <span className="text-lg font-bold">X</span>
        </div>
      </button>

      <button
        onClick={onY}
        className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Y View: Front view of wall (face-on)"
      >
        <div className="flex items-center justify-center w-6 h-6">
          <span className="text-lg font-bold">Y</span>
        </div>
      </button>

      <button
        onClick={onZ}
        className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Z View: Top view of wall (from above)"
      >
        <div className="flex items-center justify-center w-6 h-6">
          <span className="text-lg font-bold">Z</span>
        </div>
      </button>
    </div>
  )
}
