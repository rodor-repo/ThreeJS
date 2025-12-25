import React, { useState, useEffect, useRef } from 'react'
import { Move, Focus, Trash2, Box } from 'lucide-react'
import type { AppMode } from '../context/ModeContext'

type Props = {
  isDragging: boolean
  cameraMode: 'constrained' | 'free'
  onToggleMode: () => void
  onReset: () => void
  onClear: () => void
  onX: () => void
  onY: () => void
  onZ: () => void
  onToggleDimensions?: () => void
  onToggleNumbers?: () => void
  numbersVisible?: boolean
  onDelete?: () => void
  canDelete?: boolean
  isMenuOpen?: boolean
  isOrthoView?: boolean
  onResetTo3D?: () => void
  mode?: AppMode
}

export const CameraControls: React.FC<Props> = ({ isDragging, cameraMode, onToggleMode, onReset, onClear, onX, onY, onZ, onToggleDimensions, onToggleNumbers, numbersVisible = false, onDelete, canDelete = false, isMenuOpen = false, isOrthoView = false, onResetTo3D, mode = 'admin' }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [showXYZButtons, setShowXYZButtons] = useState(false)
  const xyzContainerRef = useRef<HTMLDivElement>(null)

  // Handle clicks outside the X, Y, Z buttons area to hide them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (xyzContainerRef.current && !xyzContainerRef.current.contains(event.target as Node)) {
        setShowXYZButtons(false)
      }
    }

    if (showXYZButtons) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showXYZButtons])

  return (
    <div
      data-camera-controls
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Camera Movement Instructions - Shown on hover */}
      {isHovered && !isMenuOpen && (
        <div className={`${isOrthoView ? 'bg-green-600' : cameraMode === 'constrained' ? 'bg-gray-600' : 'bg-purple-600'} text-white px-4 py-2 rounded-lg shadow-lg text-sm mb-2 whitespace-nowrap`}>
          {isOrthoView
            ? '2D Ortho View • Drag to pan • Wheel to zoom • Click 3D to return'
            : cameraMode === 'constrained'
            ? 'Constrained Mode • Drag to pan • Wheel to zoom • Right-click cabinet to select'
            : 'Free Mode • Drag to rotate • Right-drag to pan • Shift+click cabinets'
          }
        </div>
      )}
      {isHovered && isMenuOpen && (
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm mb-2 whitespace-nowrap">
          Menu Open • Camera controls disabled
        </div>
      )}

      <div className="flex gap-2">
      {/* 3D View button - appears prominently when in ortho mode */}
      {isOrthoView && onResetTo3D && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onResetTo3D()
          }}
          className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200 animate-pulse"
          title="Return to 3D perspective view"
        >
          <Box size={24} />
        </button>
      )}

      <button
        onClick={onToggleMode}
        className={`${cameraMode === 'free' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-teal-600 hover:bg-teal-700'} text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
        title={cameraMode === 'free' ? 'Free Camera Mode (Click to switch to Constrained)' : 'Constrained Camera Mode (Click to switch to Free Orbit)'}
      >
        <Focus size={24} />
      </button>

      {/* 3D View button with X, Y, Z buttons that appear on hover */}
      <div 
        ref={xyzContainerRef}
        className="relative"
        onMouseEnter={() => setShowXYZButtons(true)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (showXYZButtons) {
              // If buttons are visible, hide them
              setShowXYZButtons(false)
            } else {
              // Otherwise, perform the reset action
              onReset()
            }
          }}
          className={`${isDragging ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
          title="3D View: Drag to move camera • Wheel: Zoom • Middle click: Reset"
        >
          <Move size={24} />
        </button>

        {/* X, Y, Z buttons - shown vertically above 3D View button on hover */}
        {showXYZButtons && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 flex flex-col gap-2 mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onX()
                setShowXYZButtons(false)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
              title="X View: Side view of wall (profile)"
            >
              <div className="flex items-center justify-center w-6 h-6">
                <span className="text-lg font-bold">X</span>
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onY()
                setShowXYZButtons(false)
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
              title="Y View: Front view of wall (face-on)"
            >
              <div className="flex items-center justify-center w-6 h-6">
                <span className="text-lg font-bold">Y</span>
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onZ()
                setShowXYZButtons(false)
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
              title="Z View: Top view of wall (from above)"
            >
              <div className="flex items-center justify-center w-6 h-6">
                <span className="text-lg font-bold">Z</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {mode === 'admin' && (
        <button
          onClick={onClear}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Clear all cabinets"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">C</span>
          </div>
        </button>
      )}

      {onToggleDimensions && (
        <button
          onClick={onToggleDimensions}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Toggle dimension lines visibility"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">D</span>
          </div>
        </button>
      )}

      {onToggleNumbers && (
        <button
          onClick={onToggleNumbers}
          className={`${numbersVisible ? 'bg-gray-800' : 'bg-black'} hover:bg-gray-900 text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
          title="Toggle cabinet numbering"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">N</span>
          </div>
        </button>
      )}

      {mode === 'admin' && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (onDelete && canDelete) {
              onDelete()
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          disabled={!canDelete}
          className={`${canDelete ? 'bg-red-600 hover:bg-red-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'} text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
          title={canDelete ? "Delete selected cabinet" : "Select a cabinet to delete"}
          type="button"
        >
          <Trash2 size={20} />
        </button>
      )}
      </div>
    </div>
  )
}
