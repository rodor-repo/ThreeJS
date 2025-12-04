import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'
import type { WsProducts } from '@/types/erpTypes'
import _ from 'lodash'

type Props = {
  isOpen: boolean
  onClose: () => void
  wsProducts: WsProducts | null
  onProductSelect?: (productId: string) => void
}

export const FillersModal: React.FC<Props> = ({ isOpen, onClose, wsProducts, onProductSelect }) => {
  const [expandedDesigns, setExpandedDesigns] = useState<Record<string, boolean>>({})

  // Find Fillers category and its subcategories
  const fillersData = React.useMemo(() => {
    if (!wsProducts) return null

    // Find category that contains "Filler" in its name
    const fillersCategory = Object.entries(wsProducts.categories).find(([, cat]) =>
      cat.category.toLowerCase().includes('filler') || cat.category.toLowerCase().includes('panel')
    )

    if (!fillersCategory) return null

    const [categoryId, category] = fillersCategory

    // Get subcategories for this category
    const subcategories = _.sortBy(
      Object.entries(wsProducts.subCategories).filter(([, sc]) => sc.categoryId === categoryId),
      ([, sc]) => Number(sc.sortNum)
    ).map(([subId, sc]) => ({
      id: subId,
      name: sc.subCategory,
    }))

    return {
      categoryName: category.category,
      subcategories,
      categoryId,
    }
  }, [wsProducts])

  // Designs grouped by subCategoryId
  const designsBySubId = React.useMemo(() => {
    if (!wsProducts) return {} as Record<string, Array<{ id: string; name: string; img?: string }>>
    const entries = _.sortBy(Object.entries(wsProducts.designs), ([, d]) => Number(d.sortNum))
    const mapped = entries.map(([id, d]) => ({ id, name: d.design, img: d.indexPhotoAlt?.[0], subId: d.subCategoryId }))
    const grouped = _.groupBy(mapped, 'subId')
    const result: Record<string, Array<{ id: string; name: string; img?: string }>> = {}
    Object.entries(grouped).forEach(([subId, arr]) => {
      result[subId] = arr.map(({ id, name, img }) => ({ id, name, img }))
    })
    return result
  }, [wsProducts])

  // Products grouped by designId
  const productsByDesignId = React.useMemo(() => {
    if (!wsProducts) return {} as Record<string, Array<{ id: string; name: string; img?: string }>>
    const active = Object.entries(wsProducts.products).filter(([, p]) => p.status === 'Active' && p.enabled3D === true)
    const sorted = _.sortBy(active, ([, p]) => Number(p.sortNum))
    const mapped = sorted.map(([id, p]) => ({ id, name: p.product, img: p.indexImageAlt?.[0], designId: p.designId }))
    const grouped = _.groupBy(mapped, 'designId')
    const result: Record<string, Array<{ id: string; name: string; img?: string }>> = {}
    Object.entries(grouped).forEach(([designId, arr]) => {
      result[designId] = arr.map(({ id, name, img }) => ({ id, name, img }))
    })
    return result
  }, [wsProducts])

  // Calculate which designs have active products
  const designsWithProducts = React.useMemo(() => {
    const set = new Set<string>()
    Object.keys(productsByDesignId).forEach(designId => {
      if (productsByDesignId[designId].length > 0) {
        set.add(designId)
      }
    })
    return set
  }, [productsByDesignId])

  const toggleDesignExpand = (designId: string) => {
    setExpandedDesigns(prev => ({ ...prev, [designId]: !prev[designId] }))
  }

  if (!fillersData || fillersData.subcategories.length === 0) {
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
            <div className="bg-white rounded-lg shadow-2xl max-w-[460px] w-full max-h-[80vh] overflow-hidden flex flex-col">
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

              {/* Content */}
              <div className="p-3 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {fillersData.subcategories.map((subcategory) => {
                    const designs = designsBySubId[subcategory.id] || []
                    const filteredDesigns = designs.filter((design) => designsWithProducts.has(design.id))
                    
                    if (filteredDesigns.length === 0) return null

                    return (
                      <div key={subcategory.id}>
                        <div className="space-y-2">
                          {filteredDesigns.map((design) => {
                            const isExpanded = !!expandedDesigns[design.id]
                            const products = productsByDesignId[design.id] || []
                            return (
                              <div key={design.id} className="border-2 rounded-lg overflow-hidden border-gray-200">
                                <button
                                  onClick={() => toggleDesignExpand(design.id)}
                                  className="w-full p-2.5 flex items-center justify-between transition-colors duration-150 hover:bg-gray-50 cursor-pointer"
                                >
                                  <span className="font-semibold text-gray-800 text-sm">{design.name}</span>
                                  <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''} text-gray-500`} />
                                </button>

                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="px-1.5 pb-1.5"
                                    >
                                      <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 bg-white">
                                        {products.length === 0 ? (
                                          <div className="p-2 text-xs text-gray-500">No products found</div>
                                        ) : (
                                          <ul className="divide-y divide-gray-100">
                                            {products.map(p => (
                                              <li key={p.id}>
                                                <button
                                                  onClick={() => {
                                                    if (onProductSelect) {
                                                      onProductSelect(p.id)
                                                    }
                                                  }}
                                                  className="w-full flex items-center gap-2 p-1.5 hover:bg-gray-50 transition-colors text-left"
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
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

