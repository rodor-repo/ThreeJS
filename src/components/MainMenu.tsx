'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronRight } from 'lucide-react'
import { categoriesData, Category, Subcategory } from './categoriesData'
import FetchCategoriesComponent from './FetchCategoriesComponent'

interface MainMenuProps {
  onCategorySelect: (category: Category) => void
  onSubcategorySelect?: (category: Category, subcategory: Subcategory) => void
  selectedCategory?: Category | null
  onMenuStateChange?: (isOpen: boolean) => void
}

const MainMenu: React.FC<MainMenuProps> = ({ onCategorySelect, onSubcategorySelect, selectedCategory, onMenuStateChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategoryForSubmenu, setSelectedCategoryForSubmenu] = useState<Category | null>(null)
  const [showSubmenu, setShowSubmenu] = useState(false)

  // Load categories from imported data
  const loadCategories = () => {
    try {
      setLoading(true)
      setCategories(categoriesData.categories)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleCategorySelect = (category: Category) => {
    onCategorySelect(category)
    // Immediately show submenu for better responsiveness
    setSelectedCategoryForSubmenu(category)
    setShowSubmenu(true)
    onMenuStateChange?.(true)
  }

  const closeSubmenu = () => {
    setShowSubmenu(false)
    setSelectedCategoryForSubmenu(null)
  }

  const handleSubcategorySelect = (category: Category, subcategory: Subcategory) => {
    onSubcategorySelect?.(category, subcategory)
    // Immediately close both menus for better responsiveness
    setShowSubmenu(false)
    setIsOpen(false)
    onMenuStateChange?.(false)
  }

  const toggleMenu = () => {
    const newState = !isOpen
    setIsOpen(newState)
    // Immediately close submenu when main menu is closed for better responsiveness
    if (!newState) {
      setShowSubmenu(false)
      setSelectedCategoryForSubmenu(null)
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

              {/* Fetch Categories Component */}
              <div className="p-2 sm:p-4 border-b border-gray-200">
                <FetchCategoriesComponent />
              </div>

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
                    {categories.map((category) => (
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
                              <p className="text-sm text-gray-600">
                                {category.description}
                              </p>
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
                        <h2 className="text-xl font-bold text-gray-800">
                          {selectedCategoryForSubmenu.name}
                        </h2>
                        <p className="text-gray-600 text-sm">
                          {selectedCategoryForSubmenu.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Subcategories */}
                  <div className="p-2 sm:p-4">
                    <div className="space-y-3">
                      {selectedCategoryForSubmenu.subcategories.map((subcategory) => (
                        <motion.button
                          key={subcategory.id}
                          onClick={() => handleSubcategorySelect(selectedCategoryForSubmenu, subcategory)}
                          className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-150 hover:shadow-md hover:bg-gray-50"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-800">
                              {subcategory.name}
                            </h3>
                          </div>
                        </motion.button>
                      ))}
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
