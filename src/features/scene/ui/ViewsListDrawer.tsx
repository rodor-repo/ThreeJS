import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Trash2 } from 'lucide-react'
import type { View } from '@/features/cabinets/ViewManager'

type Props = {
  isOpen: boolean
  onClose: () => void
  activeViews: View[]
  onViewClick?: (viewId: string) => void
  onDeleteView?: (viewId: string) => void
}

export const ViewsListDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeViews,
  onViewClick,
  onDeleteView,
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
            className="fixed inset-0 bg-black bg-opacity-30 z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-[70] overflow-y-auto"
            data-views-drawer
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-bold text-gray-800 flex-1">Views</h2>
            </div>

            {/* Content */}
            <div className="p-4">
              {activeViews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No views created yet.</p>
                  <p className="text-sm mt-2">Create views from the cabinet drawer.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeViews.map((view) => (
                    <div
                      key={view.id}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-150 flex items-center gap-3"
                    >
                      <button
                        onClick={() => {
                          onViewClick?.(view.id)
                          onClose()
                        }}
                        className="flex-1 text-left"
                      >
                        <h3 className="font-semibold text-gray-800">{view.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {view.cabinetIds.size} cabinet{view.cabinetIds.size !== 1 ? 's' : ''}
                        </p>
                      </button>
                      {onDeleteView && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteView(view.id)
                          }}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete view"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

