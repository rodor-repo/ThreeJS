import React from "react"
import { EyeOff, RotateCcw } from "lucide-react"

interface DimensionLineControlsProps {
  /** Whether a dimension line is currently selected */
  hasSelection: boolean
  /** Whether there are any modifications (hidden or repositioned lines) */
  hasModifications: boolean
  /** Callback when hide button is clicked */
  onHide: () => void
  /** Callback when reset button is clicked */
  onReset: () => void
  /** Whether we're in orthographic view (controls only show in ortho) */
  isOrthoView: boolean
}

/**
 * UI controls for dimension line interactions
 * Appears next to the Save button in the bottom-left corner
 * Shows Hide button when a dimension line is selected
 * Shows Reset button when there are modifications
 */
export const DimensionLineControls: React.FC<DimensionLineControlsProps> = ({
  hasSelection,
  hasModifications,
  onHide,
  onReset,
  isOrthoView,
}) => {
  // Only show controls in orthographic view
  if (!isOrthoView) return null

  // Only show if there's something to interact with
  if (!hasSelection && !hasModifications) return null

  return (
    <div className="fixed bottom-4 left-32 z-50 flex gap-2 items-center">
      {/* Hide selected dimension line button */}
      {hasSelection && (
        <button
          onClick={onHide}
          className="flex items-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
          title="Hide selected dimension line"
        >
          <EyeOff size={18} />
          <span>Hide</span>
        </button>
      )}

      {/* Reset all modifications button */}
      {hasModifications && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
          title="Reset all dimension line positions and visibility"
        >
          <RotateCcw size={18} />
          <span>Reset Dimension Lines</span>
        </button>
      )}
    </div>
  )
}

export default DimensionLineControls
