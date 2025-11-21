import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { View } from '@/features/cabinets/ViewManager'

type Props = {
  isOpen: boolean
  onClose: () => void
  onWallClick: () => void
  onViewClick?: (viewId: string) => void
  activeViews: View[]
}

export const SettingsSidebar: React.FC<Props> = ({
  isOpen,
  onClose,
  onWallClick,
  onViewClick,
  activeViews,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50"
            data-settings-drawer
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Settings</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="p-4 space-y-2">
              {/* Wall Option */}
              <button
                onClick={() => {
                  onWallClick()
                }}
                className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-150 text-left"
              >
                <h3 className="font-semibold text-gray-800">Wall</h3>
              </button>

              {/* View Options - List all active views */}
              {activeViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    onViewClick?.(view.id)
                  }}
                  className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-150 text-left"
                >
                  <h3 className="font-semibold text-gray-800">{view.name}</h3>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
