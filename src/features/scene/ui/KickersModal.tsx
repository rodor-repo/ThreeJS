import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { WsProducts } from '@/types/erpTypes'
import _ from 'lodash'

type Props = {
  isOpen: boolean
  onClose: () => void
  wsProducts: WsProducts | null
  onProductSelect?: (productId: string) => void
}

export const KickersModal: React.FC<Props> = ({ isOpen, onClose, wsProducts, onProductSelect }) => {
  const [hoveredProduct, setHoveredProduct] = useState<{ id: string; img: string; name: string } | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const modalRef = React.useRef<HTMLDivElement>(null)

  // Find all kicker products by checking design.type3D === 'kicker'
  const allProducts = React.useMemo(() => {
    if (!wsProducts) return []

    // Get all active products where design.type3D === 'kicker'
    const kickerProducts = Object.entries(wsProducts.products).filter(([, p]) => {
      if (p.status !== 'Active' || p.enabled3D !== true) return false

      const designEntry = wsProducts.designs[p.designId]
      return designEntry?.type3D === 'kicker'
    })

    // Map products with their data
    const productsWithData = kickerProducts.map(([id, p]) => ({
      id,
      name: p.product,
      img: p.indexImageAlt?.[0],
      sortNum: Number(p.sortNum),
    }))

    // Sort by sortNum
    return _.sortBy(productsWithData, ['sortNum']).map(({ id, name, img }) => ({
      id,
      name,
      img,
    }))
  }, [wsProducts])

  if (allProducts.length === 0) {
    return null
  }

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
            className="fixed inset-0 bg-black bg-opacity-50 z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={modalRef} className="bg-white rounded-lg shadow-2xl max-w-[460px] w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Kickers</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors duration-150"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Content - Flat list of all products */}
              <div className="p-3 overflow-y-auto flex-1">
                <div className="rounded-md border border-gray-200 bg-white">
                  {allProducts.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500">No kicker products found</div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {allProducts.map(p => (
                        <li key={p.id}>
                          <button
                            onClick={() => {
                              if (onProductSelect) {
                                onProductSelect(p.id)
                              }
                              onClose()
                            }}
                            onMouseEnter={(e) => {
                              if (p.img && modalRef.current) {
                                const buttonRect = e.currentTarget.getBoundingClientRect()
                                const modalRect = modalRef.current.getBoundingClientRect()

                                const magnifiedWidth = 256 + 16
                                const magnifiedHeight = 256 + 16 + 20

                                const x = modalRect.right - 10 - magnifiedWidth / 2
                                const y = buttonRect.top + buttonRect.height / 2

                                const clampedY = Math.max(
                                  modalRect.top + magnifiedHeight / 2 + 10,
                                  Math.min(y, modalRect.bottom - magnifiedHeight / 2 - 10)
                                )

                                setMousePosition({ x, y: clampedY })
                                setHoveredProduct({ id: p.id, img: p.img, name: p.name })
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredProduct(null)
                            }}
                            onMouseMove={(e) => {
                              if (p.img && hoveredProduct?.id === p.id && modalRef.current) {
                                const buttonRect = e.currentTarget.getBoundingClientRect()
                                const modalRect = modalRef.current.getBoundingClientRect()

                                const magnifiedWidth = 256 + 16
                                const magnifiedHeight = 256 + 16 + 20

                                const x = modalRect.right - 10 - magnifiedWidth / 2
                                const y = buttonRect.top + buttonRect.height / 2

                                const clampedY = Math.max(
                                  modalRect.top + magnifiedHeight / 2 + 10,
                                  Math.min(y, modalRect.bottom - magnifiedHeight / 2 - 10)
                                )

                                setMousePosition({ x, y: clampedY })
                              }
                            }}
                            className="w-full flex items-center gap-2 p-1.5 hover:bg-gray-50 transition-colors text-left relative"
                          >
                            <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                              {p.img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 whitespace-normal break-words leading-snug">{p.name}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Magnified Image Overlay */}
          {hoveredProduct && hoveredProduct.img && modalRef.current && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute z-[102] pointer-events-none"
              style={{
                left: `${mousePosition.x - modalRef.current.getBoundingClientRect().left}px`,
                top: `${mousePosition.y - modalRef.current.getBoundingClientRect().top}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hoveredProduct.img}
                  alt={hoveredProduct.name}
                  className="w-64 h-64 object-contain"
                  style={{ maxWidth: 'none', maxHeight: 'none' }}
                />
                <p className="text-xs font-medium text-gray-800 mt-2 text-center max-w-[256px]">{hoveredProduct.name}</p>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
