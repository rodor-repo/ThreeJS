import { DoorMaterial } from '@/features/carcass'
import { Subcategory } from '@/components/categoriesData'
import { Settings, ShoppingCart, Undo, Redo, Flag, History, Clock, Trash2 } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useCabinets } from '../cabinets/hooks/useCabinets'
import { useViewManager } from '../cabinets/hooks/useViewManager'
import { CabinetLockIcons } from './ui/CabinetLockIcons'
import ProductPanel from '../cabinets/ui/ProductPanel'
import { cabinetPanelState } from '../cabinets/ui/ProductPanel'
import { useRoomPersistence } from './hooks/useRoomPersistence'
import { useUndoRedo } from './hooks/useUndoRedo'
import { useCameraDrag } from './hooks/useCameraDrag'
import { useSceneInteractions } from './hooks/useSceneInteractions'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useDimensionLines } from './hooks/useDimensionLines'
import { useCabinetNumbers } from './hooks/useCabinetNumbers'
import { useThreeRenderer } from './hooks/useThreeRenderer'
import { useScenePanels, DEFAULT_WALL_COLOR } from './hooks/useScenePanels'
import { useWallsAutoAdjust } from './hooks/useWallsAutoAdjust'
import { useProductDrivenCreation } from './hooks/useProductDrivenCreation'
import type { Category, WallDimensions as WallDims } from './types'
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
  const [cameraMode, setCameraMode] = useState<'constrained' | 'free'>('constrained')
  const [dimensionsVisible, setDimensionsVisible] = useState(true)
  const [numbersVisible, setNumbersVisible] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'admin' | 'user'>('user') // Radio button selection
  // Cabinet groups: Map of cabinetId -> array of { cabinetId, percentage }
  const [cabinetGroups, setCabinetGroups] = useState<Map<string, Array<{ cabinetId: string; percentage: number }>>>(new Map())
  // Cabinet sync relationships: Map of cabinetId -> array of synced cabinetIds
  const [cabinetSyncs, setCabinetSyncs] = useState<Map<string, string[]>>(new Map())

  const {
    sceneRef,
    cameraRef,
    wallRef,
    leftWallRef,
    rightWallRef,
    resetCamera,
    setCameraXView,
    setCameraYView,
    setCameraZView,
    applyDimensions
  } = useThreeRenderer(mountRef, wallDimensions, DEFAULT_WALL_COLOR, onDimensionsChange)

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

  const cameraDrag = useCameraDrag(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
    cameraMode
  )
  const { isDragging, zoomLevel } = cameraDrag

  const {
    wallColor,
    setWallColor,
    showSettingsSidebar,
    showWallDrawer,
    showViewsDrawer,
    showViewDrawer,
    showSaveModal,
    showDeleteModal,
    selectedViewId,
    cabinetToDelete,
    setCabinetToDelete,
    openSettings,
    closeSettings,
    openWallDrawer,
    closeWallDrawer,
    closeViewsDrawer,
    openViewDrawer,
    closeViewDrawer,
    openSaveModal,
    closeSaveModal,
    requestDelete,
    closeDeleteModal,
    handleApplyWallSettings,
  } = useScenePanels({
    showProductPanel,
    isMenuOpen: isMenuOpen || false,
    applyDimensions,
    initialWallColor: DEFAULT_WALL_COLOR,
  })

  const handleWallClick = useCallback(() => {
    openWallDrawer()
  }, [openWallDrawer])

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
      // You can add logic here to handle different categories
      // For example, load different 3D models, change materials, etc.
    }
  }, [selectedCategory]);

  useProductDrivenCreation({
    selectedSubcategory,
    selectedProductId,
    wsProducts,
    sceneRef,
    createCabinet,
    setSelectedCabinet,
  })

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
  const applyWallSettingsWithZoom = (dims: WallDims, color: string) => {
    handleApplyWallSettings(dims, color, zoomLevel)
  }

  // view helpers provided by useThreeRenderer

  const { currentRoom, saveRoom: handleSaveRoom, loadRoom } = useRoomPersistence({
    cabinets,
    cabinetGroups,
    setCabinetGroups,
    cabinetSyncs,
    setCabinetSyncs,
    wallDimensions,
    wallColor,
    setWallColor,
    applyDimensions,
    viewManager,
    wsProducts,
    setNumbersVisible,
    clearCabinets,
    createCabinet,
    updateCabinetViewId,
    updateCabinetLock,
    onLoadRoomReady: undefined, // We handle this manually below to reset history
  })

  const { undo, redo, canUndo, canRedo, createCheckpoint, deleteCheckpoint, resetHistory, past, future, jumpTo } = useUndoRedo({
    cabinets,
    cabinetGroups,
    setCabinetGroups,
    cabinetSyncs,
    setCabinetSyncs,
    wallDimensions,
    wallColor,
    setWallColor,
    applyDimensions,
    viewManager,
    wsProducts,
    setNumbersVisible,
    clearCabinets,
    createCabinet,
    updateCabinetViewId,
    updateCabinetLock,
  })

  // Handle room loading and history reset
  useEffect(() => {
    if (onLoadRoomReady) {
      onLoadRoomReady(async (room) => {
        await loadRoom(room)
        resetHistory(room)
      })
    }
  }, [onLoadRoomReady, loadRoom, resetHistory])

  useWallsAutoAdjust({
    cabinets,
    wallDimensions,
    viewManager: viewManager.viewManager,
    applyDimensions,
    zoomLevel,
  })

  const handleSettingsClick = () => {
    openSettings()
  }

  // Calculate total price of all cabinets
  const totalPrice = useMemo(() => {
    return cabinets.reduce((sum, cabinet) => {
      const panelState = cabinetPanelState.get(cabinet.cabinetId)
      const price = panelState?.price?.amount ?? 0
      return sum + price
    }, 0)
  }, [cabinets])

  // When the product panel opens for a selected cabinet, try loading its WsProduct config

  const [showHistory, setShowHistory] = useState(false)
  const [historyTab, setHistoryTab] = useState<'manual' | 'auto'>('manual')
  const [isCheckpointed, setIsCheckpointed] = useState(false)

  const handleCreateCheckpoint = () => {
    createCheckpoint()
    setIsCheckpointed(true)
    setTimeout(() => setIsCheckpointed(false), 1000)
  }

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
        onClose={closeSettings}
        onWallClick={handleWallClick}
        onViewClick={(viewId) => {
          openViewDrawer(viewId)
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
            applyDimensions({
              ...wallDimensions,
              rightWallViewId: undefined,
            }, undefined, zoomLevel)
          }

          // Delete the view from ViewManager
          viewManager.deleteView(viewId as ViewId)
        }}
        activeViews={viewManager.activeViews}
      />

      {/* Wall Settings Drawer */}
      <WallSettingsDrawer
        isOpen={showWallDrawer}
        onClose={closeWallDrawer}
        wallDimensions={wallDimensions}
        wallColor={wallColor}
        activeViews={viewManager.activeViews}
        cabinets={cabinets}
        viewManager={viewManager.viewManager}
        onApply={applyWallSettingsWithZoom}
      />

      {/* Views List Drawer - Shows list of all views */}
      <ViewsListDrawer
        isOpen={showViewsDrawer}
        onClose={closeViewsDrawer}
        activeViews={viewManager.activeViews}
        onViewClick={(_viewId) => {
          // Could add view-specific settings here in the future
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
            applyDimensions({
              ...wallDimensions,
              rightWallViewId: undefined,
            }, undefined, zoomLevel)
          }

          // Delete the view from ViewManager
          viewManager.deleteView(viewId as ViewId)
        }}
      />

      {/* View Detail Drawer - Shows settings and details for selected view */}
      {selectedViewId && (
        <ViewDetailDrawer
          isOpen={showViewDrawer}
          onClose={closeViewDrawer}
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
            requestDelete(selectedCabinet)
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
          viewId: selectedCabinet.viewId,
          carcass: selectedCabinet.carcass
        } : null}
        viewManager={viewManager}
        allCabinets={cabinets}
        initialGroupData={selectedCabinet ? (cabinetGroups.get(selectedCabinet.cabinetId) || []) : []}
        initialSyncData={selectedCabinet ? (cabinetSyncs.get(selectedCabinet.cabinetId) || []) : []}
        onSyncChange={(cabinetId, syncCabinets) => {
          // Update cabinet syncs map with bidirectional sync
          setCabinetSyncs(prev => {
            const newMap = new Map(prev)
            const oldSyncList = prev.get(cabinetId) || []

            // Find added and removed cabinets
            const addedCabinets = syncCabinets.filter(id => !oldSyncList.includes(id))
            const removedCabinets = oldSyncList.filter(id => !syncCabinets.includes(id))

            // Update the current cabinet's sync list
            if (syncCabinets.length === 0) {
              newMap.delete(cabinetId)
            } else {
              newMap.set(cabinetId, syncCabinets)
            }

            // Bidirectional: add current cabinet to newly synced cabinets' lists
            for (const addedId of addedCabinets) {
              const otherSyncList = newMap.get(addedId) || []
              if (!otherSyncList.includes(cabinetId)) {
                newMap.set(addedId, [...otherSyncList, cabinetId])
              }
            }

            // Bidirectional: remove current cabinet from unsynced cabinets' lists
            for (const removedId of removedCabinets) {
              const otherSyncList = newMap.get(removedId) || []
              const updatedList = otherSyncList.filter(id => id !== cabinetId)
              if (updatedList.length === 0) {
                newMap.delete(removedId)
              } else {
                newMap.set(removedId, updatedList)
              }
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
          // Update cabinet groups map with bidirectional pairing
          setCabinetGroups(prev => {
            const newMap = new Map(prev)
            const oldGroupList = prev.get(cabinetId) || []

            // Find added and removed cabinets
            const oldCabinetIds = oldGroupList.map(g => g.cabinetId)
            const newCabinetIds = groupCabinets.map(g => g.cabinetId)
            const addedCabinets = newCabinetIds.filter(id => !oldCabinetIds.includes(id))
            const removedCabinets = oldCabinetIds.filter(id => !newCabinetIds.includes(id))

            // Update the current cabinet's group list
            if (groupCabinets.length === 0) {
              newMap.delete(cabinetId)
            } else {
              newMap.set(cabinetId, groupCabinets)
            }

            // Helper to recalculate percentages evenly
            const recalculatePercentages = (group: Array<{ cabinetId: string; percentage: number }>) => {
              if (group.length === 0) return group
              const equalPercentage = 100 / group.length
              const adjusted = group.map(g => ({ ...g, percentage: Math.round(equalPercentage * 100) / 100 }))
              const total = adjusted.reduce((sum, g) => sum + g.percentage, 0)
              if (total !== 100 && adjusted.length > 0) {
                adjusted[0].percentage += 100 - total
              }
              return adjusted
            }

            // Bidirectional: add current cabinet to newly paired cabinets' lists
            for (const addedId of addedCabinets) {
              const otherGroupList = newMap.get(addedId) || []
              if (!otherGroupList.find(g => g.cabinetId === cabinetId)) {
                const updatedGroup = recalculatePercentages([...otherGroupList, { cabinetId, percentage: 0 }])
                newMap.set(addedId, updatedGroup)
              }
            }

            // Bidirectional: remove current cabinet from unpaired cabinets' lists
            for (const removedId of removedCabinets) {
              const otherGroupList = newMap.get(removedId) || []
              const updatedList = otherGroupList.filter(g => g.cabinetId !== cabinetId)
              if (updatedList.length === 0) {
                newMap.delete(removedId)
              } else {
                newMap.set(removedId, recalculatePercentages(updatedList))
              }
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

            // Toggle drawers on/off directly on the carcass
            selectedCabinet.carcass.updateDrawerEnabled(enabled);

            // Trigger re-render while preserving multi-selection
            setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
          }
        }}
        onDrawerQuantityChange={(quantity) => {
          if (selectedCabinet) {

            // Update drawer quantity directly on the carcass
            selectedCabinet.carcass.updateDrawerQuantity(quantity);

            // Trigger re-render while preserving multi-selection
            setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
          }
        }}
        onDrawerHeightChange={(index, height, changedId) => {
          if (selectedCabinet) {

            // Update individual drawer height directly on the carcass
            selectedCabinet.carcass.updateDrawerHeight(index, height, changedId);

            // Trigger re-render while preserving multi-selection
            setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
          }
        }}
        onDrawerHeightsBalance={() => {
          if (selectedCabinet) {

            // Balance drawer heights directly on the carcass
            selectedCabinet.carcass.balanceDrawerHeights();

            // Trigger re-render while preserving multi-selection
            setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
          }
        }}
        onDrawerHeightsReset={() => {
          if (selectedCabinet) {

            // Get optimal drawer heights from the carcass
            const optimalHeights = selectedCabinet.carcass.getOptimalDrawerHeights();

            // Reset drawer heights directly on the carcass and force update via public API
            selectedCabinet.carcass.config.drawerHeights = [...optimalHeights]
            const qty = selectedCabinet.carcass.config.drawerQuantity || optimalHeights.length
            selectedCabinet.carcass.updateDrawerQuantity(qty)

            // Trigger re-render while preserving multi-selection
            setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
          }
        }}
      />

      {/* Save Modal */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={closeSaveModal}
        onSave={handleSaveRoom}
        currentRoom={currentRoom}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={() => {
          if (cabinetToDelete) {
            handleDeleteCabinet(cabinetToDelete, {
              viewManager,
              setCabinetGroups,
              deleteCabinet,
              setCabinetToDelete
            })
            closeDeleteModal()
          }
        }}
        itemName="the selected cabinet"
      />

      {/* Undo/Redo Buttons - Bottom Left (above Save) */}
      <div className="fixed bottom-20 left-4 z-50 flex gap-2 items-end">
        {/* History List Popover */}
        {showHistory && (past.length > 0 || future.length > 0) && (
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-72 max-h-80 overflow-hidden z-50 flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <History size={14} />
                Checkpoint History
              </h3>
              <div className="flex bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setHistoryTab('manual')}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${historyTab === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setHistoryTab('auto')}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${historyTab === 'auto' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Auto
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {[...past, ...future]
                .map((room, index) => ({ room, index }))
                .filter(({ room }) => room.type === historyTab || (historyTab === 'manual' && !room.type))
                .map(({ room, index }, displayIndex) => {
                  const isFuture = index >= past.length
                  const currentIndex = past.length - 1
                  const isActive = index === currentIndex

                  return (
                    <div
                      key={room.id || index}
                      className={`px-4 py-2 border-b border-gray-50 last:border-0 flex items-center justify-between cursor-pointer transition-colors duration-150 group
                        ${isActive ? 'bg-blue-50 text-blue-700' : ''}
                        ${!isActive && isFuture ? 'text-gray-400 hover:bg-gray-50' : ''}
                        ${!isActive && !isFuture ? 'text-gray-600 hover:bg-gray-50' : ''}
                      `}
                    >
                      <div
                        className="flex-1 flex items-center justify-between"
                        onClick={() => {
                          jumpTo(index)
                          // Keep history open when jumping
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isActive && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                          <span className={`font-medium ${isActive ? 'font-bold' : ''}`}>
                            {room.type === 'auto' ? 'Auto-Save' : `Checkpoint ${displayIndex + 1}`}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(room.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Delete button for manual checkpoints */}
                      {room.type === 'manual' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCheckpoint(index)
                          }}
                          className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete Checkpoint"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )
                }).reverse()}

              {/* Empty state message */}
              {[...past, ...future].filter(r => (r.type === historyTab || (historyTab === 'manual' && !r.type))).length === 0 && (
                <div className="p-4 text-center text-gray-400 text-xs">
                  No {historyTab} checkpoints found
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${canUndo
            ? 'bg-white text-gray-700 hover:bg-gray-100'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          title="Undo"
        >
          <Undo size={20} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${canRedo
            ? 'bg-white text-gray-700 hover:bg-gray-100'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          title="Redo"
        >
          <Redo size={20} />
        </button>

        <div className="relative flex gap-2">
          <button
            onClick={handleCreateCheckpoint}
            className={`p-3 rounded-full shadow-lg transition-all duration-500 ${isCheckpointed
              ? 'bg-green-500 text-white scale-110 ring-4 ring-green-200'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            title="Create Checkpoint"
          >
            <Flag size={20} className={isCheckpointed ? 'animate-bounce' : ''} />
          </button>

          {(past.length > 0 || future.length > 0) && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${showHistory ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              title="View History"
            >
              <History size={20} />
            </button>
          )}
        </div>
      </div>

      {/* SAVE Button - Left Bottom Corner */}
      <button
        onClick={openSaveModal}
        className="fixed bottom-4 left-4 z-50 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
      >
        SAVE
      </button>
    </div>
  );
};

export default WallScene;
