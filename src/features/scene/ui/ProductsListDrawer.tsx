import React, { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import type { CabinetData } from '../types'
import type { WsProducts } from '@/types/erpTypes'

type Props = {
  isOpen: boolean
  onClose: () => void
  cabinets: CabinetData[]
  wsProducts?: WsProducts | null
}

export const ProductsListDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  cabinets,
  wsProducts,
}) => {
  const [topPosition, setTopPosition] = useState(88) // Default fallback position

  // Calculate position based on price box location
  useEffect(() => {
    if (isOpen) {
      // Find the price box element
      const priceBox = document.querySelector('[data-price-box]') as HTMLElement
      if (priceBox) {
        const rect = priceBox.getBoundingClientRect()
        // Position drawer to start at bottom border of price box
        setTopPosition(rect.bottom)
      }
    }
  }, [isOpen])

  // Get product name helper
  const getProductName = (cabinet: CabinetData): string => {
    if (cabinet.productId && wsProducts?.products[cabinet.productId]) {
      return wsProducts.products[cabinet.productId].product
    }
    
    // Fallback to cabinet type if no product name
    const typeMap: Record<string, string> = {
      base: 'Base Cabinet',
      top: 'Overhead Cabinet',
      tall: 'Tall Cabinet',
      filler: 'Filler',
      panel: 'Panel',
      kicker: 'Kicker',
      bulkhead: 'Bulkhead',
      wardrobe: 'Wardrobe',
    }
    
    return typeMap[cabinet.cabinetType] || 'Cabinet'
  }

  // Sort cabinets by sortNumber
  const sortedCabinets = [...cabinets]
    .filter(c => c.sortNumber !== undefined)
    .sort((a, b) => (a.sortNumber || 0) - (b.sortNumber || 0))

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

          {/* Drawer - Positioned below price box, expands downward */}
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
            style={{ 
              transformOrigin: 'top',
              top: `${topPosition}px`,
              right: '16px',
              maxHeight: `calc(100vh - ${topPosition + 16}px)`
            }}
            className="fixed w-96 bg-white shadow-xl z-[70] overflow-hidden flex flex-col rounded-lg"
            data-products-drawer
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronUp size={24} />
              </button>
              <h2 className="text-xl font-bold text-gray-800 flex-1">Products in Scene</h2>
            </div>

            {/* Content - Scrollable */}
            <div className="p-4 overflow-y-auto flex-1">
              {sortedCabinets.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No products in scene
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedCabinets.map((cabinet) => (
                    <div
                      key={cabinet.cabinetId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-500 text-yellow-700 font-bold text-sm">
                          {cabinet.sortNumber}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-800">
                            {getProductName(cabinet)}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">
                            {cabinet.cabinetType}
                          </div>
                        </div>
                      </div>
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

