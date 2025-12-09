import React from "react"

interface SaveButtonProps {
  onSave: () => void
}

export const SaveButton: React.FC<SaveButtonProps> = ({ onSave }) => {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex gap-3 items-center">
      <button
        onClick={onSave}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
      >
        SAVE
      </button>
    </div>
  )
}

