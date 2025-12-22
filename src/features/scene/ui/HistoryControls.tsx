import React, { useMemo, useState } from "react"
import { Clock, Flag, History, Redo, Trash2, Undo } from "lucide-react"

type HistoryEntry = {
  id?: string
  type?: "manual" | "auto"
  savedAt: string | number
}

interface HistoryControlsProps {
  past: HistoryEntry[]
  future: HistoryEntry[]
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  createCheckpoint: () => void
  deleteCheckpoint: (index: number) => void
  jumpTo: (index: number) => void
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({
  past,
  future,
  undo,
  redo,
  canUndo,
  canRedo,
  createCheckpoint,
  deleteCheckpoint,
  jumpTo,
}) => {
  const [showHistory, setShowHistory] = useState(false)
  const [historyTab, setHistoryTab] = useState<"manual" | "auto">("manual")
  const [isCheckpointed, setIsCheckpointed] = useState(false)

  const handleCreateCheckpoint = () => {
    createCheckpoint()
    setIsCheckpointed(true)
    setTimeout(() => setIsCheckpointed(false), 1000)
  }

  const filteredHistory = useMemo(() => {
    return [...past, ...future]
      .map((room, index) => ({ room, index }))
      .filter(({ room }) => room.type === historyTab || (historyTab === "manual" && !room.type))
  }, [future, past, historyTab])

  return (
    <div className="fixed bottom-20 left-4 z-50 flex gap-2 items-end">
      {showHistory && filteredHistory.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-72 max-h-80 overflow-hidden z-50 flex flex-col">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
              <History size={14} />
              Checkpoint History
            </h3>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setHistoryTab("manual")}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                  historyTab === "manual" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setHistoryTab("auto")}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                  historyTab === "auto" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Auto
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {filteredHistory
              .map(({ room, index }, displayIndex) => {
                const isFuture = index >= past.length
                const currentIndex = past.length - 1
                const isActive = index === currentIndex

                return (
                  <div
                    key={room.id || index}
                    className={`px-4 py-2 border-b border-gray-50 last:border-0 flex items-center justify-between cursor-pointer transition-colors duration-150 group
                        ${isActive ? "bg-blue-50 text-blue-700" : ""}
                        ${!isActive && isFuture ? "text-gray-400 hover:bg-gray-50" : ""}
                        ${!isActive && !isFuture ? "text-gray-600 hover:bg-gray-50" : ""}`}
                  >
                    <div
                      className="flex-1 flex items-center justify-between"
                      onClick={() => {
                        jumpTo(index)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isActive && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        <span className={`font-medium ${isActive ? "font-bold" : ""}`}>
                          {room.type === "auto" ? "Auto-Save" : `Checkpoint ${displayIndex + 1}`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(room.savedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    {room.type === "manual" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCheckpoint(index)
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete Checkpoint"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })
              .reverse()}

            {filteredHistory.length === 0 && (
              <div className="p-4 text-center text-gray-400 text-xs">No {historyTab} checkpoints found</div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${
          canUndo ? "bg-white text-gray-700 hover:bg-gray-100" : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        title="Undo"
      >
        <Undo size={20} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${
          canRedo ? "bg-white text-gray-700 hover:bg-gray-100" : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        title="Redo"
      >
        <Redo size={20} />
      </button>

      <div className="relative flex gap-2">
        <button
          onClick={handleCreateCheckpoint}
          className={`p-3 rounded-full shadow-lg transition-all duration-500 ${
            isCheckpointed ? "bg-green-500 text-white scale-110 ring-4 ring-green-200" : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
          title="Create Checkpoint"
        >
          <Flag size={20} className={isCheckpointed ? "animate-bounce" : ""} />
        </button>

        {(past.length > 0 || future.length > 0) && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${
              showHistory ? "bg-blue-100 text-blue-600" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
            title="View History"
          >
            <History size={20} />
          </button>
        )}
      </div>
    </div>
  )
}

