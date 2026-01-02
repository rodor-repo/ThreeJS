import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingCart, RefreshCw } from 'lucide-react'

interface AddToCartModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (projectName: string) => void
  itemCount: number
  skippedCount: number
  skippedItems?: Array<{ cabinetId: string; reason: string }>
  isLoading?: boolean
  /** Pre-fill project name (for user room mode) */
  initialProjectName?: string
  /** Whether updating an existing project */
  isUserRoomMode?: boolean
  /** Whether the room already has a cart project ID */
  hasProjectId?: boolean
}

export const AddToCartModal: React.FC<AddToCartModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  skippedCount,
  skippedItems = [],
  isLoading = false,
  initialProjectName,
  isUserRoomMode = false,
  hasProjectId = false,
}) => {
  const defaultProjectName = `Kitchen Design - ${new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`

  const [projectName, setProjectName] = useState(defaultProjectName)
  const hasInitialized = useRef(false)

  // Set project name when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use initialProjectName if provided (user room mode), otherwise use default
      if (initialProjectName && !hasInitialized.current) {
        setProjectName(initialProjectName)
        hasInitialized.current = true
      } else if (!initialProjectName) {
        setProjectName(defaultProjectName)
      }
    } else {
      hasInitialized.current = false
    }
  }, [isOpen, initialProjectName, defaultProjectName])

  const handleConfirm = () => {
    const trimmedProjectName = projectName.trim()
    if (trimmedProjectName || hasProjectId) {
      onConfirm(trimmedProjectName)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && (projectName.trim() || hasProjectId)) {
      handleConfirm()
    }
    if (e.key === 'Escape' && !isLoading) {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen && skippedItems.length > 0) {
      console.warn("Skipped cart items:", skippedItems)
    }
  }, [isOpen, skippedItems])

  const isConfirmDisabled = isLoading || (!projectName.trim() && !hasProjectId)
  const cartActionLabel = hasProjectId ? "Update Cart Project" : "Add Project to Cart"
  const cartActionLoadingLabel = hasProjectId ? "Updating..." : "Adding..."
  const accentColor = hasProjectId ? "blue" : "emerald"

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isLoading && onClose()}
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
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className={accentColor === "blue" ? "text-blue-600" : "text-emerald-600"} size={24} />
                {cartActionLabel}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isLoading}
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-gray-700 text-lg">
                  Adding <strong>{itemCount}</strong> item{itemCount !== 1 ? 's' : ''} to cart
                </p>
                {skippedCount > 0 && (
                  <p className="text-amber-600 text-sm mt-1">
                    ({skippedCount} item{skippedCount !== 1 ? 's' : ''} will be skipped - not configured)
                  </p>
                )}
                {skippedItems.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-amber-700">
                      Skipped items
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-amber-700">
                      {skippedItems.map((item, index) => (
                        <li key={`${item.cabinetId}-${index}`} className="flex gap-2">
                          <span className="font-mono text-amber-800">
                            {item.cabinetId.slice(-6)}
                          </span>
                          <span>{item.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isUserRoomMode && hasProjectId && (
                  <p className="text-blue-600 text-sm mt-2 flex items-center justify-center gap-1">
                    <RefreshCw size={14} />
                    Updating an existing cart project
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {hasProjectId ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Project Name</p>
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {projectName || "Untitled Project"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                      Project Name
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      disabled={isLoading}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${
                        accentColor === "blue"
                          ? "focus:ring-blue-500 focus:border-blue-500"
                          : "focus:ring-emerald-500 focus:border-emerald-500"
                      } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                      placeholder="Enter project name..."
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  accentColor === "blue"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {cartActionLoadingLabel}
                  </>
                ) : (
                  cartActionLabel
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
