/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Save, Loader2 } from "lucide-react"

interface SaveRoomModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (projectName: string) => void
  isLoading?: boolean
  /** Pre-fill project name (for user room mode) */
  initialProjectName?: string
}

export const SaveRoomModal: React.FC<SaveRoomModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialProjectName,
}) => {
  const defaultProjectName = `Kitchen Design - ${new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`

  const [projectName, setProjectName] = useState(defaultProjectName)

  // Reset project name when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectName(initialProjectName || defaultProjectName)
    }
  }, [isOpen, initialProjectName, defaultProjectName])

  const handleConfirm = () => {
    if (projectName.trim()) {
      onConfirm(projectName.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && projectName.trim()) {
      handleConfirm()
    }
    if (e.key === "Escape" && !isLoading) {
      onClose()
    }
  }

  const isFormValid = projectName.trim()

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isLoading ? onClose : undefined}
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
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Save className="text-blue-600" size={24} />
                Save Room Design
              </h2>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Save your room design to continue editing later. You can access
                it from "My Rooms" under your signed-in account.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="My Kitchen Design"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading || !isFormValid}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Room
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
