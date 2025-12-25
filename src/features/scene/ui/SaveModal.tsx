import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, AlertCircle } from 'lucide-react'

interface SaveModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  /** The current room name from wsRooms (may be undefined if no room selected) */
  currentRoomName?: string | null
  /** Whether save operation is in progress */
  isSaving?: boolean
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentRoomName,
  isSaving = false
}) => {
  const hasRoom = !!currentRoomName

  const handleSave = () => {
    if (!hasRoom) {
      return
    }
    onSave()
    // Note: onClose is called after save completes, handled by parent
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-lg shadow-xl z-[101] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Save Room</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isSaving}
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {hasRoom ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center">
                    <Save size={48} className="text-blue-600" />
                  </div>
                  <p className="text-gray-700 text-lg">
                    Save changes to <strong>{currentRoomName}</strong>?
                  </p>
                  <p className="text-gray-500 text-sm">
                    Your current design will be saved and can be loaded again later.
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center">
                    <AlertCircle size={48} className="text-amber-500" />
                  </div>
                  <p className="text-gray-700 text-lg font-medium">
                    No room selected
                  </p>
                  <p className="text-gray-500 text-sm">
                    Please select a room from the menu before saving. Room entries are created in the control panel.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasRoom || isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
