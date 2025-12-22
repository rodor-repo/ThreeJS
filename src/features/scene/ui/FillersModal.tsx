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

export const FillersModal: React.FC<Props> = ({ isOpen, onClose, wsProducts, onProductSelect }) => {
  const [hoveredProduct, setHoveredProduct] = useState<{ id: string; img: string; name: string } | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const modalRef = React.useRef<HTMLDivElement>(null)
  // Find Fillers category and get all products
  const allProducts = React.useMemo(() => {
    if (!wsProducts) return []

    // Find category that contains "Filler" in its name
    const fillersCategory = Object.entries(wsProducts.categories).find(([, cat]) =>
      cat.category.toLowerCase().includes('filler') || cat.category.toLowerCase().includes('panel')
    )

    if (!fillersCategory) return []

    const [categoryId] = fillersCategory

    // Get all subcategories for this category with their names
    const subcategories = Object.entries(wsProducts.subCategories)
      .filter(([, sc]) => sc.categoryId === categoryId)
      .map(([subId, sc]) => ({ id: subId, name: sc.subCategory }))

    // Create a map of designId to subcategory name for quick lookup
    const designToSubcategory = new Map<string, string>()
    Object.entries(wsProducts.designs).forEach(([designId, design]) => {
      const subcategory = subcategories.find(sc => sc.id === design.subCategoryId)
      if (subcategory) {
        designToSubcategory.set(designId, subcategory.name.toLowerCase())
      }
    })

    // Get all active products for these designs
    const active = Object.entries(wsProducts.products).filter(
      ([, p]) => p.status === 'Active' && p.enabled3D === true && designToSubcategory.has(p.designId)
    )
    
    // Map products with their type (panel or filler)
    const productsWithType = active.map(([id, p]) => {
      const subcategoryName = designToSubcategory.get(p.designId) || ''
      const isPanel = subcategoryName.includes('panel') && !subcategoryName.includes('filler')
      const isFiller = subcategoryName.includes('filler') || (!isPanel && !subcategoryName.includes('panel'))
      
      return {
        id,
        name: p.product,
        img: p.indexImageAlt?.[0],
        sortNum: Number(p.sortNum),
        type: isPanel ? 'panel' : 'filler', // 'panel' or 'filler'
      }
    })
    
    // Sort: Panels first (type='panel'), then Fillers (type='filler')
    // Within each group, sort by sortNum
    const sorted = _.sortBy(productsWithType, [
      (p) => p.type === 'panel' ? 0 : 1, // Panels first (0), Fillers second (1)
      (p) => p.sortNum // Then by sortNum within each group
    ])
    
    return sorted.map(({ id, name, img }) => ({
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
                  <h2 className="text-xl font-bold text-gray-800">Fillers | Panels</h2>
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
                    <div className="p-2 text-xs text-gray-500">No products found</div>
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
                                
                                // Magnified image dimensions
                                const magnifiedWidth = 256 + 16 // image width + padding
                                const magnifiedHeight = 256 + 16 + 20 // image height + padding + text height
                                
                                // Position so right edge of magnified image is 10px from right edge of modal
                                // Since we use translate(-50%, -50%), the x position is the center
                                // So: x = modalRect.right - 10 - magnifiedWidth / 2
                                const x = modalRect.right - 10 - magnifiedWidth / 2
                                
                                // Center vertically aligned with the product item
                                const y = buttonRect.top + buttonRect.height / 2
                                
                                // Ensure it stays within modal bounds vertically
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
                                
                                // Magnified image dimensions
                                const magnifiedWidth = 256 + 16 // image width + padding
                                const magnifiedHeight = 256 + 16 + 20 // image height + padding + text height
                                
                                // Position so right edge of magnified image is 10px from right edge of modal
                                // Since we use translate(-50%, -50%), the x position is the center
                                // So: x = modalRect.right - 10 - magnifiedWidth / 2
                                const x = modalRect.right - 10 - magnifiedWidth / 2
                                
                                // Center vertically aligned with the product item
                                const y = buttonRect.top + buttonRect.height / 2
                                
                                // Ensure it stays within modal bounds vertically
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

          {/* Magnified Image Overlay - Positioned relative to modal */}
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
                transform: 'translate(-50%, -50%)', // Center both horizontally and vertically
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

