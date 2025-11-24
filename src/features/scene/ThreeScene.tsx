import { CabinetType, DoorMaterial } from '@/features/carcass'
import { Subcategory } from '@/components/categoriesData'
import { Settings, ShoppingCart } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useCabinets } from '../cabinets/hooks/useCabinets'
import { useViewManager } from '../cabinets/hooks/useViewManager'
import { CabinetsInfoPanel } from '../cabinets/ui/CabinetsInfoPanel'
import { CabinetLockIcons } from './ui/CabinetLockIcons'
import ProductPanel from '../cabinets/ui/ProductPanel'
import { cabinetPanelState, type PersistedPanelState } from '../cabinets/ui/ProductPanel'
import { useRoomPersistence } from './hooks/useRoomPersistence'
import { useCameraDrag } from './hooks/useCameraDrag'
import { useSceneInteractions } from './hooks/useSceneInteractions'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useDimensionLines } from './hooks/useDimensionLines'
import { useCabinetNumbers } from './hooks/useCabinetNumbers'
import { useThreeRenderer } from './hooks/useThreeRenderer'
import type { Category, WallDimensions as WallDims, CabinetData } from './types'
import { CameraControls } from './ui/CameraControls'
import { SettingsSidebar } from './ui/SettingsSidebar'
import { WallSettingsDrawer } from './ui/WallSettingsDrawer'
import { ViewsListDrawer } from './ui/ViewsListDrawer'
import { ViewDetailDrawer } from './ui/ViewDetailDrawer'
import { SaveModal } from './ui/SaveModal'
import { DeleteConfirmationModal } from './ui/DeleteConfirmationModal'
import { WsProducts } from '@/types/erpTypes'
import type { ViewId } from '../cabinets/ViewManager'
import type { SavedRoom } from '@/data/savedRooms'
import { WALL_THICKNESS } from './lib/sceneUtils'

