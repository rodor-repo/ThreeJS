import React from "react"
import { Settings } from "lucide-react"
import { AppMode } from "../context/ModeContext"

interface BottomRightActionsProps {
  cabinetsCount: number
  onExport: () => void
  onNesting: () => void
  onSettings: () => void
  mode: AppMode
}

export const BottomRightActions: React.FC<BottomRightActionsProps> = ({
  cabinetsCount,
  onExport,
  onNesting,
  onSettings,
  mode,
}) => {
  return (
    <div className="absolute bottom-4 right-4 flex gap-3 z-10">
      {mode === 'admin' && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (cabinetsCount === 0) {
                alert("No cabinets in the scene to export.")
                return
              }
              onExport()
            }}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium"
            title="Export Parts to Excel/CSV"
          >
            Export
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onNesting()
            }}
            className="bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium"
            title="Nesting"
          >
            Nesting
          </button>
        </>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onSettings()
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Settings"
      >
        <Settings size={24} />
      </button>
    </div>
  )
}

