import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  Loader2,
  Package,
  Box,
  Maximize2,
  Layout,
  Info,
  ShoppingCart,
  AlertCircle
} from 'lucide-react'
import type { CabinetData } from '../types'
import type { WsProducts } from '@/types/erpTypes'
import { cabinetPanelState } from '@/features/cabinets/ui/productPanel/hooks/usePersistence'
import _ from 'lodash'

type Props = {
  isOpen: boolean
  onClose: () => void
  cabinets: CabinetData[]
  wsProducts?: WsProducts | null
  /** Total price from the scene calculation */
  totalPrice?: number
  /** Map of cabinet IDs to their calculated prices */
  cabinetPrices?: Map<string, number>
  /** Map of cabinet IDs to their loading states */
  isCabinetCalculating?: Map<string, boolean>
  /** Map of cabinet IDs to their error states */
  cabinetErrors?: Map<string, boolean>
}

export const ProductsListDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  cabinets,
  wsProducts,
  totalPrice = 0,
  cabinetPrices,
  isCabinetCalculating,
  cabinetErrors,
}) => {
  const [topPosition, setTopPosition] = useState(88) // Default fallback position

  // Handle drawer positioning logic 
  useEffect(() => {
    const updatePosition = () => {
      const header = document.querySelector('header')
      if (header) {
        setTopPosition(header.offsetHeight)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [])

  const getProductName = (cabinet: CabinetData): string => {
    if (cabinet.productId && wsProducts?.products[cabinet.productId]) {
      return wsProducts.products[cabinet.productId].product
    }

    // Fallback names based on cabinet type
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

    return typeMap[cabinet.cabinetType] || _.startCase(cabinet.productId)
  }

  const getCabinetIcon = (type: string) => {
    switch (type) {
      case 'base': return <Layout size={14} className="text-blue-500" />
      case 'top': return <Maximize2 size={14} className="text-purple-500" />
      case 'tall': return <Box size={14} className="text-orange-500" />
      default: return <Package size={14} className="text-gray-400" />
    }
  }

  // Get cabinet price
  const getCabinetPrice = (cabinet: CabinetData): number | undefined => {
    return cabinetPrices?.get(cabinet.cabinetId) ?? cabinetPanelState.get(cabinet.cabinetId)?.price?.amount
  }

    // Sort cabinets by sortNumber
    const sortedCabinets = [...cabinets]
      .filter(c => c.sortNumber !== undefined)
      .sort((a, b) => (a.sortNumber || 0) - (b.sortNumber || 0))
  
    return (    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              top: `${topPosition + 8}px`,
              right: '16px',
              maxHeight: `calc(100vh - ${topPosition + 32}px)`
            }}
            className="fixed w-[420px] bg-white/95 backdrop-blur-xl shadow-2xl z-[70] overflow-hidden flex flex-col rounded-2xl border border-white/20"
            data-products-drawer
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500 p-2 rounded-xl text-white shadow-lg shadow-yellow-500/20">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">Room Inventory</h2>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    {sortedCabinets.length} Items Configured
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200/50 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <ChevronUp size={22} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              {sortedCabinets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Package size={48} strokeWidth={1} className="mb-3 opacity-20" />
                  <p className="text-sm">Your design is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedCabinets.map((cabinet) => {
                    const price = getCabinetPrice(cabinet)
                    const isLoading = isCabinetCalculating?.get(cabinet.cabinetId)
                    const isError = cabinetErrors?.get(cabinet.cabinetId)
                    const isAppliance = cabinet.productId?.startsWith('appliance-')
                    const dims = cabinet.carcass.dimensions

                    return (
                      <motion.div
                        layout
                        key={cabinet.cabinetId}
                        whileHover={{ y: -2, scale: 1.01 }}
                        className="group relative flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-yellow-200 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          {/* Sort Number Badge */}
                          <div className="relative">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 group-hover:bg-yellow-50 group-hover:border-yellow-100 transition-colors">
                              <span className="text-sm font-bold text-gray-700 group-hover:text-yellow-700">
                                {cabinet.sortNumber}
                              </span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate pr-2">
                              {getProductName(cabinet)}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 rounded text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                {getCabinetIcon(cabinet.cabinetType)}
                                {cabinet.cabinetType}
                              </div>
                              <span className="text-[11px] text-gray-400 font-medium">
                                {Math.round(dims.width)}w × {Math.round(dims.height)}h × {Math.round(dims.depth)}d
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {isLoading ? (
                            <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-lg">
                              <Loader2 size={12} className="animate-spin text-blue-500" />
                              <span className="text-[10px] font-bold text-blue-600 uppercase">Updating</span>
                            </div>
                          ) : isError ? (
                            <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                              <AlertCircle size={12} />
                              <span className="text-[10px] font-bold uppercase">Error</span>
                            </div>
                          ) : isAppliance ? (
                            <div className="text-sm font-bold text-gray-300 italic">
                              $0.00
                            </div>
                          ) : price !== undefined ? (
                            <div className="text-base font-bold text-gray-900 tabular-nums tracking-tight">
                              ${price.toFixed(2)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-300">N/A</div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-6 bg-gray-900 text-white rounded-t-3xl shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <Info size={14} />
                  <span className="text-xs font-medium">Pricing inclusive of GST</span>
                </div>
                <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest">
                  Estimate Total
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-black tabular-nums tracking-tighter">
                    ${totalPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">
                    Based on current specifications
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* Optional action buttons could go here */}
                  <div className="bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    {sortedCabinets.length} Components
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


