'use client'

import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryState } from 'nuqs'
import MainMenu from '@/components/MainMenu'
import { Category, Subcategory } from '@/components/categoriesData'
import { WsProducts } from '@/types/erpTypes'
import type { SavedRoom } from '@/data/savedRooms'
import type { WallDimensions } from '@/features/scene/types'
import { getRoomDesign, type RoomDesignData } from '@/server/rooms/getRoomDesign'
import { useWsRoomsQuery } from '@/hooks/useWsRoomsQuery'
import type { AppMode } from '@/features/scene/context/ModeContext'

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
  // URL query state for room selection
  const [roomId, setRoomId] = useQueryState('roomId')

  // URL query state for app mode (admin/user)
  const [modeParam, setModeParam] = useQueryState('mode')

  // Fetch wsRooms config via React Query
  const { data: wsRooms, isLoading: wsRoomsLoading } = useWsRoomsQuery()

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
  const [selectedApplianceType, setSelectedApplianceType] = useState<'dishwasher' | 'washingMachine' | 'sideBySideFridge' | null>(null)
  const [selectedMode, setSelectedMode] = useState<AppMode>('admin')

  // Track the last loaded room ID to prevent duplicate loads (e.g. when setting URL + manually loading)
  const lastLoadedRoomIdRef = useRef<string | null>(null)

  // Load room design when roomId changes or on initial load
  useEffect(() => {
    // Skip if no room ID, no load function, or if this room is already loaded
    if (!roomId || !loadRoomRef.current || roomId === lastLoadedRoomIdRef.current) return

    const loadRoomFromId = async () => {
      try {
        const design = await getRoomDesign(roomId)
        if (design && loadRoomRef.current) {
          // Construct a SavedRoom object from the design and wsRooms metadata
          const roomMeta = wsRooms?.rooms?.[roomId]
          const categoryMeta = roomMeta?.categoryId ? wsRooms?.categories?.[roomMeta.categoryId] : null

          const savedRoom: SavedRoom = {
            id: roomId,
            name: roomMeta?.room || 'Untitled Room',
            category: (categoryMeta?.category as SavedRoom['category']) || 'Kitchen',
            savedAt: design.updatedAt || design.savedAt || new Date().toISOString(),
            wallSettings: design.wallSettings,
            cabinets: design.cabinets,
            views: design.views,
            cabinetSyncs: design.cabinetSyncs,
          }

          await loadRoomRef.current(savedRoom)
          lastLoadedRoomIdRef.current = roomId
        }
      } catch (error) {
        console.error('Failed to load room design:', error)
      }
    }

    // Only load if wsRooms is available (for metadata)
    if (wsRooms) {
      loadRoomFromId()
    }
  }, [roomId, wsRooms])

  // Handler for when a room is selected from the menu
  const handleRoomSelect = useCallback(async (selectedRoomId: string, design?: RoomDesignData | null) => {
    // Update ref first to prevent useEffect from loading again when URL changes
    if (design) {
        lastLoadedRoomIdRef.current = selectedRoomId
    }

    // Update URL
    await setRoomId(selectedRoomId)

    if (loadRoomRef.current && design) {
      const roomMeta = wsRooms?.rooms?.[selectedRoomId]
      const categoryMeta = roomMeta?.categoryId ? wsRooms?.categories?.[roomMeta.categoryId] : null

      const savedRoom: SavedRoom = {
        id: selectedRoomId,
        name: roomMeta?.room || 'Untitled Room',
        category: (categoryMeta?.category as SavedRoom['category']) || 'Kitchen',
        savedAt: design.updatedAt || design.savedAt || new Date().toISOString(),
        wallSettings: design.wallSettings,
        cabinets: design.cabinets,
        views: design.views,
        cabinetSyncs: design.cabinetSyncs,
      }

      await loadRoomRef.current(savedRoom)
    }
  }, [setRoomId, wsRooms])

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

  const handleApplianceSelect = (applianceType: 'dishwasher' | 'washingMachine' | 'sideBySideFridge') => {
    setSelectedApplianceType(applianceType)
    // Clear cabinet selection to avoid conflicts
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setSelectedProductId(undefined)
  }

  // Sync selectedMode with mode query param
  useEffect(() => {
    if (modeParam === 'admin' || modeParam === 'user') {
      setSelectedMode(modeParam as AppMode)
    }
  }, [modeParam])

  const handleModeChange = useCallback((mode: AppMode) => {
    setSelectedMode(mode)
    setModeParam(mode)
  }, [setModeParam])

  return (
    <main className="h-screen w-full relative">
      {/* Main Menu - Hidden in User mode */}
      {selectedMode === 'admin' && <MainMenu
        onCategorySelect={handleCategorySelect}
        onSubcategorySelect={handleSubcategorySelect}
        selectedCategory={selectedCategory}
        onMenuStateChange={handleMenuStateChange}
        wsProducts={wsProducts}
        setWsProducts={setWsProducts}
        wsRooms={wsRooms ?? null}
        wsRoomsLoading={wsRoomsLoading}
        currentRoomId={roomId}
        onRoomSelect={handleRoomSelect}
        onLoadRoom={async (savedRoom) => {
          if (loadRoomRef.current) {
            await loadRoomRef.current(savedRoom)
          }
        }}
        onApplianceSelect={handleApplianceSelect}
      />}

      {/* Three.js Scene */}
      <ThreeScene
        wallDimensions={wallDimensions}
        onDimensionsChange={setWallDimensions}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        selectedProductId={selectedProductId}
        isMenuOpen={isMenuOpen}
        wsProducts={wsProducts}
        selectedApplianceType={selectedApplianceType}
        onApplianceCreated={() => setSelectedApplianceType(null)}
        onLoadRoomReady={(loadRoom) => {
          loadRoomRef.current = loadRoom
        }}
        currentRoomId={roomId}
        wsRooms={wsRooms ?? null}
        selectedMode={selectedMode}
        setSelectedMode={handleModeChange}
      />
    </main>
  )
}
