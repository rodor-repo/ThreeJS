'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronRight, Trash2 } from 'lucide-react'
import type { Category, Subcategory } from './categoriesData'
import { getWsProducts } from '@/server/getWsProducts'
import type { WsProducts } from '@/types/erpTypes'
import { getSavedRoomsByCategory, deleteSavedRoom, type RoomCategory, type SavedRoom } from '@/data/savedRooms'
import _ from 'lodash'
import { getClient } from '@/app/QueryProvider'
import { getProductData } from '@/server/getProductData'
import toast from 'react-hot-toast'

interface MainMenuProps {
  onCategorySelect: (category: Category) => void
  onSubcategorySelect?: (category: Category, subcategory: Subcategory, productId?: string) => void
  selectedCategory?: Category | null
  onMenuStateChange?: (isOpen: boolean) => void
  wsProducts: WsProducts | null
  setWsProducts: React.Dispatch<React.SetStateAction<WsProducts | null>>
  onLoadRoom?: (savedRoom: import('@/data/savedRooms').SavedRoom) => Promise<void>
}

const MainMenu: React.FC<MainMenuProps> = ({ onCategorySelect: _onCategorySelect, onSubcategorySelect, selectedCategory: _selectedCategory, onMenuStateChange, wsProducts, setWsProducts, onLoadRoom }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTopLevelMenu, setSelectedTopLevelMenu] = useState<'cabinets' | 'appliances' | 'rooms' | null>(null) // New state for top-level menu
  const [selectedRoom, setSelectedRoom] = useState<RoomCategory | null>(null) // New state for selected room
  const [selectedCategoryForSubmenu, setSelectedCategoryForSubmenu] = useState<Category | null>(null)
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]) // State for saved rooms
  const [loadingRooms, setLoadingRooms] = useState(false) // Loading state for rooms
  const [selectedSubcategoryForDesigns, setSelectedSubcategoryForDesigns] = useState<Subcategory | null>(null)
  const [expandedDesigns, setExpandedDesigns] = useState<Record<string, boolean>>({})

  // Fetch actual data from server
  const loadCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getWsProducts()
      setWsProducts(data)
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
    if (!wsProducts) return []
    const categoryEntries = _.sortBy(Object.entries(wsProducts.categories), ([, c]) => Number(c.sortNum))
    return categoryEntries.map(([categoryId, cat], idx) => {
      const subs = _.sortBy(
        Object.entries(wsProducts.subCategories).filter(([, sc]) => sc.categoryId === categoryId),
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
  }, [wsProducts])

  // Designs grouped by subCategoryId
  const designsBySubId = useMemo(() => {
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
  const productsByDesignId = useMemo(() => {
    if (!wsProducts) return {} as Record<string, Array<{ id: string; name: string; img?: string }>>
    // const active = Object.entries(wsProducts.products).filter(([, p]) => p.status === 'Active' && !p.disabled3D)
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
  const designsWithProducts = useMemo(() => {
    const set = new Set<string>()
    Object.keys(productsByDesignId).forEach(designId => {
      if (productsByDesignId[designId].length > 0) {
        set.add(designId)
      }
    })
    return set
  }, [productsByDesignId])

  // Calculate which subcategories have active designs
  const subcategoriesWithProducts = useMemo(() => {
    const set = new Set<string>()
    Object.entries(designsBySubId).forEach(([subId, designs]) => {
      if (designs.some(design => designsWithProducts.has(design.id))) {
        set.add(subId)
      }
    })
    return set
  }, [designsBySubId, designsWithProducts])

  // Calculate which categories have active subcategories
  const categoriesWithProducts = useMemo(() => {
    const set = new Set<string>()
    mappedCategories.forEach(category => {
      if (category.subcategories.some(sub => subcategoriesWithProducts.has(sub.id))) {
        set.add(category.id)
      }
    })
    return set
  }, [mappedCategories, subcategoriesWithProducts])

  const openDesignsForSubcategory = (category: Category, subcategory: Subcategory) => {
    setSelectedCategoryForSubmenu(category)
    setSelectedSubcategoryForDesigns(subcategory)
    setShowSubmenu(true)
    setExpandedDesigns({})
  }

  const toggleDesignExpand = (designId: string) => {
    setExpandedDesigns(prev => ({ ...prev, [designId]: !prev[designId] }))
  }

  // When a product is clicked, we want to add a DEMO 3D object.
  // We leverage existing ThreeScene flows by invoking onSubcategorySelect with a demo base config.
  const handleProductClick = useCallback(async (category: Category, subcategory: Subcategory, productId: string) => {
    console.log('Product clicked:', { productId, subcategory: subcategory.id, category: category.id })

    // Close menus immediately for better responsiveness
    setShowSubmenu(false)
    setIsOpen(false)
    onMenuStateChange?.(false)

    // Prefetch product data before adding cabinet
    const queryClient = getClient()
    const cached = queryClient.getQueryData(["productData", productId])

    if (!cached) {
      const toastId = toast.loading("Loading product...")
      try {
        const data = await getProductData(productId)
        queryClient.setQueryData(["productData", productId], data)
        toast.success("Product loaded", { id: toastId })
      } catch (error) {
        console.error("Failed to prefetch product:", error)
        toast.error("Failed to load product", { id: toastId })
        return // Don't add cabinet if prefetch failed
      }
    }

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

    const designId = wsProducts?.products[productId]?.designId
    const designFeatures = wsProducts?.designs[designId ?? ""]?.features3D

    if (designFeatures?.includes("drawer")) {
      demoSub.id = 'drawer'
      demoSub.name = 'Drawer'
    }

    onSubcategorySelect?.(demoCategory, demoSub, productId)
  }, [onSubcategorySelect])

  const toggleMenu = () => {
    const newState = !isOpen
    setIsOpen(newState)
    // Immediately close submenu when main menu is closed for better responsiveness
    if (!newState) {
      setSelectedTopLevelMenu(null) // Reset top-level menu selection
      setSelectedRoom(null)
      setShowSubmenu(false)
      setSelectedCategoryForSubmenu(null)
      setSelectedSubcategoryForDesigns(null)
      setExpandedDesigns({})
    }
    onMenuStateChange?.(newState)
  }

  const handleTopLevelMenuClick = (menu: 'cabinets' | 'appliances' | 'rooms') => {
    setSelectedTopLevelMenu(menu)
    if (menu === 'cabinets') {
      // Show categories menu (existing behavior)
      // The categories will be shown in the main panel
    } else if (menu === 'appliances') {
      // Appliances menu - placeholder for future implementation
    } else if (menu === 'rooms') {
      // Rooms menu - will show room subcategories
      setSelectedRoom(null)
    }
  }

  const handleBackToTopLevel = () => {
    setSelectedTopLevelMenu(null)
    setSelectedRoom(null)
    setShowSubmenu(false)
    setSelectedCategoryForSubmenu(null)
    setSelectedSubcategoryForDesigns(null)
    setExpandedDesigns({})
  }

  const handleRoomClick = (room: RoomCategory) => {
    setSelectedRoom(room)
  }

  // Handle room deletion
  const handleDeleteRoom = useCallback(async (room: SavedRoom, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the load room action

    // Show confirmation alert
    const confirmed = window.confirm(`Are you sure you want to delete "${room.name}"? This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    try {
      // Delete from local folder
      const deleted = await deleteSavedRoom(room.id)

      if (deleted) {
        // TODO: Delete from Firebase database in future stage
        // await deleteRoomFromFirebase(room.id)

        // Refresh the saved rooms list
        if (selectedRoom) {
          const rooms = await getSavedRoomsByCategory(selectedRoom)
          setSavedRooms(rooms)
        }

        alert(`Room "${room.name}" has been deleted successfully.`)
      } else {
        alert(`Failed to delete room "${room.name}". Please try again.`)
      }
    } catch (error) {
      console.error('Failed to delete room:', error)
      alert(`Failed to delete room "${room.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [selectedRoom])

  // Load saved rooms for the selected room category (async)
  useEffect(() => {
    const loadRooms = async () => {
      if (!selectedRoom) {
        setSavedRooms([])
        return
      }

      setLoadingRooms(true)
      try {
        const rooms = await getSavedRoomsByCategory(selectedRoom)
        setSavedRooms(rooms)
      } catch (error) {
        console.error('Failed to load saved rooms:', error)
        setSavedRooms([])
      } finally {
        setLoadingRooms(false)
      }
    }

    loadRooms()
  }, [selectedRoom])

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
                // Immediately close all menus for better responsiveness
                setIsOpen(false)
                setSelectedTopLevelMenu(null)
                setSelectedRoom(null)
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
                {selectedTopLevelMenu ? (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleBackToTopLevel}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-150"
                    >
                      <ChevronRight size={20} className="text-gray-600 rotate-180" />
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        {selectedTopLevelMenu === 'cabinets' ? 'Cabinets' : selectedTopLevelMenu === 'appliances' ? 'Appliances' : selectedRoom || 'Rooms'}
                      </h2>
                      <p className="text-gray-600 mt-2">
                        {selectedTopLevelMenu === 'cabinets' ? 'Select a subcategory' : selectedTopLevelMenu === 'appliances' ? 'Select an appliance' : selectedRoom ? '' : 'Select a room type'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-800">3D Scene Menu</h2>
                    <p className="text-gray-600 mt-2">Select an option to get started</p>
                  </>
                )}
              </div>

              {/* Top-Level Menu Items (Cabinets / Rooms) */}
              {!selectedTopLevelMenu && (
                <div className="p-2 sm:p-4">
                  <div className="space-y-3">
                    <motion.button
                      onClick={() => handleTopLevelMenuClick('cabinets')}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-150"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-800">Cabinets</h3>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => handleTopLevelMenuClick('appliances')}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-150"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-800">Appliances</h3>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => handleTopLevelMenuClick('rooms')}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-150"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-800">Rooms</h3>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Subcategories grouped by Category (shown when Cabinets is selected) */}
              {selectedTopLevelMenu === 'cabinets' && (
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
                    <div className="space-y-4">
                      {mappedCategories
                        .filter((category) => categoriesWithProducts.has(category.id))
                        .map((category) => {
                          const filteredSubs = category.subcategories.filter((sub) => subcategoriesWithProducts.has(sub.id))
                          if (filteredSubs.length === 0) return null
                          return (
                            <div key={category.id}>
                              {/* Category header - subtle */}
                              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">
                                {category.name}
                              </h4>
                              {/* Subcategories */}
                              <div className="space-y-2">
                                {filteredSubs.map((subcategory) => (
                                  <motion.button
                                    key={subcategory.id}
                                    onClick={() => openDesignsForSubcategory(category, subcategory)}
                                    className="w-full p-3 rounded-lg border-2 transition-all duration-150 border-gray-200 hover:border-gray-300 hover:shadow-md hover:bg-gray-50"
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <h3 className="font-semibold text-gray-800 text-left">
                                        {subcategory.name}
                                      </h3>
                                      <ChevronRight size={18} className="text-gray-400" />
                                    </div>
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Rooms Subcategories (shown when Rooms is selected) */}
              {selectedTopLevelMenu === 'rooms' && !selectedRoom && (
                <div className="p-2 sm:p-4">
                  <div className="space-y-3">
                    {(['Kitchen', 'Pantry', 'Laundry', 'Wardrobe', 'Vanity', 'TV Room', 'Alfresco'] as RoomCategory[]).map((room) => (
                      <motion.button
                        key={room}
                        onClick={() => handleRoomClick(room)}
                        className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-150"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-800">{room}</h3>
                          </div>
                          <ChevronRight size={20} className="text-gray-400" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved Rooms List (shown when a specific room category is selected) */}
              {selectedTopLevelMenu === 'rooms' && selectedRoom && (
                <div className="p-2 sm:p-4">
                  {loadingRooms ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 text-lg font-medium">{selectedRoom}</p>
                      <p className="text-gray-500 text-sm mt-2">Loading rooms...</p>
                    </div>
                  ) : savedRooms.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 text-lg font-medium">{selectedRoom}</p>
                      <p className="text-gray-500 text-sm mt-2">No saved rooms yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Saved {selectedRoom} Rooms</h3>
                      {savedRooms.map((room) => (
                        <motion.div
                          key={room.id}
                          className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-150"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-center justify-between">
                            <div
                              onClick={async () => {
                                if (onLoadRoom) {
                                  await onLoadRoom(room)
                                  // Close menu after loading
                                  setIsOpen(false)
                                  setSelectedTopLevelMenu(null)
                                  setSelectedRoom(null)
                                  onMenuStateChange?.(false)
                                }
                              }}
                              className="flex-1 cursor-pointer"
                            >
                              <h4 className="font-semibold text-gray-800">{room.name}</h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {room.cabinets.length} cabinet{room.cabinets.length !== 1 ? 's' : ''} • Saved {new Date(room.savedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDeleteRoom(room, e)}
                              className="ml-4 p-2 rounded-lg hover:bg-red-50 transition-colors duration-150 flex items-center justify-center"
                              title="Delete room"
                            >
                              <Trash2 size={20} className="text-red-500 hover:text-red-600" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Appliances Subcategories (placeholder for future implementation) */}
              {selectedTopLevelMenu === 'appliances' && (
                <div className="p-2 sm:p-4">
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">Appliances coming soon</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              {!selectedTopLevelMenu && (
                <div className="p-2 sm:p-4 border-t border-gray-200 mt-auto">
                  <div className="text-center text-sm text-gray-500">
                    <p>3D Scene Builder</p>
                    <p className="mt-1">Select an option to begin</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Designs Panel */}
            <AnimatePresence>
              {showSubmenu && selectedSubcategoryForDesigns && selectedCategoryForSubmenu && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '320px' }}
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
                      {(designsBySubId[selectedSubcategoryForDesigns.id] || [])
                        .filter((design) => designsWithProducts.has(design.id))
                        .map((design) => {
                          const isExpanded = !!expandedDesigns[design.id]
                          const products = productsByDesignId[design.id] || []
                          return (
                            <div key={design.id} className="border-2 rounded-lg overflow-hidden border-gray-200">
                              <button
                                onClick={() => toggleDesignExpand(design.id)}
                                className="w-full p-4 flex items-center justify-between transition-colors duration-150 hover:bg-gray-50 cursor-pointer"
                              >
                                <span className="font-semibold text-gray-800">{design.name}</span>
                                <ChevronRight size={18} className={`transition-transform ${isExpanded ? 'rotate-90' : ''} text-gray-500`} />
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
