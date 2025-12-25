import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingCart, RefreshCw } from 'lucide-react'

interface AddToCartModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (projectName: string, userEmail: string) => void
  itemCount: number
  skippedCount: number
  isLoading?: boolean
  /** Pre-fill email (for user room mode) */
  initialEmail?: string
  /** Pre-fill project name (for user room mode) */
  initialProjectName?: string
  /** Whether updating an existing project */
  isUserRoomMode?: boolean
}

export const AddToCartModal: React.FC<AddToCartModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  skippedCount,
  isLoading = false,
  initialEmail,
  initialProjectName,
  isUserRoomMode = false,
}) => {
  const defaultProjectName = `Kitchen Design - ${new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`

  const [projectName, setProjectName] = useState(defaultProjectName)
  const [userEmail, setUserEmail] = useState('')
  const hasInitialized = useRef(false)

  // Load email from initialEmail prop or localStorage on mount
  useEffect(() => {
    if (initialEmail) {
      setUserEmail(initialEmail)
    } else {
      const savedEmail = localStorage.getItem('userEmail')
      if (savedEmail) {
        setUserEmail(savedEmail)
      }
    }
  }, [initialEmail])

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
    if (projectName.trim() && userEmail.trim()) {
      localStorage.setItem('userEmail', userEmail.trim())
      onConfirm(projectName.trim(), userEmail.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && projectName.trim() && userEmail.trim()) {
      handleConfirm()
    }
    if (e.key === 'Escape' && !isLoading) {
      onClose()
    }
  }

  const isConfirmDisabled = isLoading || !projectName.trim() || !userEmail.trim() || !userEmail.includes('@')

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
                <ShoppingCart className="text-green-600" size={24} />
                Add to Cart
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
                {isUserRoomMode && (
                  <p className="text-blue-600 text-sm mt-2 flex items-center justify-center gap-1">
                    <RefreshCw size={14} />
                    Updating existing project
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700">
                    Your Email
                  </label>
                  <input
                    id="userEmail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter your email..."
                    autoFocus={!userEmail}
                  />
                  <p className="text-xs text-gray-500">
                    The email associated with your webshop account.
                  </p>
                </div>

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter project name..."
                    autoFocus={!!userEmail}
                  />
                </div>
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
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  'Add to Cart'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
