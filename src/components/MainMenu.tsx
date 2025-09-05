'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronRight } from 'lucide-react'
import type { Category, Subcategory } from './categoriesData'
import { getWsProducts } from '@/server/getWsProducts'
import type { WsProducts } from '@/types/erpTypes'
import _ from 'lodash'

interface MainMenuProps {
  onCategorySelect: (category: Category) => void
  onSubcategorySelect?: (category: Category, subcategory: Subcategory, productId?: string) => void
  selectedCategory?: Category | null
  onMenuStateChange?: (isOpen: boolean) => void
}

const MainMenu: React.FC<MainMenuProps> = ({ onCategorySelect, onSubcategorySelect, selectedCategory, onMenuStateChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [wsData, setWsData] = useState<WsProducts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategoryForSubmenu, setSelectedCategoryForSubmenu] = useState<Category | null>(null)
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Record<string, boolean>>({})
  const [selectedSubcategoryForDesigns, setSelectedSubcategoryForDesigns] = useState<Subcategory | null>(null)
  const [expandedDesigns, setExpandedDesigns] = useState<Record<string, boolean>>({})

  // Fetch actual data from server
  const loadCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getWsProducts()
      setWsData(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories'
      setError(msg)
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const categoryColorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#6B7280']
  const defaultDims = {
    height: { min: 300, max: 2400, default: 720 },
    width: { min: 300, max: 1200, default: 600 },
    depth: { min: 200, max: 800, default: 600 }
  }

  // Map WsProducts data to UI-friendly Category/Subcategory shapes used across app
  const mappedCategories: Category[] = useMemo(() => {
    if (!wsData) return []
    const categoryEntries = _.sortBy(Object.entries(wsData.categories), ([, c]) => Number(c.sortNum))
    return categoryEntries.map(([categoryId, cat], idx) => {
      const subs = _.sortBy(
        Object.entries(wsData.subCategories).filter(([, sc]) => sc.categoryId === categoryId),
        ([, sc]) => Number(sc.sortNum)
      ).map(([subId, sc]) => ({ id: subId, name: sc.subCategory, dimensions: defaultDims }))
      return {
        id: categoryId,
        name: cat.category,
        description: cat.description || '',
        icon: '🗂️',
        color: categoryColorPalette[idx % categoryColorPalette.length],
        subcategories: subs
      }
    })
  }, [wsData])

  // Designs grouped by subCategoryId
  const designsBySubId = useMemo(() => {
    if (!wsData) return {} as Record<string, Array<{ id: string; name: string; img?: string }>>
    const entries = _.sortBy(Object.entries(wsData.designs), ([, d]) => Number(d.sortNum))
    const mapped = entries.map(([id, d]) => ({ id, name: d.design, img: d.indexPhotoAlt?.[0], subId: d.subCategoryId }))
    const grouped = _.groupBy(mapped, 'subId')
    const result: Record<string, Array<{ id: string; name: string; img?: string }>> = {}
    Object.entries(grouped).forEach(([subId, arr]) => {
      result[subId] = arr.map(({ id, name, img }) => ({ id, name, img }))
    })
    return result
  }, [wsData])

  // Products grouped by designId
  const productsByDesignId = useMemo(() => {
    if (!wsData) return {} as Record<string, Array<{ id: string; name: string; img?: string }>>
    const active = Object.entries(wsData.products).filter(([, p]) => p.status === 'Active')
    const sorted = _.sortBy(active, ([, p]) => Number(p.sortNum))
    const mapped = sorted.map(([id, p]) => ({ id, name: p.product, img: p.indexImageAlt?.[0], designId: p.designId }))
    const grouped = _.groupBy(mapped, 'designId')
    const result: Record<string, Array<{ id: string; name: string; img?: string }>> = {}
    Object.entries(grouped).forEach(([designId, arr]) => {
      result[designId] = arr.map(({ id, name, img }) => ({ id, name, img }))
    })
    return result
  }, [wsData])

  const handleCategorySelect = (category: Category) => {
    onCategorySelect(category)
    setSelectedCategoryForSubmenu(category)
    setShowSubmenu(true)
    setSelectedSubcategoryForDesigns(null)
    setExpandedDesigns({})
    onMenuStateChange?.(true)
  }

  const closeSubmenu = () => {
    setShowSubmenu(false)
    setSelectedCategoryForSubmenu(null)
    setSelectedSubcategoryForDesigns(null)
    setExpandedDesigns({})
  }

  const toggleSubcategoryExpand = (subcategoryId: string) => {
    setExpandedSubcategories(prev => ({ ...prev, [subcategoryId]: !prev[subcategoryId] }))
  }

  const openDesignsForSubcategory = (subcategory: Subcategory) => {
    setSelectedSubcategoryForDesigns(subcategory)
    setExpandedDesigns({})
  }

  const toggleDesignExpand = (designId: string) => {
    setExpandedDesigns(prev => ({ ...prev, [designId]: !prev[designId] }))
  }

  // When a product is clicked, we want to add a DEMO 3D object.
  // We leverage existing ThreeScene flows by invoking onSubcategorySelect with a demo base config.
  const handleProductClick = useCallback((category: Category, subcategory: Subcategory, productId: string) => {
    console.log('Product clicked:', { productId, subcategory: subcategory.id, category: category.id })
    // Force DEMO: always add a base cabinet with a standard subcategory
    const demoCategory: Category = {
      id: 'base',
      name: 'Base',
      description: 'Demo base cabinet',
      icon: '📦',
      color: '#3B82F6',
      subcategories: []
    }
    const demoSub: Subcategory = {
      id: 'standard',
      name: 'Standard',
      dimensions: defaultDims
    }
    onSubcategorySelect?.(demoCategory, demoSub, productId)
    // Close menus for responsiveness, like the previous behavior
    setShowSubmenu(false)
    setIsOpen(false)
    onMenuStateChange?.(false)
  }, [onSubcategorySelect])

  const toggleMenu = () => {
    const newState = !isOpen
    setIsOpen(newState)
    // Immediately close submenu when main menu is closed for better responsiveness
    if (!newState) {
      setShowSubmenu(false)
      setSelectedCategoryForSubmenu(null)
      setSelectedSubcategoryForDesigns(null)
      setExpandedDesigns({})
    }
    onMenuStateChange?.(newState)
  }

  return (
    <>
      {/* Hamburger Menu Button */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors duration-150"
        aria-label="Toggle menu"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Menu size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Slide Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => {
                // Immediately close both menus for better responsiveness
                setIsOpen(false)
                setShowSubmenu(false)
                onMenuStateChange?.(false)
              }}
            />

            {/* Main Menu Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.2 }}
              className="fixed left-0 top-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl z-50 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            >
              {/* Header */}
              <div className="p-3 sm:p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">3D Scene Menu</h2>
                <p className="text-gray-600 mt-2">Select a category to get started</p>
              </div>

              {/* Removed demo FetchCategoriesComponent */}

              {/* Categories */}
              <div className="p-2 sm:p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                      onClick={loadCategories}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-150"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mappedCategories.map((category) => (
                      <motion.button
                        key={category.id}
                        onClick={() => handleCategorySelect(category)}
                        className={`w-full p-4 rounded-lg border-2 transition-all duration-150 hover:shadow-md ${selectedCategory?.id === category.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className="text-2xl"
                              style={{ color: category.color }}
                            >
                              {category.icon}
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold text-gray-800">
                                {category.name}
                              </h3>
                              {/* Category description removed per UI note */}
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-400" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-2 sm:p-4 border-t border-gray-200 mt-auto">
                <div className="text-center text-sm text-gray-500">
                  <p>3D Scene Builder</p>
                  <p className="mt-1">Select a category to begin</p>
                </div>
              </div>
            </motion.div>

            {/* Submenu Panel */}
            <AnimatePresence>
              {showSubmenu && selectedCategoryForSubmenu && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '320px' }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0 }}
                  className="fixed left-0 top-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl z-50 overflow-y-auto overflow-x-hidden border-l border-gray-200 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                >
                  {/* Submenu Header */}
                  <div className="p-3 sm:p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={closeSubmenu}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-150"
                      >
                        <ChevronRight size={20} className="text-gray-600 rotate-180" />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">{selectedCategoryForSubmenu.name}</h2>
                        {/* Category description removed per UI note */}
                      </div>
                    </div>
                  </div>

                  {/* Subcategories */}
                  <div className="p-2 sm:p-4">
                    <div className="space-y-3">
                      {selectedCategoryForSubmenu.subcategories.map((subcategory) => (
                        <motion.button
                          key={subcategory.id}
                          onClick={() => openDesignsForSubcategory(subcategory)}
                          className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-150 hover:shadow-md hover:bg-gray-50"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-800">{subcategory.name}</h3>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Designs Panel */}
            <AnimatePresence>
              {showSubmenu && selectedCategoryForSubmenu && selectedSubcategoryForDesigns && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '640px' }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0 }}
                  className="fixed left-0 top-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl z-50 overflow-y-auto overflow-x-hidden border-l border-gray-200 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                >
                  {/* Designs Header */}
                  <div className="p-3 sm:p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setSelectedSubcategoryForDesigns(null)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-150"
                      >
                        <ChevronRight size={20} className="text-gray-600 rotate-180" />
                      </button>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">{selectedSubcategoryForDesigns.name}</h2>
                        <p className="text-gray-600 text-sm">Designs</p>
                      </div>
                    </div>
                  </div>

                  {/* Designs and products */}
                  <div className="p-2 sm:p-4">
                    <div className="space-y-3">
                      {(designsBySubId[selectedSubcategoryForDesigns.id] || []).map((design) => {
                        const isExpanded = !!expandedDesigns[design.id]
                        const products = productsByDesignId[design.id] || []
                        return (
                          <div key={design.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleDesignExpand(design.id)}
                              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-150"
                            >
                              <span className="font-semibold text-gray-800">{design.name}</span>
                              <ChevronRight size={18} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 220, opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="px-2 pb-2"
                                >
                                  <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 bg-white">
                                    {products.length === 0 ? (
                                      <div className="p-3 text-sm text-gray-500">No products found</div>
                                    ) : (
                                      <ul className="divide-y divide-gray-100">
                                        {products.map(p => (
                                          <li key={p.id}>
                                            <button
                                              onClick={() => handleProductClick(selectedCategoryForSubmenu, selectedSubcategoryForDesigns, p.id)}
                                              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 transition-colors text-left"
                                            >
                                              <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                                                {p.img ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 whitespace-normal break-words leading-snug">{p.name}</p>
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
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default MainMenu
