'use client'

import dynamic from 'next/dynamic'
import { useState, useRef } from 'react'
import MainMenu from '@/components/MainMenu'
import { Category, Subcategory } from '@/components/categoriesData'
import { WsProducts } from '@/types/erpTypes'
import type { SavedRoom } from '@/data/savedRooms'
import type { WallDimensions } from '@/features/scene/types'

// Dynamically import the Three.js component to avoid SSR issues
const ThreeScene = dynamic(() => import('@/features/scene/ThreeScene'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading 3D Scene...</p>
      </div>
    </div>
  )
})

export default function Home() {
  const [wallDimensions, setWallDimensions] = useState<WallDimensions>({
    length: 4000, // Backward compatibility
    height: 2700,
    backWallLength: 4000,
    leftWallLength: 600, // Default: 600mm
    rightWallLength: 600, // Default: 600mm
    leftWallVisible: true,
    rightWallVisible: true,
    additionalWalls: [],
  })

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<{ category: Category; subcategory: Subcategory } | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [wsProducts, setWsProducts] = useState<WsProducts | null>(null)
  const loadRoomRef = useRef<((savedRoom: SavedRoom) => Promise<void>) | null>(null)


  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category)
    setSelectedSubcategory(null)
    console.log('Selected category:', category.name)
    // You can add logic here to handle different categories
  }

  const handleSubcategorySelect = (category: Category, subcategory: Subcategory, productId?: string) => {
    setSelectedCategory(category)
    setSelectedSubcategory({ category, subcategory })
    console.log('Selected subcategory:', subcategory.name, 'from category:', category.name)
    if (productId) console.log('Selected productId:', productId)
    setSelectedProductId(productId)
    // You can add logic here to handle different subcategories
  }

  const handleMenuStateChange = (isOpen: boolean) => {
    setIsMenuOpen(isOpen)
  }

  return (
    <main className="h-screen w-full relative">
      {/* Main Menu */}
      <MainMenu
        onCategorySelect={handleCategorySelect}
        onSubcategorySelect={handleSubcategorySelect}
        selectedCategory={selectedCategory}
        onMenuStateChange={handleMenuStateChange}
        wsProducts={wsProducts}
        setWsProducts={setWsProducts}
        onLoadRoom={async (savedRoom) => {
          if (loadRoomRef.current) {
            await loadRoomRef.current(savedRoom)
          }
        }}
      />

      {/* Three.js Scene */}
      <ThreeScene
        wallDimensions={wallDimensions}
        onDimensionsChange={setWallDimensions}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        selectedProductId={selectedProductId}
        isMenuOpen={isMenuOpen}
        wsProducts={wsProducts}
        onLoadRoomReady={(loadRoom) => {
          loadRoomRef.current = loadRoom
        }}
      />
    </main>
  )
}