interface ThreeSceneProps {
  wallDimensions: WallDims
  onDimensionsChange: (dimensions: WallDims) => void
  selectedCategory?: Category | null
  selectedSubcategory?: { category: Category; subcategory: Subcategory } | null
  isMenuOpen?: boolean
  /** Optional productId selected from the menu to associate with the created 3D object */
  selectedProductId?: string
  wsProducts?: WsProducts | null
  /** Callback to get the loadRoom function for restoring saved rooms */
  onLoadRoomReady?: (loadRoom: (savedRoom: SavedRoom) => void) => void
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false, selectedProductId, wsProducts, onLoadRoomReady }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false)
  const [showWallDrawer, setShowWallDrawer] = useState(false)
  const [showViewsDrawer, setShowViewsDrawer] = useState(false)
  const [showViewDrawer, setShowViewDrawer] = useState(false)
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1.5)
  const [cameraMode, setCameraMode] = useState<'constrained' | 'free'>('constrained')
  const [dimensionsVisible, setDimensionsVisible] = useState(true)
  const [numbersVisible, setNumbersVisible] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'admin' | 'user'>('user') // Radio button selection
  // Cabinet groups: Map of cabinetId -> array of { cabinetId, percentage }
  const [cabinetGroups, setCabinetGroups] = useState<Map<string, Array<{ cabinetId: string; percentage: number }>>>(new Map())
  // Cabinet sync relationships: Map of cabinetId -> array of synced cabinetIds
  const [cabinetSyncs, setCabinetSyncs] = useState<Map<string, string[]>>(new Map())
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [cabinetToDelete, setCabinetToDelete] = useState<CabinetData | null>(null) // Store cabinet to delete before modal opens

  const {
    sceneRef,
    cameraRef,
    wallRef,
    leftWallRef,
    rightWallRef,
    createWall,
    createLeftWall,
    createRightWall,
    createAdditionalWalls,
    createFloor,
    updateCameraPosition,
    resetCamera,
    setCameraXView,
    setCameraYView,
    setCameraZView
  } = useThreeRenderer(mountRef, wallDimensions, '#dcbfa0')

  const {
    cabinets,
    selectedCabinet,
    selectedCabinets,
    setSelectedCabinet,
    setSelectedCabinets,
    showProductPanel,
    setShowProductPanel,
    createCabinet,
    clearCabinets,
    updateCabinetViewId,
    updateCabinetLock,
    deleteCabinet
  } = useCabinets(sceneRef)

  // View manager for grouping cabinets
  const viewManager = useViewManager(cabinets)

  // Snap guides for visual feedback during cabinet dragging
  const { updateSnapGuides, clearSnapGuides } = useSnapGuides(sceneRef, wallDimensions)

  // Dimension lines for showing cabinet measurements
  useDimensionLines(sceneRef, cabinets, dimensionsVisible, viewManager.viewManager, wallDimensions)

  // Cabinet numbering system
  useCabinetNumbers(sceneRef, cabinets, numbersVisible)

  // interactions hook wires global events and cabinet drag/select
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    zoomLevel,
    // Spherical coordinates for orbit camera
    orbitRadius: wallDimensions.length * 1.5,
    orbitTheta: 0, // horizontal angle
    orbitPhi: Math.PI / 3, // vertical angle from top
    orbitTarget: { // Point camera is looking at
      x: wallDimensions.length / 2,
      y: wallDimensions.height / 2,
      z: 0
    }
  })
  const cameraDrag = useCameraDrag(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
    cameraMode,
    dragState,
    next => {
      setDragState(prev => ({ ...prev, ...next }))
      if (next.zoomLevel !== undefined) setZoomLevel(next.zoomLevel)
      if (next.isDragging !== undefined) setIsDragging(next.isDragging)
    }
  )

  const handleWallClick = useCallback(() => {
    setShowWallDrawer(true)
  }, [])

  const {
    cabinetWithLockIcons,
    setCabinetWithLockIcons
  } = useSceneInteractions(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
    cameraMode,
    cabinets,
    selectedCabinet,
    selectedCabinets,
    setSelectedCabinet,
    setSelectedCabinets,
    showProductPanel,
    setShowProductPanel,
    cameraDrag,
    updateSnapGuides,
    clearSnapGuides,
    viewManager.viewManager,
    wallRef,
    leftWallRef,
    rightWallRef,
    handleWallClick
  )

  // Helper function to check if two cabinets are paired
  const areCabinetsPaired = useCallback((cabinetId1: string, cabinetId2: string): boolean => {
    // Check if cabinetId2 is in cabinetId1's group
    const group1 = cabinetGroups.get(cabinetId1)
    if (group1 && group1.some(c => c.cabinetId === cabinetId2)) {
      return true
    }
    // Check if cabinetId1 is in cabinetId2's group
    const group2 = cabinetGroups.get(cabinetId2)
    if (group2 && group2.some(c => c.cabinetId === cabinetId1)) {
      return true
    }
    return false
  }, [cabinetGroups])

  // Handle category changes
  useEffect(() => {
    if (selectedCategory) {
      console.log('Category selected in ThreeScene:', selectedCategory.name);
      // You can add logic here to handle different categories
      // For example, load different 3D models, change materials, etc.
    }
  }, [selectedCategory]);

  // Handle subcategory selection for cabinet creation
  useEffect(() => {
    if (selectedSubcategory && sceneRef.current) {
      console.log('Subcategory selected:', selectedSubcategory.category.name, '>', selectedSubcategory.subcategory.name)

      // Map general categories to supported CabinetType values
      // const rawType = selectedSubcategory.category.id
      // const cabinetType: CabinetType = rawType === 'wardrobe' ? 'tall' : (rawType as CabinetType)

      if (!wsProducts) throw new Error("WsProducts data is required to create cabinets.")

      const productEntry = wsProducts.products[selectedProductId || '']
      const designId = productEntry?.designId
      const designEntry = wsProducts.designs[designId || '']
      if (!designEntry) {
        throw new Error(`Design entry not found for designId: ${designId}`)
      }

      const { type3D, design } = designEntry

      if (!type3D) {
        throw new Error(`3D type not specified in design entry for design: ${design}`)
      }

      const legacyCategoryMap: Record<NonNullable<WsProducts["designs"][string]["type3D"]>, CabinetType> = {
        'base': 'base',
        'overhead': 'top',
        tall: 'tall',
      }

      const cabinetType = legacyCategoryMap[type3D] || "base"

      // Create cabinet based on mapped cabinet type and subcategory
      const cabinetData = createCabinet(cabinetType, selectedSubcategory.subcategory.id, selectedProductId)
      if (cabinetData) setSelectedCabinet(cabinetData)
    }
  }, [selectedSubcategory, selectedProductId])

  // Reset dragging state when menu opens/closes
  useEffect(() => {
    if (isMenuOpen) {
      // When menu opens, ensure dragging is stopped
      setIsDragging(false);
    }
  }, [isMenuOpen]);

  // initial wall/floor creation is handled by useThreeRenderer

  // hover effects are available via useCabinets if needed

  // global mouse interactions moved to useSceneInteractions

  // floor creation handled by useThreeRenderer

  // wall creation handled by useThreeRenderer

  // camera positioning handled by useThreeRenderer

  // camera drag handled above

  // cabinet movement handled in useSceneInteractions

  // mouse handlers moved to useSceneInteractions

  // mouse up handled by interactions hook

  // wheel handled by interactions hook

  // middle click handled by interactions hook

  // Reset camera to default position
  const resetCameraPosition = () => resetCamera(zoomLevel)

  // view helpers provided by useThreeRenderer

  // Handle wall dimension changes
  const handleDimensionChange = (newDimensions: WallDims, newColor?: string) => {
    onDimensionsChange(newDimensions);
    if (sceneRef.current) {
      const backWallLength = newDimensions.backWallLength ?? newDimensions.length
      createWall(newDimensions.height, backWallLength, newColor)
      createFloor(backWallLength)

      // Create left and right walls
      createLeftWall(
        newDimensions.height,
        newDimensions.leftWallLength ?? 600,
        newDimensions.leftWallVisible ?? true,
        newColor
      )
      createRightWall(
        newDimensions.height,
        newDimensions.rightWallLength ?? 600,
        backWallLength,
        newDimensions.rightWallVisible ?? true,
        newColor
      )

      // Create additional walls
      createAdditionalWalls(
        newDimensions.height,
        newDimensions.additionalWalls ?? [],
        newColor
      )

      if (cameraRef.current) updateCameraPosition(newDimensions.height, backWallLength, zoomLevel)
    }
  };

  // Wall settings handlers
  const [wallColor, setWallColor] = useState('#dcbfa0')
  const handleApplyWallSettings = (dims: WallDims, color: string) => {
    if (color !== wallColor) setWallColor(color)
    handleDimensionChange(dims, color)
    // Don't close drawer automatically - let user close it manually
  }

  const { currentRoom, saveRoom: handleSaveRoom } = useRoomPersistence({
    cabinets,
    cabinetGroups,
    setCabinetGroups,
    wallDimensions,
    wallColor,
    setWallColor,
    handleDimensionChange,
    viewManager,
    wsProducts,
    setNumbersVisible,
    clearCabinets,
    createCabinet,
    updateCabinetViewId,
    updateCabinetLock,
    onLoadRoomReady,
  })

  // Auto-update back wall length when right wall is linked to a view and cabinets move
  // This handles the case where cabinets in a view penetrate the right wall
  // If the right wall is linked to the same view, adjust back wall length and right wall position
  useEffect(() => {
    if (!wallDimensions.rightWallViewId || wallDimensions.rightWallViewId === 'none') return

    // Calculate rightmost position in the linked view
    const cabinetIds = viewManager.getCabinetsInView(wallDimensions.rightWallViewId as ViewId)
    const viewCabinets = cabinets.filter(c => cabinetIds.includes(c.cabinetId))

    if (viewCabinets.length === 0) return

    // Find the rightmost edge: cabinet X position + cabinet width
    let rightmostX = 0
    viewCabinets.forEach(cabinet => {
      const cabinetRightEdge = cabinet.group.position.x + cabinet.carcass.dimensions.width
      if (cabinetRightEdge > rightmostX) {
        rightmostX = cabinetRightEdge
      }
    })

    // Always update if cabinets penetrate the right wall (rightmostX > current back wall length)
    // This ensures the right wall moves with the cabinets when they penetrate
    const currentBackWallLength = wallDimensions.backWallLength ?? wallDimensions.length
    if (rightmostX > currentBackWallLength || Math.abs(rightmostX - currentBackWallLength) > 1) {
      // Update back wall length to match rightmost position
      // This automatically adjusts the right wall position since it's positioned at backWallLength
      handleDimensionChange({
        ...wallDimensions,
        backWallLength: Math.max(100, rightmostX),
        length: Math.max(100, rightmostX), // Keep for backward compatibility
      })
    }
  }, [cabinets.map(c => `${c.cabinetId}-${c.group.position.x}-${c.carcass.dimensions.width}`).join(','), wallDimensions.rightWallViewId, viewManager])

  // Detect cabinet penetration into right wall and internal walls, then adjust wall positions
  useEffect(() => {
    const currentBackWallLength = wallDimensions.backWallLength ?? wallDimensions.length
    let needsUpdate = false
    const newDimensions = { ...wallDimensions }

    // Check for penetration into right wall
    // Find the rightmost edge of all cabinets
    let rightmostCabinetEdge = 0
    cabinets.forEach(cabinet => {
      const cabinetRightEdge = cabinet.group.position.x + cabinet.carcass.dimensions.width
      if (cabinetRightEdge > rightmostCabinetEdge) {
        rightmostCabinetEdge = cabinetRightEdge
      }
    })

    // If cabinets penetrate the right wall, adjust back wall length
    if (rightmostCabinetEdge > currentBackWallLength) {
      newDimensions.backWallLength = Math.max(100, rightmostCabinetEdge)
      newDimensions.length = Math.max(100, rightmostCabinetEdge) // Keep for backward compatibility
      needsUpdate = true
    }

    // Check for penetration into internal walls
    if (wallDimensions.additionalWalls && wallDimensions.additionalWalls.length > 0) {
      const updatedAdditionalWalls = wallDimensions.additionalWalls.map(wall => {
        const wallThickness = wall.thickness ?? WALL_THICKNESS
        const wallLeft = wall.distanceFromLeft
        const wallRight = wall.distanceFromLeft + wallThickness

        // Check if any cabinet penetrates this wall
        let maxPenetration = 0
        cabinets.forEach(cabinet => {
          const cabinetLeft = cabinet.group.position.x
          const cabinetRight = cabinet.group.position.x + cabinet.carcass.dimensions.width

          // Check if cabinet overlaps with wall
          if (cabinetLeft < wallRight && cabinetRight > wallLeft) {
            // Cabinet penetrates the wall
            // Calculate how far the cabinet extends beyond the wall's right edge
            const penetration = Math.max(0, cabinetRight - wallRight)
            if (penetration > maxPenetration) {
              maxPenetration = penetration
            }
          }
        })

        // If there's penetration, adjust wall position to accommodate
        if (maxPenetration > 0) {
          // Move wall to the right by the penetration amount
          return {
            ...wall,
            distanceFromLeft: wall.distanceFromLeft + maxPenetration
          }
        }

        return wall
      })

      // Check if any wall positions changed
      const wallsChanged = updatedAdditionalWalls.some((wall, index) =>
        wall.distanceFromLeft !== wallDimensions.additionalWalls![index].distanceFromLeft
      )

      if (wallsChanged) {
        newDimensions.additionalWalls = updatedAdditionalWalls
        needsUpdate = true
      }
    }

    // Apply updates if needed
    if (needsUpdate) {
      handleDimensionChange(newDimensions)
    }
  }, [cabinets.map(c => `${c.cabinetId}-${c.group.position.x}-${c.carcass.dimensions.width}`).join(','), wallDimensions.additionalWalls?.map(w => `${w.id}-${w.distanceFromLeft}`).join(','), wallDimensions.backWallLength, wallDimensions.length])

  const handleSettingsClick = () => {
    setShowSettingsSidebar(true)
  }

  // Calculate total price of all cabinets
  const totalPrice = useMemo(() => {
    return cabinets.reduce((sum, cabinet) => {
      const panelState = cabinetPanelState.get(cabinet.cabinetId)
      const price = panelState?.price?.amount ?? 0
      return sum + price
    }, 0)
  }, [cabinets])

  const handleViewsClick = () => {
    setShowViewsDrawer(true)
  }

  // Close drawers when other drawers open or when product panel opens
  useEffect(() => {
    if (showProductPanel) {
      setShowSettingsSidebar(false)
      setShowWallDrawer(false)
      setShowViewsDrawer(false)
    }
  }, [showProductPanel])

  // Close drawers when main menu opens
  useEffect(() => {
    if (isMenuOpen) {
      setShowSettingsSidebar(false)
      setShowWallDrawer(false)
      setShowViewsDrawer(false)
    }
  }, [isMenuOpen])

  // When the product panel opens for a selected cabinet, try loading its WsProduct config

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Scene Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Admin and User Radio Buttons - Top Middle */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-3 z-10">
        <label className="relative cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="admin"
            checked={selectedMode === 'admin'}
            onChange={(e) => setSelectedMode(e.target.value as 'admin' | 'user')}
            className="sr-only"
          />
          <div className={`px-6 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium ${selectedMode === 'admin'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}>
            Admin
          </div>
        </label>
        <label className="relative cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="user"
            checked={selectedMode === 'user'}
            onChange={(e) => setSelectedMode(e.target.value as 'admin' | 'user')}
            className="sr-only"
          />
          <div className={`px-6 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium ${selectedMode === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}>
            User
          </div>
        </label>
      </div>

      {/* Add to Cart Button - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
        {/* Add to Cart Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Implement add to cart functionality
            console.log('Add to cart clicked', { cabinets, totalPrice })
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg transition-colors duration-200 flex items-center gap-2 w-full"
          title="Add to Cart"
        >
          <ShoppingCart size={20} />
          <span>Add to Cart</span>
        </button>

        {/* Total Price Display - Same width as button */}
        <div className="bg-white px-4 py-1 rounded-lg shadow-lg border border-gray-200 w-full text-center">
          <div className="text-sm text-gray-600">Total Price</div>
          <div className="text-xl font-bold text-gray-800">
            ${totalPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Settings Icon - Bottom Right */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleSettingsClick()
        }}
        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200 z-10"
        title="Settings"
      >
        <Settings size={24} />
      </button>

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => {
          setShowSettingsSidebar(false)
          setShowWallDrawer(false)
          setShowViewsDrawer(false)
          setShowViewDrawer(false)
          setSelectedViewId(null)
        }}
        onWallClick={handleWallClick}
        onViewClick={(viewId) => {
          setSelectedViewId(viewId)
          setShowViewDrawer(true)
        }}
        onDeleteView={(viewId) => {
          // Get all cabinets in this view
          const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)

          // Update all cabinets in this view to have viewId = "none"
          cabinetIds.forEach((cabinetId) => {
            updateCabinetViewId(cabinetId, undefined) // undefined means "none"
          })

          // If the right wall is linked to this view, remove the association
          if (wallDimensions.rightWallViewId === viewId) {
            handleDimensionChange({
              ...wallDimensions,
              rightWallViewId: undefined,
            })
          }

          // Delete the view from ViewManager
          viewManager.deleteView(viewId as ViewId)
        }}
        activeViews={viewManager.activeViews}
      />

      {/* Wall Settings Drawer */}
      <WallSettingsDrawer
        isOpen={showWallDrawer}
        onClose={() => setShowWallDrawer(false)}
        wallDimensions={wallDimensions}
        wallColor={wallColor}
        activeViews={viewManager.activeViews}
        cabinets={cabinets}
        viewManager={viewManager.viewManager}
        onApply={handleApplyWallSettings}
      />

      {/* Views List Drawer - Shows list of all views */}
      <ViewsListDrawer
        isOpen={showViewsDrawer}
        onClose={() => setShowViewsDrawer(false)}
        activeViews={viewManager.activeViews}
        onViewClick={(viewId) => {
          // Could add view-specific settings here in the future
          console.log('View clicked:', viewId)
        }}
        onDeleteView={(viewId) => {
          // Get all cabinets in this view
          const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)

          // Update all cabinets in this view to have viewId = "none"
          cabinetIds.forEach((cabinetId) => {
            updateCabinetViewId(cabinetId, undefined) // undefined means "none"
          })

          // If the right wall is linked to this view, remove the association
          if (wallDimensions.rightWallViewId === viewId) {
            handleDimensionChange({
              ...wallDimensions,
              rightWallViewId: undefined,
            })
          }

          // Delete the view from ViewManager
          viewManager.deleteView(viewId as ViewId)
        }}
      />

      {/* View Detail Drawer - Shows settings and details for selected view */}
      {selectedViewId && (
        <ViewDetailDrawer
          isOpen={showViewDrawer}
          onClose={() => {
            setShowViewDrawer(false)
            setSelectedViewId(null)
          }}
          viewName={viewManager.activeViews.find(v => v.id === selectedViewId)?.name || `View ${selectedViewId}`}
          viewId={selectedViewId}
          cabinets={cabinets}
          wsProducts={wsProducts || null}
          onDimensionChange={(gdId, newValue, productDataMap) => {
            // Find all cabinets that have this GDId in their product dimensions
            const cabinetsToUpdate: Array<{ cabinet: CabinetData; dimId: string; productData: any }> = []
            
            // Use the provided product data map instead of fetching
            productDataMap.forEach((productData, productId) => {
              if (!productData?.product?.dims) return
              
              // Find dimensions with this GDId
              const dims = productData.product.dims
              Object.entries(dims).forEach(([dimId, dimObj]: [string, any]) => {
                if (dimObj.GDId === gdId && dimObj.visible !== false) {
                  // Find all cabinets with this productId
                  const cabinetsWithProduct = cabinets.filter(c => c.productId === productId)
                  cabinetsWithProduct.forEach(cabinet => {
                    cabinetsToUpdate.push({ cabinet, dimId, productData })
                  })
                }
              })
            })
            
            // Get threeJsGDs mapping from first product (they should all have the same mapping)
            const firstProductData = cabinetsToUpdate[0]?.productData
            if (!firstProductData?.threeJsGDs) return
            
            const widthGDIds = firstProductData.threeJsGDs["width"] || []
            const heightGDIds = firstProductData.threeJsGDs["height"] || []
            const depthGDIds = firstProductData.threeJsGDs["depth"] || []
            const shelfQtyGDIds = firstProductData.threeJsGDs["shelfQty"] || []
            const doorOverhangGDIds = firstProductData.threeJsGDs["doorOverhang"] || []
            
            // Update each cabinet
            cabinetsToUpdate.forEach(({ cabinet, dimId, productData }) => {
              // Update cabinetPanelState
              const persisted = cabinetPanelState.get(cabinet.cabinetId)
              const updatedValues = { ...(persisted?.values || {}), [dimId]: newValue }
              cabinetPanelState.set(cabinet.cabinetId, {
                ...(persisted || { values: {}, materialColor: '#ffffff' }),
                values: updatedValues,
              })
              
              // Determine which dimension (width/height/depth/shelfQty) this GDId maps to
              const dimObj = productData.product.dims[dimId]
              if (!dimObj?.GDId) return
              
              let width = cabinet.carcass.dimensions.width
              let height = cabinet.carcass.dimensions.height
              let depth = cabinet.carcass.dimensions.depth
              let shelfCount: number | undefined = cabinet.carcass?.config?.shelfCount
              
              if (widthGDIds.includes(dimObj.GDId)) {
                width = newValue
              } else if (heightGDIds.includes(dimObj.GDId)) {
                height = newValue
              } else if (depthGDIds.includes(dimObj.GDId)) {
                depth = newValue
              } else if (shelfQtyGDIds.includes(dimObj.GDId)) {
                shelfCount = newValue
                // Update shelf count directly on the carcass
                cabinet.carcass.updateConfig({ shelfCount: newValue })
                return // Shelf count doesn't affect dimensions, so we can return early
              } else if (doorOverhangGDIds.includes(dimObj.GDId)) {
                // Handle door overhang - convert numeric value to boolean
                // If it's a selection type, the value might be 1/0 or "yes"/"no"
                let overhangDoor: boolean
                if (typeof newValue === 'number') {
                  overhangDoor = newValue === 1 || newValue > 0
                } else {
                  const valStr = String(newValue).toLowerCase()
                  overhangDoor = valStr === 'yes' || valStr === 'true' || valStr === '1'
                }
                
                // Apply door overhang to ALL top/overhead cabinets, not just those with this dimension
                // This ensures all overhead cabinets get updated
                cabinets.forEach((cab) => {
                  if (cab.cabinetType === 'top') {
                    cab.carcass.updateOverhangDoor(overhangDoor)
                    // Also update cabinetPanelState if this cabinet has the dimension
                    const cabPersisted = cabinetPanelState.get(cab.cabinetId)
                    if (cabPersisted) {
                      const cabUpdatedValues = { ...cabPersisted.values, [dimId]: newValue }
                      cabinetPanelState.set(cab.cabinetId, {
                        ...cabPersisted,
                        values: cabUpdatedValues,
                      })
                    }
                  }
                })
                return // Door overhang doesn't affect dimensions, so we can return early
              } else {
                // Not a primary dimension, skip
                return
              }
              
              // Store old width and position before updating
              const oldWidth = cabinet.carcass.dimensions.width
              const oldX = cabinet.group.position.x
              const leftLock = cabinet.leftLock ?? false
              const rightLock = cabinet.rightLock ?? false
              
              // Calculate width delta (how much the width changed)
              const widthDelta = width - oldWidth
              
              // Handle lock states for width changes
              if (widthDelta !== 0) {
                if (leftLock && rightLock) {
                  // Both locks are active - cannot resize width
                  // Skip this cabinet update
                  return
                } else if (leftLock) {
                  // Left edge is locked - can ONLY extend from right side (positive X direction)
                  // Position stays the same (left edge is frozen)
                  cabinet.carcass.updateDimensions({ width, height, depth })
                  
                  // Handle grouped cabinets - apply proportional width changes
                  const groupData = cabinetGroups.get(cabinet.cabinetId)
                  if (groupData && groupData.length > 0) {
                    groupData.forEach((groupCabinet) => {
                      const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                      if (!groupedCabinet) return
                      
                      // Calculate proportional width change
                      const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                      const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                      
                      // Respect lock properties of grouped cabinet
                      const groupedLeftLock = groupedCabinet.leftLock ?? false
                      const groupedRightLock = groupedCabinet.rightLock ?? false
                      
                      if (groupedLeftLock && groupedRightLock) {
                        // Both locks active - cannot resize
                        return
                      } else if (groupedLeftLock) {
                        // Left locked - extend to right
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                      } else if (groupedRightLock) {
                        // Right locked - extend to left
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedRightEdge = groupedOldX + groupedOldWidth
                        const groupedNewX = groupedRightEdge - newGroupedWidth
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      } else {
                        // Neither lock - extend equally from center
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedCenterX = groupedOldX + groupedOldWidth / 2
                        const groupedNewX = groupedCenterX - newGroupedWidth / 2
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      }
                    })
                  }
                  
                  // If cabinet belongs to a view, handle other cabinets in the view
                  if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
                const cabinetsInSameView = viewManager.getCabinetsInView(cabinet.viewId as ViewId)
                    const changingLeftEdge = oldX
                
                    // Move all cabinets on the RIGHT side by widthDelta (positive X direction)
                cabinetsInSameView.forEach((cabinetId) => {
                      if (cabinetId === cabinet.cabinetId) return
                  
                  const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                  if (!otherCabinet) return
                  
                      // Skip if cabinets are paired
                      if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
                        return
                      }
                  
                      // Cabinet is on the RIGHT if it extends even 1mm toward positive X
                      // Check if other cabinet's left edge is to the right of changing cabinet's left edge
                      if (otherCabinet.group.position.x > changingLeftEdge) {
                        const newX = otherCabinet.group.position.x + widthDelta
                  // Only clamp left boundary - right wall can be penetrated
                  const clampedX = Math.max(0, newX)
                  
                        otherCabinet.group.position.set(
                    clampedX,
                    otherCabinet.group.position.y,
                    otherCabinet.group.position.z
                  )
                      }
                    })
                  }
                } else if (rightLock) {
                  // Right edge is locked - can ONLY extend from left side (negative X direction)
                  const rightEdge = oldX + oldWidth
                  const leftEdge = oldX
                  const newX = rightEdge - width
                  
                  // Update dimensions first
                  cabinet.carcass.updateDimensions({ width, height, depth })
                  
                  // Clamp new X position to left boundary only - right wall can be penetrated
                  const clampedX = Math.max(0, newX)
                  
                  // Update cabinet position (move left edge)
                  cabinet.group.position.set(
                    clampedX,
                    cabinet.group.position.y,
                    cabinet.group.position.z
                  )
                  
                  // Handle grouped cabinets - apply proportional width changes
                  const groupData = cabinetGroups.get(cabinet.cabinetId)
                  if (groupData && groupData.length > 0) {
                    groupData.forEach((groupCabinet) => {
                      const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                      if (!groupedCabinet) return
                      
                      // Calculate proportional width change
                      const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                      const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                      
                      // Respect lock properties of grouped cabinet
                      const groupedLeftLock = groupedCabinet.leftLock ?? false
                      const groupedRightLock = groupedCabinet.rightLock ?? false
                      
                      if (groupedLeftLock && groupedRightLock) {
                        // Both locks active - cannot resize
                        return
                      } else if (groupedLeftLock) {
                        // Left locked - extend to right
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                      } else if (groupedRightLock) {
                        // Right locked - extend to left
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedRightEdge = groupedOldX + groupedOldWidth
                        const groupedNewX = groupedRightEdge - newGroupedWidth
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      } else {
                        // Neither lock - extend equally from center
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedCenterX = groupedOldX + groupedOldWidth / 2
                        const groupedNewX = groupedCenterX - newGroupedWidth / 2
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      }
                    })
                  }
                  
                  // If cabinet belongs to a view, handle other cabinets in the view
                  if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
                    const cabinetsInSameView = viewManager.getCabinetsInView(cabinet.viewId as ViewId)
                    const changingRightEdge = oldX + oldWidth
                    
                    // Move all cabinets on the LEFT side by widthDelta (negative X direction)
                    cabinetsInSameView.forEach((cabinetId) => {
                      if (cabinetId === cabinet.cabinetId) return
                      
                      const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                      if (!otherCabinet) return
                      
                      // Skip if cabinets are paired
                      if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
                        return
                      }
                      
                      // Cabinet is on the LEFT if it extends even 1mm toward negative X
                      // Check if other cabinet's right edge is to the left of changing cabinet's right edge
                      if (otherCabinet.group.position.x + otherCabinet.carcass.dimensions.width < changingRightEdge) {
                        const newX = otherCabinet.group.position.x - widthDelta
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, newX)
                        
                        otherCabinet.group.position.set(
                          clampedX,
                          otherCabinet.group.position.y,
                          otherCabinet.group.position.z
                        )
                      }
                    })
                  }
                } else {
                  // Neither lock is active - cabinet can extend/shrink by half widthDelta in both directions
                  // Center position stays fixed, extends equally in both positive and negative X directions
                  // Calculate center position
                  const centerX = oldX + oldWidth / 2
                  // Calculate new left edge position (center - half of new width)
                  const newX = centerX - width / 2
                  
                  // Clamp new X position to left boundary only - right wall can be penetrated
                  const clampedX = Math.max(0, newX)
                  
                  // Update dimensions first
                  cabinet.carcass.updateDimensions({ width, height, depth })
                  
                  // Update cabinet position (center remains fixed, extends equally both sides)
                  cabinet.group.position.set(
                    clampedX,
                    cabinet.group.position.y,
                    cabinet.group.position.z
                  )
                  
                  // Handle grouped cabinets - apply proportional width changes
                  const groupData = cabinetGroups.get(cabinet.cabinetId)
                  if (groupData && groupData.length > 0) {
                    groupData.forEach((groupCabinet) => {
                      const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                      if (!groupedCabinet) return
                      
                      // Calculate proportional width change
                      const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                      const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                      
                      // Respect lock properties of grouped cabinet
                      const groupedLeftLock = groupedCabinet.leftLock ?? false
                      const groupedRightLock = groupedCabinet.rightLock ?? false
                      
                      if (groupedLeftLock && groupedRightLock) {
                        // Both locks active - cannot resize
                        return
                      } else if (groupedLeftLock) {
                        // Left locked - extend to right
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                      } else if (groupedRightLock) {
                        // Right locked - extend to left
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedRightEdge = groupedOldX + groupedOldWidth
                        const groupedNewX = groupedRightEdge - newGroupedWidth
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      } else {
                        // Neither lock - extend equally from center
                        const groupedOldX = groupedCabinet.group.position.x
                        const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                        const groupedCenterX = groupedOldX + groupedOldWidth / 2
                        const groupedNewX = groupedCenterX - newGroupedWidth / 2
                        
                        groupedCabinet.carcass.updateDimensions({
                          width: newGroupedWidth,
                          height: groupedCabinet.carcass.dimensions.height,
                          depth: groupedCabinet.carcass.dimensions.depth
                        })
                        
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, groupedNewX)
                        groupedCabinet.group.position.set(
                          clampedX,
                          groupedCabinet.group.position.y,
                          groupedCabinet.group.position.z
                        )
                      }
                    })
                  }
                  
                  // Move other cabinets in the view based on half delta
                  // All cabinets on the RIGHT side move by halfDelta in positive X direction
                  // All cabinets on the LEFT side move by halfDelta in negative X direction
                  if (cabinet.viewId && cabinet.viewId !== "none" && viewManager) {
                    const cabinetsInSameView = viewManager.getCabinetsInView(cabinet.viewId as ViewId)
                    const halfDelta = widthDelta / 2
                    const changingLeftEdge = oldX
                    const changingRightEdge = oldX + oldWidth
                    
                    cabinetsInSameView.forEach((cabinetId) => {
                      if (cabinetId === cabinet.cabinetId) return
                      
                      const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                      if (!otherCabinet) return
                      
                      // Skip if cabinets are paired
                      if (areCabinetsPaired(cabinet.cabinetId, otherCabinet.cabinetId)) {
                        return
                      }
                      
                      const otherX = otherCabinet.group.position.x
                      const otherWidth = otherCabinet.carcass.dimensions.width
                      const otherRight = otherX + otherWidth
                      
                      // Move cabinets on the LEFT side by halfDelta (negative X direction)
                      // Cabinet is on the LEFT if it extends even 1mm toward negative X
                      if (otherRight < changingRightEdge) {
                        const newX = otherCabinet.group.position.x - halfDelta
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, newX)
                        
                        otherCabinet.group.position.set(
                          clampedX,
                          otherCabinet.group.position.y,
                          otherCabinet.group.position.z
                        )
                      }
                      // Move cabinets on the RIGHT side by halfDelta (positive X direction)
                      // Cabinet is on the RIGHT if it extends even 1mm toward positive X
                      else if (otherX > changingLeftEdge) {
                        const newX = otherCabinet.group.position.x + halfDelta
                        // Only clamp left boundary - right wall can be penetrated
                        const clampedX = Math.max(0, newX)
                        
                        otherCabinet.group.position.set(
                          clampedX,
                          otherCabinet.group.position.y,
                          otherCabinet.group.position.z
                        )
                      }
                    })
                  }
                }
              } else {
                // Width didn't change, just update other dimensions
                cabinet.carcass.updateDimensions({ width, height, depth })
              }
            })
          }}
          onSplashbackHeightChange={(viewId, height) => {
            handleSplashbackHeightChange(viewId as ViewId, height, {
              cabinets,
              viewManager,
              wallDimensions
            })
          }}
        />
      )}

      {/* Camera Movement Control */}
      <CameraControls
        isDragging={isDragging}
        cameraMode={cameraMode}
        onToggleMode={() => setCameraMode(prev => prev === 'constrained' ? 'free' : 'constrained')}
        onReset={resetCameraPosition}
        onClear={clearCabinets}
        onX={() => { setCameraMode('constrained'); setCameraXView(); }}
        onY={() => { setCameraMode('constrained'); setCameraYView(); }}
        onZ={() => { setCameraMode('constrained'); setCameraZView(); }}
        onToggleDimensions={() => setDimensionsVisible(prev => !prev)}
        onToggleNumbers={() => setNumbersVisible(prev => !prev)}
        numbersVisible={numbersVisible}
        onDelete={() => {
          if (selectedCabinet) {
            setCabinetToDelete(selectedCabinet)
            setShowDeleteModal(true)
          }
        }}
        canDelete={!!selectedCabinet}
        isMenuOpen={isMenuOpen}
      />

      {/* Camera Movement Instructions moved to CameraControls component - appears on hover */}

      {/* Cabinet Lock Icons - appear on double-click */}
      {cabinetWithLockIcons && (
        <CabinetLockIcons
          cabinet={cabinetWithLockIcons}
          camera={cameraRef.current}
          allCabinets={cabinets}
          onClose={() => setCabinetWithLockIcons(null)}
          onLockChange={(cabinetId, leftLock, rightLock) => {
            // Update the cabinet's lock state
            updateCabinetLock(cabinetId, leftLock, rightLock)
            // Update cabinetWithLockIcons if it's the one being changed
            if (cabinetWithLockIcons?.cabinetId === cabinetId) {
              setCabinetWithLockIcons(prev => prev ? { ...prev, leftLock, rightLock } : null)
            }
          }}
        />
      )}

      {/* CabinetsInfoPanel hidden per user request */}
      {/* <CabinetsInfoPanel cabinets={cabinets} /> */}


      {/* Info Panel */}

      {/* Product Panel */}
      <ProductPanel
        isVisible={showProductPanel}
        onClose={() => {
          setShowProductPanel(false);
          setSelectedCabinet(null);
        }}
        selectedCabinet={selectedCabinet ? {
          group: selectedCabinet.group,
          dimensions: selectedCabinet.carcass.dimensions,
          material: selectedCabinet.carcass.config.material,
          cabinetType: selectedCabinet.cabinetType,
          subcategoryId: selectedCabinet.subcategoryId,
          productId: selectedCabinet.productId,
          doorEnabled: selectedCabinet.carcass.config.doorEnabled,
          doorCount: selectedCabinet.carcass.config.doorCount,
          doorMaterial: selectedCabinet.carcass.config.doorMaterial,
          overhangDoor: selectedCabinet.carcass.config.overhangDoor,
          drawerEnabled: selectedCabinet.carcass.config.drawerEnabled,
          drawerQuantity: selectedCabinet.carcass.config.drawerQuantity,
          drawerHeights: selectedCabinet.carcass.config.drawerHeights,
          cabinetId: selectedCabinet.cabinetId,
          viewId: selectedCabinet.viewId
        } : null}
        viewManager={viewManager}
        allCabinets={cabinets}
        initialGroupData={selectedCabinet ? (cabinetGroups.get(selectedCabinet.cabinetId) || []) : []}
        initialSyncData={selectedCabinet ? (cabinetSyncs.get(selectedCabinet.cabinetId) || []) : []}
        onSyncChange={(cabinetId, syncCabinets) => {
          // Update cabinet syncs map
          setCabinetSyncs(prev => {
            const newMap = new Map(prev)
            if (syncCabinets.length === 0) {
              newMap.delete(cabinetId)
            } else {
              newMap.set(cabinetId, syncCabinets)
            }
            return newMap
          })
        }}
        onViewChange={(cabinetId, viewId) => {
          // Update the cabinet's viewId in the state
          // If viewId is "none", set to undefined
          updateCabinetViewId(cabinetId, viewId === 'none' ? undefined : viewId)

          // If cabinet is removed from view (viewId is 'none'), remove all group relations
          if (viewId === 'none') {
            setCabinetGroups(prev => {
              const newMap = new Map(prev)

              // Remove this cabinet's own group
              newMap.delete(cabinetId)

              // Remove this cabinet from any other cabinets' groups
              newMap.forEach((group, otherCabinetId) => {
                const updatedGroup = group.filter(g => g.cabinetId !== cabinetId)
                if (updatedGroup.length !== group.length) {
                  // Cabinet was removed from this group
                  if (updatedGroup.length > 0) {
                    // Recalculate percentages if a cabinet was removed
                    const total = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
                    if (total !== 100) {
                      updatedGroup.forEach(g => {
                        g.percentage = Math.round((g.percentage / total) * 100)
                      })
                      const finalTotal = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
                      if (finalTotal !== 100) {
                        updatedGroup[0].percentage += (100 - finalTotal)
                      }
                    }
                    newMap.set(otherCabinetId, updatedGroup)
                  } else {
                    // No more cabinets in group, remove the group
                    newMap.delete(otherCabinetId)
                  }
                }
              })

              return newMap
            })
          }
        }}
        onGroupChange={(cabinetId, groupCabinets) => {
          // Update cabinet groups map
          setCabinetGroups(prev => {
            const newMap = new Map(prev)
            if (groupCabinets.length === 0) {
              newMap.delete(cabinetId)
            } else {
              newMap.set(cabinetId, groupCabinets)
            }
            return newMap
          })
        }}

        onShelfCountChange={(newCount: number) => { if (selectedCabinet) selectedCabinet.carcass.updateConfig({ shelfCount: newCount }); }}

        onDimensionsChange={(newDimensions) => {
          if (selectedCabinet) {
            // Store old width and position before updating
            const oldWidth = selectedCabinet.carcass.dimensions.width
            const oldX = selectedCabinet.group.position.x
            const leftLock = selectedCabinet.leftLock ?? false
            const rightLock = selectedCabinet.rightLock ?? false
            
            // Calculate width delta (how much the width changed)
            const widthDelta = newDimensions.width - oldWidth
            
            // Check for sync relationships - sync logic overrides lock system and pair system
            if (widthDelta !== 0) {
              // Get sync relationships for the changing cabinet
              const syncCabinetsForThis = cabinetSyncs.get(selectedCabinet.cabinetId) || []
              
              // Check if the changing cabinet is part of a sync relationship
              const isChangingCabinetSynced = syncCabinetsForThis.length > 0
              
              if (isChangingCabinetSynced) {
                // Get all cabinets that are synced with the changing cabinet (including itself)
                const allSyncedCabinetIds = new Set([selectedCabinet.cabinetId, ...syncCabinetsForThis])
                
                // Check which of the selected cabinets are actually in the sync list
                const selectedSyncCabinets = selectedCabinets.filter(cab => 
                  allSyncedCabinetIds.has(cab.cabinetId)
                )
                
                // If we have multiple selected synced cabinets, apply sync logic
                // (ignore cabinets that are selected but not in sync list)
                if (selectedSyncCabinets.length > 1) {
                  console.log(`[Sync] Sync logic triggered! Selected sync cabinets: ${selectedSyncCabinets.length}, widthDelta: ${widthDelta}`)
                  
                  // Sort cabinets by X position (left to right)
                  const sortedSyncCabinets = [...selectedSyncCabinets].sort((a, b) => 
                    a.group.position.x - b.group.position.x
                  )
                  
                  console.log(`[Sync] Sorted cabinets:`, sortedSyncCabinets.map((c, idx) => `#${idx}: X=${c.group.position.x.toFixed(2)}, W=${c.carcass.dimensions.width.toFixed(2)}`))
                
                // Calculate initial sync width and positions
                const leftmostX = sortedSyncCabinets[0].group.position.x
                const rightmostCabinet = sortedSyncCabinets[sortedSyncCabinets.length - 1]
                const rightmostX = rightmostCabinet.group.position.x + rightmostCabinet.carcass.dimensions.width
                const initialSyncWidth = rightmostX - leftmostX
                
                  // Find the changing cabinet index
                  const changingCabinetIndex = sortedSyncCabinets.findIndex(c => c.cabinetId === selectedCabinet.cabinetId)
                  const isLeftmost = changingCabinetIndex === 0
                  const isRightmost = changingCabinetIndex === sortedSyncCabinets.length - 1
                  
                  console.log(`[Sync] Changing cabinet index: ${changingCabinetIndex}, isLeftmost: ${isLeftmost}, isRightmost: ${isRightmost}`)
                
                // Update the changing cabinet
                // If it's the leftmost, keep X position fixed (left edge fixed)
                // If it's not leftmost, we may need to adjust position
                if (isLeftmost) {
                  // Leftmost cabinet: keep X position fixed, only update dimensions
                  selectedCabinet.carcass.updateDimensions(newDimensions)
                } else {
                  // Not leftmost: update dimensions, position may need adjustment
                  selectedCabinet.carcass.updateDimensions(newDimensions)
                  // Position will be adjusted by cabinets to the left if needed
                }
                
                // Calculate new sync width
                const newSyncWidth = initialSyncWidth + widthDelta
                
                // Get cabinets to the right of the changing cabinet
                const cabinetsToRight = sortedSyncCabinets.slice(changingCabinetIndex + 1)
                const cabinetsToLeft = sortedSyncCabinets.slice(0, changingCabinetIndex)
                
                // Distribute width delta among other selected synced cabinets
                // Repositioning depends on position in X-SyncList:
                // - Rightmost cabinets: resize and maintain right edge position (move left)
                // - Middle cabinets: resize and reposition left based on adjustments from right
                if (cabinetsToRight.length > 0) {
                  // Distribute delta among cabinets to the right
                  // Negative delta (width decreased) means other cabinets increase width
                  // Positive delta (width increased) means other cabinets decrease width
                  const deltaPerCabinet = -widthDelta / cabinetsToRight.length
                  
                  // Store rightmost right edge to maintain it
                  const rightmostCabinet = cabinetsToRight[cabinetsToRight.length - 1]
                  const rightmostRightEdge = rightmostCabinet.group.position.x + rightmostCabinet.carcass.dimensions.width
                  
                  // Process from rightmost to leftmost (right to left)
                  // Rightmost: Size adjustment, extend left (right edge fixed), Position: No move (right edge stays fixed)
                  // Middle: Size adjustment, extend left, Position: Move left by width increase of cabinets to the right
                  
                  // First, calculate width increases for all cabinets
                  const widthIncreases: number[] = []
                  for (let i = 0; i < cabinetsToRight.length; i++) {
                    widthIncreases.push(deltaPerCabinet)
                  }
                  
                  // Process from rightmost to leftmost
                  // IMPORTANT: Process rightmost first, then middle cabinets
                  // This ensures we can calculate cumulative shifts correctly
                  for (let i = cabinetsToRight.length - 1; i >= 0; i--) {
                    const cab = cabinetsToRight[i]
                    const oldWidth = cab.carcass.dimensions.width
                    const newWidth = oldWidth + deltaPerCabinet
                    const oldCabX = cab.group.position.x
                    
                    if (i === cabinetsToRight.length - 1) {
                      // Cabinet #3 (rightmost): 
                      // - Size adjustment: +deltaPerCabinet
                      // - Direction: Like locked on right (extend toward X negative/left)
                      // - Position: No move (right edge stays fixed, so X moves left by width increase)
                      
                      // Update dimensions first
                      cab.carcass.updateDimensions({
                        width: newWidth,
                        height: cab.carcass.dimensions.height,
                        depth: cab.carcass.dimensions.depth
                      })
                      
                      const newCabX = rightmostRightEdge - newWidth
                      // Only clamp left boundary - right wall can be penetrated
                      const clampedX = Math.max(0, newCabX)
                      
                      console.log(`[Sync] Rightmost cabinet (index ${i}): oldX=${oldCabX.toFixed(2)}, newWidth=${newWidth.toFixed(2)}, rightEdge=${rightmostRightEdge.toFixed(2)}, newX=${newCabX.toFixed(2)}, clampedX=${clampedX.toFixed(2)}`)
                      
                      cab.group.position.set(
                        clampedX,
                        cab.group.position.y,
                        cab.group.position.z
                      )
                    } else {
                      // Cabinet #2 (middle):
                      // - Size adjustment: +deltaPerCabinet (e.g., +50mm)
                      // - Direction: Like locked from right (extend toward X negative/left)
                      // - Position: Move left by cumulative width increase of cabinets to the right
                      
                      // Calculate how many cabinets are to the right (higher indices)
                      const cabinetsToRightCount = cabinetsToRight.length - (i + 1)
                      // Each cabinet to the right increased by deltaPerCabinet
                      // Example: If #3 (1 cabinet to the right) increased by 50mm, #2 moves left by 50mm
                      const cumulativeWidthIncrease = cabinetsToRightCount * deltaPerCabinet
                      
                      // Update dimensions first
                      cab.carcass.updateDimensions({
                        width: newWidth,
                        height: cab.carcass.dimensions.height,
                        depth: cab.carcass.dimensions.depth
                      })
                      
                      // Move left by the cumulative width increase
                      // This ensures Cabinet #2 moves left by the width increase of Cabinet #3
                      const newCabX = oldCabX - cumulativeWidthIncrease
                      
                      // Clamp to wall boundaries
                      // Only clamp left boundary - right wall can be penetrated
                      const clampedX = Math.max(0, newCabX)
                      
                      console.log(`[Sync] Middle cabinet (index ${i}): oldX=${oldCabX.toFixed(2)}, cumulativeWidthIncrease=${cumulativeWidthIncrease.toFixed(2)}, newX=${newCabX.toFixed(2)}, clampedX=${clampedX.toFixed(2)}, newWidth=${newWidth.toFixed(2)}`)
                      
                      // Set position - this should move Cabinet #2 left by cumulativeWidthIncrease
                      // Use set() with all three coordinates to ensure position is updated
                      cab.group.position.set(clampedX, cab.group.position.y, cab.group.position.z)
                      
                      // Force update matrix to ensure position change is applied
                      cab.group.updateMatrixWorld(true)
                      
                      // Verify position was set correctly
                      const actualX = cab.group.position.x
                      console.log(`[Sync] Position set - Expected: ${clampedX.toFixed(2)}, Actual: ${actualX.toFixed(2)}, Difference: ${(actualX - clampedX).toFixed(2)}`)
                      
                      if (Math.abs(actualX - clampedX) > 0.1) {
                        console.warn(`[Sync] ⚠️ Position mismatch! Expected ${clampedX.toFixed(2)}, got ${actualX.toFixed(2)}`)
                      } else {
                        console.log(`[Sync] ✅ Position set correctly for middle cabinet`)
                      }
                    }
                  }
                  
                  // Calculate total width increase for left cabinets
                  const totalWidthIncrease = cabinetsToRight.length * deltaPerCabinet
                  
                  // If there are cabinets to the left of changing cabinet, shift them left too
                  if (cabinetsToLeft.length > 0) {
                    // Shift left by the total width increase of all right cabinets
                    cabinetsToLeft.forEach((cab) => {
                      const newCabX = cab.group.position.x - totalWidthIncrease
                      cab.group.position.set(
                        Math.max(0, newCabX), // Only clamp left boundary - right wall can be penetrated
                        cab.group.position.y,
                        cab.group.position.z
                      )
                    })
                  }
                } else if (cabinetsToLeft.length > 0) {
                  // All cabinets to adjust are on the left - extend right
                  // Negative delta (width decreased) means left cabinets increase width
                  // Positive delta (width increased) means left cabinets decrease width
                  const deltaPerCabinet = -widthDelta / cabinetsToLeft.length
                  
                  // Leftmost cabinet maintains left edge, others shift right
                  cabinetsToLeft.forEach((cab, index) => {
                    const newWidth = cab.carcass.dimensions.width + deltaPerCabinet
                    const oldCabX = cab.group.position.x
                    
                    // Update dimensions
                    cab.carcass.updateDimensions({
                      width: newWidth,
                      height: cab.carcass.dimensions.height,
                      depth: cab.carcass.dimensions.depth
                    })
                    
                    if (index === 0) {
                      // Leftmost: maintain left edge position (X stays same, extends right)
                      // Only clamp left boundary - right wall can be penetrated
                      const clampedX = Math.max(0, oldCabX)
                      cab.group.position.set(
                        clampedX,
                        cab.group.position.y,
                        cab.group.position.z
                      )
                    } else {
                      // Middle cabinets: shift right based on cumulative width changes from left
                      // Calculate cumulative shift from all cabinets to the left
                      let cumulativeRightShift = 0
                      for (let j = 0; j < index; j++) {
                        cumulativeRightShift += deltaPerCabinet
                      }
                      const newCabX = oldCabX + cumulativeRightShift
                      cab.group.position.set(
                        Math.max(0, newCabX), // Only clamp left boundary - right wall can be penetrated
                        cab.group.position.y,
                        cab.group.position.z
                      )
                    }
                  })
                }
                
                // Sync logic applied - skip pair system and lock system
                return
              }
              // If sync didn't apply (not enough synced cabinets selected), continue to normal logic
            }
            
            // Handle lock states and pair system (only if sync logic didn't apply)
            // Note: We're still inside the widthDelta !== 0 check from line 1560
            if (leftLock && rightLock) {
                // Both locks are active - cannot resize width
                alert("Cannot resize width when both left and right edges are locked")
                return
              } else if (leftLock) {
                // Left edge is locked - keep left edge fixed, move right edge
                // Position stays the same (left edge is frozen)
                // Just update dimensions
                selectedCabinet.carcass.updateDimensions(newDimensions)
                
                // Handle grouped cabinets (Pair system) - apply proportional width changes
                // Only apply if sync didn't apply
                const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
                if (groupData && groupData.length > 0) {
                  groupData.forEach((groupCabinet) => {
                    const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                    if (!groupedCabinet) return
                    
                    // Calculate proportional width change
                    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                    const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                    
                    // Respect lock properties of grouped cabinet
                    const groupedLeftLock = groupedCabinet.leftLock ?? false
                    const groupedRightLock = groupedCabinet.rightLock ?? false
                    
                    if (groupedLeftLock && groupedRightLock) {
                      // Both locks active - cannot resize
                      return
                    } else if (groupedLeftLock) {
                      // Left locked - extend to right
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                    } else if (groupedRightLock) {
                      // Right locked - extend to left
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedRightEdge = groupedOldX + groupedOldWidth
                      const groupedNewX = groupedRightEdge - newGroupedWidth
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    } else {
                      // Neither lock - extend equally from center
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedCenterX = groupedOldX + groupedOldWidth / 2
                      const groupedNewX = groupedCenterX - newGroupedWidth / 2
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    }
                  })
                }
                
                // If cabinet belongs to a view, move all other cabinets to the right of this one
                if (selectedCabinet.viewId && selectedCabinet.viewId !== "none" && viewManager) {
              const cabinetsInSameView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
                  const changingLeftEdge = oldX
              
              cabinetsInSameView.forEach((cabinetId) => {
                    if (cabinetId === selectedCabinet.cabinetId) return
                
                const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                if (!otherCabinet) return
                
                    // Skip if cabinets are paired
                    if (areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)) {
                      return
                    }
                
                    // Cabinet is on the RIGHT if it extends even 1mm toward positive X
                    // Check if other cabinet's left edge is to the right of changing cabinet's left edge
                    if (otherCabinet.group.position.x > changingLeftEdge) {
                      const newX = otherCabinet.group.position.x + widthDelta
                const clampedX = Math.max(
                  0,
                  Math.min(
                    wallDimensions.length - otherCabinet.carcass.dimensions.width,
                    newX
                  )
                )
                      otherCabinet.group.position.set(
                        clampedX,
                        otherCabinet.group.position.y,
                        otherCabinet.group.position.z
                      )
                    }
                  })
                }
              } else if (rightLock) {
                // Right edge is locked - keep right edge fixed, move left edge
                const rightEdge = oldX + oldWidth
                const newX = rightEdge - newDimensions.width
                
                // Update dimensions first
                selectedCabinet.carcass.updateDimensions(newDimensions)
                
                // Clamp new X position to wall bounds
                // Only clamp left boundary - right wall can be penetrated
                const clampedX = Math.max(0, newX)
                
                // Update cabinet position (move left edge)
                selectedCabinet.group.position.set(
                  clampedX,
                  selectedCabinet.group.position.y,
                  selectedCabinet.group.position.z
                )
                
                // Handle grouped cabinets - apply proportional width changes
                const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
                if (groupData && groupData.length > 0) {
                  groupData.forEach((groupCabinet) => {
                    const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                    if (!groupedCabinet) return
                    
                    // Calculate proportional width change
                    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                    const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                    
                    // Respect lock properties of grouped cabinet
                    const groupedLeftLock = groupedCabinet.leftLock ?? false
                    const groupedRightLock = groupedCabinet.rightLock ?? false
                    
                    if (groupedLeftLock && groupedRightLock) {
                      // Both locks active - cannot resize
                      return
                    } else if (groupedLeftLock) {
                      // Left locked - extend to right
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                    } else if (groupedRightLock) {
                      // Right locked - extend to left
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedRightEdge = groupedOldX + groupedOldWidth
                      const groupedNewX = groupedRightEdge - newGroupedWidth
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    } else {
                      // Neither lock - extend equally from center
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedCenterX = groupedOldX + groupedOldWidth / 2
                      const groupedNewX = groupedCenterX - newGroupedWidth / 2
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    }
                  })
                }
                
                // If cabinet belongs to a view, move all other cabinets to the left of this one
                if (selectedCabinet.viewId && selectedCabinet.viewId !== "none" && viewManager) {
                  const cabinetsInSameView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
                  const changingRightEdge = oldX + oldWidth
                  
                  cabinetsInSameView.forEach((cabinetId) => {
                    if (cabinetId === selectedCabinet.cabinetId) return
                    
                    const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                    if (!otherCabinet) return
                    
                    // Skip if cabinets are paired
                    if (areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)) {
                      return
                    }
                    
                    // Cabinet is on the LEFT if it extends even 1mm toward negative X
                    // Check if other cabinet's right edge is to the left of changing cabinet's right edge
                    if (otherCabinet.group.position.x + otherCabinet.carcass.dimensions.width < changingRightEdge) {
                      const newX = otherCabinet.group.position.x - widthDelta
                      const clampedX = Math.max(
                        0,
                        Math.min(
                          wallDimensions.length - otherCabinet.carcass.dimensions.width,
                          newX
                        )
                      )
                otherCabinet.group.position.set(
                  clampedX,
                  otherCabinet.group.position.y,
                  otherCabinet.group.position.z
                )
                    }
                  })
                }
              } else {
                // Neither lock is active - cabinet can extend/shrink by half widthDelta in both directions
                // Center position stays fixed, extends equally in both positive and negative X directions
                // Calculate center position
                const centerX = oldX + oldWidth / 2
                // Calculate new left edge position (center - half of new width)
                const newX = centerX - newDimensions.width / 2
                
                // Clamp new X position to wall bounds
                // Only clamp left boundary - right wall can be penetrated
                const clampedX = Math.max(0, newX)
                
                // Update dimensions first
                selectedCabinet.carcass.updateDimensions(newDimensions)
                
                // Update cabinet position (center remains fixed, extends equally both sides)
                selectedCabinet.group.position.set(
                  clampedX,
                  selectedCabinet.group.position.y,
                  selectedCabinet.group.position.z
                )
                
                // Handle grouped cabinets - apply proportional width changes
                const groupData = cabinetGroups.get(selectedCabinet.cabinetId)
                if (groupData && groupData.length > 0) {
                  groupData.forEach((groupCabinet) => {
                    const groupedCabinet = cabinets.find(c => c.cabinetId === groupCabinet.cabinetId)
                    if (!groupedCabinet) return
                    
                    // Calculate proportional width change
                    const proportionalDelta = (widthDelta * groupCabinet.percentage) / 100
                    const newGroupedWidth = groupedCabinet.carcass.dimensions.width + proportionalDelta
                    
                    // Respect lock properties of grouped cabinet
                    const groupedLeftLock = groupedCabinet.leftLock ?? false
                    const groupedRightLock = groupedCabinet.rightLock ?? false
                    
                    if (groupedLeftLock && groupedRightLock) {
                      // Both locks active - cannot resize
                      return
                    } else if (groupedLeftLock) {
                      // Left locked - extend to right
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                    } else if (groupedRightLock) {
                      // Right locked - extend to left
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedRightEdge = groupedOldX + groupedOldWidth
                      const groupedNewX = groupedRightEdge - newGroupedWidth
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    } else {
                      // Neither lock - extend equally from center
                      const groupedOldX = groupedCabinet.group.position.x
                      const groupedOldWidth = groupedCabinet.carcass.dimensions.width
                      const groupedCenterX = groupedOldX + groupedOldWidth / 2
                      const groupedNewX = groupedCenterX - newGroupedWidth / 2
                      
                      groupedCabinet.carcass.updateDimensions({
                        width: newGroupedWidth,
                        height: groupedCabinet.carcass.dimensions.height,
                        depth: groupedCabinet.carcass.dimensions.depth
                      })
                      
                      const clampedX = Math.max(
                        0,
                        groupedNewX // Right wall can be penetrated - no right boundary limit
                      )
                      groupedCabinet.group.position.set(
                        clampedX,
                        groupedCabinet.group.position.y,
                        groupedCabinet.group.position.z
                      )
                    }
                  })
                }
                
                // Move other cabinets in the view based on half delta
                // All cabinets on the RIGHT side move by halfDelta in positive X direction
                // All cabinets on the LEFT side move by halfDelta in negative X direction
                if (selectedCabinet.viewId && selectedCabinet.viewId !== "none" && viewManager) {
                  const cabinetsInSameView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
                  const halfDelta = widthDelta / 2
                  const changingLeftEdge = oldX
                  const changingRightEdge = oldX + oldWidth
                  
                  cabinetsInSameView.forEach((cabinetId) => {
                    if (cabinetId === selectedCabinet.cabinetId) return
                    
                    const otherCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                    if (!otherCabinet) return
                    
                    // Skip if cabinets are paired
                    if (areCabinetsPaired(selectedCabinet.cabinetId, otherCabinet.cabinetId)) {
                      return
                    }
                    
                    const otherX = otherCabinet.group.position.x
                    const otherWidth = otherCabinet.carcass.dimensions.width
                    const otherRight = otherX + otherWidth
                    
                    // Move cabinets on the LEFT side by halfDelta (negative X direction)
                    // Cabinet is on the LEFT if it extends even 1mm toward negative X
                    if (otherRight < changingRightEdge) {
                      const newX = otherCabinet.group.position.x - halfDelta
                      const clampedX = Math.max(
                        0,
                        Math.min(
                          wallDimensions.length - otherCabinet.carcass.dimensions.width,
                          newX
                        )
                      )
                otherCabinet.group.position.set(
                  clampedX,
                  otherCabinet.group.position.y,
                  otherCabinet.group.position.z
                )
                    }
                    // Move cabinets on the RIGHT side by halfDelta (positive X direction)
                    // Cabinet is on the RIGHT if it extends even 1mm toward positive X
                    else if (otherX > changingLeftEdge) {
                      const newX = otherCabinet.group.position.x + halfDelta
                      const clampedX = Math.max(
                        0,
                        Math.min(
                          wallDimensions.length - otherCabinet.carcass.dimensions.width,
                          newX
                        )
                      )
                      otherCabinet.group.position.set(
                        clampedX,
                        otherCabinet.group.position.y,
                        otherCabinet.group.position.z
                      )
                    }
                  })
                }
              }
            } else {
              // Width didn't change, just update other dimensions
              selectedCabinet.carcass.updateDimensions(newDimensions)
            }
          }
        }}
        onMaterialChange={(materialChanges) => {
          if (selectedCabinet) {
            // Update the material properties and rebuild the carcass
            selectedCabinet.carcass.updateMaterialProperties(materialChanges);
          }
        }}
        onKickerHeightChange={(kickerHeight) => {
          if (selectedCabinet) {
            // Update the kicker height and reposition the cabinet
            selectedCabinet.carcass.updateKickerHeight(kickerHeight);
          }
        }}
        onDoorToggle={(enabled) => {
          if (selectedCabinet) {
            // Toggle doors on/off
            selectedCabinet.carcass.toggleDoors(enabled);
          }
        }}
        onDoorMaterialChange={(materialChanges) => {
          if (selectedCabinet) {
            // Update door material properties
            const doorMaterial = new DoorMaterial({
              colour: materialChanges.colour || selectedCabinet.carcass.config.doorMaterial?.getColour() || '#ffffff',
              thickness: materialChanges.thickness || selectedCabinet.carcass.config.doorMaterial?.getThickness() || 18,
              opacity: 0.9,
              transparent: true
            });
            selectedCabinet.carcass.updateDoorMaterial(doorMaterial);
          }
        }}
        onDoorCountChange={(count) => {
          if (selectedCabinet) {
            // Update door count
            selectedCabinet.carcass.updateDoorConfiguration(count);
          }
        }}
        onOverhangDoorToggle={(overhang) => {
          if (selectedCabinet) {
            // Update overhang door setting
            selectedCabinet.carcass.updateOverhangDoor(overhang);
          }
        }}
        onDrawerToggle={(enabled) => {
          if (selectedCabinet) {
            console.log('Toggling drawer enabled:', enabled);

            // Toggle drawers on/off directly on the carcass
            selectedCabinet.carcass.updateDrawerEnabled(enabled);

            // Trigger re-render without extending type
            setSelectedCabinet({ ...selectedCabinet })
          }
        }}
        onDrawerQuantityChange={(quantity) => {
          if (selectedCabinet) {
            console.log('Updating drawer quantity:', quantity);

            // Update drawer quantity directly on the carcass
            selectedCabinet.carcass.updateDrawerQuantity(quantity);

            // Trigger re-render
            setSelectedCabinet({ ...selectedCabinet })
          }
        }}
        onDrawerHeightChange={(index, height) => {
          if (selectedCabinet) {
            console.log('Updating drawer height:', index, height);

            // Update individual drawer height directly on the carcass
            selectedCabinet.carcass.updateDrawerHeight(index, height);

            // Trigger re-render
            setSelectedCabinet({ ...selectedCabinet })
          }
        }}
        onDrawerHeightsBalance={() => {
          if (selectedCabinet) {
            console.log('Balancing drawer heights');

            // Balance drawer heights directly on the carcass
            selectedCabinet.carcass.balanceDrawerHeights();

            // Trigger re-render
            setSelectedCabinet({ ...selectedCabinet })
          }
        }}
        onDrawerHeightsReset={() => {
          if (selectedCabinet) {
            console.log('Resetting drawer heights to optimal');

            // Get optimal drawer heights from the carcass
            const optimalHeights = selectedCabinet.carcass.getOptimalDrawerHeights();

            // Reset drawer heights directly on the carcass and force update via public API
            selectedCabinet.carcass.config.drawerHeights = [...optimalHeights]
            const qty = selectedCabinet.carcass.config.drawerQuantity || optimalHeights.length
            selectedCabinet.carcass.updateDrawerQuantity(qty)

            // Trigger re-render
            setSelectedCabinet({ ...selectedCabinet })
          }
        }}
      />

      {/* Save Modal */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveRoom}
        currentRoom={currentRoom}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setCabinetToDelete(null)
        }}
        onConfirm={() => {
          if (cabinetToDelete) {
            handleDeleteCabinet(cabinetToDelete, {
              viewManager,
              setCabinetGroups,
              deleteCabinet,
              setCabinetToDelete
            })
          }
        }}
        itemName="the selected cabinet"
      />

      {/* SAVE Button - Left Bottom Corner */}
      <button
        onClick={() => setShowSaveModal(true)}
        className="fixed bottom-4 left-4 z-50 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
      >
        SAVE
      </button>
    </div>
  );
};

export default WallScene;
