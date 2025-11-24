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
import { handleViewDimensionChange } from './utils/handlers/viewDimensionHandler'
import { handleSplashbackHeightChange } from './utils/handlers/splashbackHandler'
import { handleProductDimensionChange } from './utils/handlers/productDimensionHandler'
import { handleDeleteCabinet } from './utils/handlers/deleteCabinetHandler'

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
            handleViewDimensionChange(gdId, newValue, productDataMap, {
              cabinets,
              cabinetGroups,
              viewManager,
              wallDimensions
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
            handleProductDimensionChange(
              newDimensions,
              {
                selectedCabinet,
                cabinets,
                cabinetSyncs,
                selectedCabinets,
                cabinetGroups,
                viewManager,
                wallDimensions
              }
            )
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
