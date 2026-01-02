import { DoorMaterial } from '@/features/carcass'
import { Subcategory } from '@/components/categoriesData'
import { debounce } from 'lodash'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useCabinets } from '../cabinets/hooks/useCabinets'
import { useViewManager } from '../cabinets/hooks/useViewManager'
import { CabinetLockIcons } from './ui/CabinetLockIcons'
import ProductPanel from '../cabinets/ui/ProductPanel'
import AppliancePanel from '../cabinets/ui/AppliancePanel'
import { useRoomPersistence } from './hooks/useRoomPersistence'
import { useUndoRedo } from './hooks/useUndoRedo'
import { useCameraDrag } from './hooks/useCameraDrag'
import { useSceneInteractions } from './hooks/useSceneInteractions'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useDimensionLinesEnhanced } from './hooks/useDimensionLinesEnhanced'
import { useCabinetNumbers } from './hooks/useCabinetNumbers'
import { useThreeRenderer } from './hooks/useThreeRenderer'
import { useScenePanels, DEFAULT_WALL_COLOR } from './hooks/useScenePanels'
import { useWallsAutoAdjust } from './hooks/useWallsAutoAdjust'
import { useProductDrivenCreation } from './hooks/useProductDrivenCreation'
import type { Category, WallDimensions as WallDims, CabinetData } from './types'
import { CameraControls } from './ui/CameraControls'
import { SettingsSidebar } from './ui/SettingsSidebar'
import { WallSettingsDrawer } from './ui/WallSettingsDrawer'
import { ViewsListDrawer } from './ui/ViewsListDrawer'
import { ViewDetailDrawer } from './ui/ViewDetailDrawer'
import { ProductsListDrawer } from './ui/ProductsListDrawer'
import { SaveModal } from './ui/SaveModal'
import { DeleteConfirmationModal } from './ui/DeleteConfirmationModal'
import { AddToCartModal } from './ui/AddToCartModal'
import { NestingModal } from './ui/NestingModal'
import { WsProducts, WsRooms } from '@/types/erpTypes'
import type { ViewId } from '../cabinets/ViewManager'
import { exportPartsToCSV } from '@/nesting/ExportPartExcel'
import { usePartData } from '@/nesting/usePartData'
import { handleViewDimensionChange } from './utils/handlers/viewDimensionHandler'
import { handleSplashbackHeightChange } from './utils/handlers/splashbackHandler'
import { handleKickerHeightChange } from './utils/handlers/kickerHeightHandler'
import { handleProductDimensionChange, getWidthConstraints } from './utils/handlers/productDimensionHandler'
import { handleDeleteCabinet } from './utils/handlers/deleteCabinetHandler'
import { updateAllDependentComponents } from './utils/handlers/dependentComponentsHandler'
import { handleFillerSelect as handleFillerSelectHandler, handleFillerToggle as handleFillerToggleHandler } from './utils/handlers/fillerHandler'
import {
  handleKickerSelect as handleKickerSelectHandler,
  handleKickerToggle as handleKickerToggleHandler
} from './utils/handlers/kickerHandler'
import {
  handleBulkheadSelect as handleBulkheadSelectHandler,
  handleBulkheadToggle as handleBulkheadToggleHandler
} from './utils/handlers/bulkheadHandler'
import {
  handleUnderPanelSelect as handleUnderPanelSelectHandler,
  handleUnderPanelToggle as handleUnderPanelToggleHandler
} from './utils/handlers/underPanelHandler'
import {
  handleBenchtopSelect as handleBenchtopSelectHandler,
  handleBenchtopToggle as handleBenchtopToggleHandler
} from './utils/handlers/benchtopHandler'
import { collectCartItems } from './utils/cartUtils'
import { addToCart } from '@/server/addToCart'
import { useSaveUserRoom, useLoadUserRoom } from '@/hooks/useUserRoomsQuery'
import toast from 'react-hot-toast'
import { useWallTransparency } from './hooks/useWallTransparency'
import { useAllCabinetPrices } from './hooks/useAllCabinetPrices'
import { ModeToggle } from './ui/ModeToggle'
import { CartSection } from './ui/CartSection'
import { BottomRightActions } from './ui/BottomRightActions'
import { HistoryControls } from './ui/HistoryControls'
import { SaveButton } from './ui/SaveButton'
import { DimensionLineControls } from './ui/DimensionLineControls'
import type { AppMode } from './context/ModeContext'
import { UserWidthSlider } from './ui/UserWidthSlider'
import { UserRoomsModal } from './ui/UserRoomsModal'
import { SaveRoomModal } from './ui/SaveRoomModal'
import { serializeRoom } from './utils/roomPersistenceUtils'
import type { UserSavedRoom, RoomCategory, SavedRoom } from '@/types/roomTypes'

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
  onLoadRoomReady?: (loadRoom: (savedRoom: SavedRoom) => Promise<void>) => void
  /** Selected appliance type from menu */
  selectedApplianceType?: 'dishwasher' | 'washingMachine' | 'sideBySideFridge' | null
  /** Callback when appliance is created */
  onApplianceCreated?: () => void
  /** Currently selected room URL slug */
  currentRoomUrl?: string | null
  /** Currently selected room ID (resolved from room url) */
  currentRoomId?: string | null
  /** WsRooms config from Firestore - contains room categories and entries */
  wsRooms?: WsRooms | null
  /** Current app mode - admin or user */
  selectedMode: AppMode
  /** Callback when mode changes */
  setSelectedMode: (mode: AppMode) => void
  /** Authenticated user email for display */
  userEmail?: string | null
  /** Authenticated user role */
  userRole?: AppMode | null
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false, selectedProductId, wsProducts, onLoadRoomReady, selectedApplianceType, onApplianceCreated, currentRoomUrl, currentRoomId, wsRooms, selectedMode, setSelectedMode, userEmail, userRole }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'constrained' | 'free'>('constrained')
  const [dimensionsVisible, setDimensionsVisible] = useState(true)
  const [numbersVisible, setNumbersVisible] = useState(false)
  // Use prop if provided, otherwise use internal state (for backward compatibility)
  // const [internalMode, setInternalMode] = useState<AppMode>('admin')
  // const selectedMode = selectedModeProp ?? internalMode
  // const setSelectedMode = onModeChange ?? setInternalMode
  const [isOrthoView, setIsOrthoView] = useState(false) // Track ortho view state for UI
  const [cameraViewMode, setCameraViewMode] = useState<'x' | 'y' | 'z' | null>(null) // Track which ortho view is active
  const [showProductsDrawer, setShowProductsDrawer] = useState(false) // Control products list drawer
  const [showNestingModal, setShowNestingModal] = useState(false) // Control nesting modal
  const [showUserRoomsModal, setShowUserRoomsModal] = useState(false) // Control user rooms modal
  const [showSaveRoomModal, setShowSaveRoomModal] = useState(false) // Control save room modal
  const [isSavingRoom, setIsSavingRoom] = useState(false) // Track save room loading state
  // User room state: tracks if we're editing a previously saved user room
  const [currentUserRoom, setCurrentUserRoom] = useState<UserSavedRoom | null>(null)
  // Cabinet groups: Map of cabinetId -> array of { cabinetId, percentage }
  const [cabinetGroups, setCabinetGroups] = useState<Map<string, Array<{ cabinetId: string; percentage: number }>>>(new Map())
  // Cabinet sync relationships: Map of cabinetId -> array of synced cabinetIds
  const [cabinetSyncs, setCabinetSyncs] = useState<Map<string, string[]>>(new Map())
  // Version counter that increments when cabinet dimensions change to trigger wall adjustments
  const [dimensionVersion, setDimensionVersion] = useState(0)
  // Debounced increment to avoid excessive updates when slider is being dragged
  const debouncedIncrementDimensionVersion = useMemo(
    () => debounce(() => setDimensionVersion(v => v + 1), 300),
    []
  )

  const {
    sceneRef,
    cameraRef,
    orthoCameraRef,
    wallRef,
    leftWallRef,
    rightWallRef,
    resetCamera,
    resetToPerspective,
    isOrthoActiveRef,
    zoomOrthoCamera,
    panOrthoCamera,
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

  // Part data manager - tracks all part dimensions (X, Y, Z) for export
  // Automatically updates when cabinets array changes
  const partData = usePartData(cabinets, wsProducts)

  // Price calculation for all cabinets
  // Proactively calculates prices without needing to open ProductPanel
  const {
    isCalculating: isPriceCalculating,
    totalPrice,
    cabinetPrices,
    isCabinetCalculating,
    cabinetErrors,
  } = useAllCabinetPrices({
    cabinets,
    enabled: true,
  })

  // User room mutations (React Query)
  const saveUserRoomMutation = useSaveUserRoom()
  const loadUserRoomMutation = useLoadUserRoom()

  // Snap guides for visual feedback during cabinet dragging
  const { updateSnapGuides, clearSnapGuides } = useSnapGuides(sceneRef, wallDimensions)

  // Dimension lines for showing cabinet measurements with interaction support
  const {
    selectedDimLineId,
    hasModifications: hasDimLineModifications,
    hideSelected: hideDimLine,
    resetAllLines: resetDimLines,
  } = useDimensionLinesEnhanced({
    sceneRef,
    cameraRef,
    orthoCameraRef,
    isOrthoActiveRef,
    canvasRef: mountRef,
    cabinets,
    visible: dimensionsVisible,
    viewManager: viewManager.viewManager,
    wallDimensions,
    cameraViewMode,
  })

  // Cabinet numbering system
  useCabinetNumbers(sceneRef, cabinets, numbersVisible)

  const cameraDrag = useCameraDrag(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
    cameraMode,
    { isOrthoActiveRef, zoomOrthoCamera, panOrthoCamera }
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
    setCabinetWithLockIcons,
    dragEndVersion
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
    handleWallClick,
    { isOrthoActiveRef, orthoCameraRef }, // orthoRefs
    selectedMode
  )

  useWallTransparency({
    cameraViewMode,
    wallRef,
    leftWallRef,
    rightWallRef,
    sceneRef,
    wallDimensions
  })

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

  // Handle appliance creation from menu
  useEffect(() => {
    if (!selectedApplianceType || !sceneRef.current) return

    // Create appliance cabinet with synthetic productId
    const cabinet = createCabinet("appliance", "appliance", {
      productId: `appliance-${selectedApplianceType}`,
      applianceType: selectedApplianceType,
    })

    if (cabinet) {
      // Auto-select the new appliance
      setSelectedCabinet(cabinet)
      setShowProductPanel(true)  // Will show AppliancePanel due to type check
    }

    // Notify parent that appliance was created
    onApplianceCreated?.()
  }, [selectedApplianceType, sceneRef, createCabinet, setSelectedCabinet, setShowProductPanel, onApplianceCreated])

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

  const { currentRoom: _currentRoom, currentRoomName, isSaving, saveRoom: handleSaveRoom, loadRoom } = useRoomPersistence({
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
    currentRoomUrl,
    currentRoomId,
    wsRooms,
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
    positionVersion: dragEndVersion + dimensionVersion,
  })

  const handleSettingsClick = () => {
    openSettings()
  }

  // totalPrice is now provided by useAllCabinetPrices hook

  // When the product panel opens for a selected cabinet, try loading its WsProduct config


  // Handle filler selection and creation
  const handleFillerSelect = useCallback((cabinetId: string, productId: string, side: 'left' | 'right') => {
    handleFillerSelectHandler(cabinetId, productId, side, {
      cabinets,
      wsProducts,
      sceneRef,
      createCabinet,
      updateCabinetViewId,
      updateCabinetLock,
      wallDimensions
    })
  }, [cabinets, wsProducts, sceneRef, createCabinet, updateCabinetViewId, updateCabinetLock, wallDimensions])

  const handleFillerToggle = useCallback((cabinetId: string, side: 'left' | 'right', enabled: boolean) => {
    handleFillerToggleHandler(cabinetId, side, enabled, {
      cabinets,
      wallDimensions,
      viewManager,
      setCabinetGroups,
      deleteCabinet,
      setCabinetToDelete,
      removeCabinetParts: partData.removeCabinet
    })
  }, [cabinets, wallDimensions, viewManager, setCabinetGroups, deleteCabinet, setCabinetToDelete, partData.removeCabinet])

  // Handle kicker selection from modal - creates kicker with proper product association
  const handleKickerSelect = useCallback((cabinetId: string, productId: string) => {
    handleKickerSelectHandler(cabinetId, productId, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  // Handle kicker face removal for a specific cabinet
  // Note: Kicker creation is handled by handleKickerSelect with product association
  const handleKickerToggle = useCallback((cabinetId: string, enabled: boolean) => {
    handleKickerToggleHandler(cabinetId, enabled, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  // Handle bulkhead removal for base, overhead and tall cabinets
  const handleBulkheadToggle = useCallback((cabinetId: string, enabled: boolean) => {
    handleBulkheadToggleHandler(cabinetId, enabled, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet,
      wallDimensions
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet, wallDimensions])

  // Handle underPanel removal for top cabinets
  const handleUnderPanelToggle = useCallback((cabinetId: string, enabled: boolean) => {
    handleUnderPanelToggleHandler(cabinetId, enabled, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  // Handle underPanel selection from modal
  const handleUnderPanelSelect = useCallback((cabinetId: string, productId: string) => {
    handleUnderPanelSelectHandler(cabinetId, productId, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  // Handle benchtop removal for base cabinets
  const handleBenchtopToggle = useCallback((cabinetId: string, enabled: boolean) => {
    handleBenchtopToggleHandler(cabinetId, enabled, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  // Handle benchtop selection - creates benchtop with proper product association
  const handleBenchtopSelect = useCallback((cabinetId: string, productId: string | null) => {
    handleBenchtopSelectHandler(cabinetId, productId, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet])

  const handleBenchtopOverhangChange = useCallback((cabinetId: string, type: 'front' | 'left' | 'right', value: number) => {
    const benchtopCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!benchtopCabinet || benchtopCabinet.cabinetType !== 'benchtop') return

    // Update the overhang value on the CabinetData (for persistence)
    if (type === 'front') {
      benchtopCabinet.benchtopFrontOverhang = value
    } else if (type === 'left') {
      benchtopCabinet.benchtopLeftOverhang = value
    } else if (type === 'right') {
      benchtopCabinet.benchtopRightOverhang = value
    }

    // If front overhang changed, recalculate and update depth
    if (type === 'front') {
      const parentCabinet = cabinets.find(c => c.cabinetId === benchtopCabinet.benchtopParentCabinetId)
      const parentDepth = parentCabinet?.carcass.dimensions.depth ?? 600
      const FIXED_DEPTH_EXTENSION = 20
      const newDepth = parentDepth + FIXED_DEPTH_EXTENSION + value
      benchtopCabinet.carcass.dimensions.depth = newDepth
    }

    // Use CarcassAssembly method to update the benchtop mesh
    benchtopCabinet.carcass.updateBenchtopOverhangs(
      benchtopCabinet.benchtopFrontOverhang,
      benchtopCabinet.benchtopLeftOverhang,
      benchtopCabinet.benchtopRightOverhang
    )

    // Update position after overhang change
    const parentCabinet = cabinets.find(c => c.cabinetId === benchtopCabinet.benchtopParentCabinetId)
    if (parentCabinet) {
      updateAllDependentComponents(parentCabinet, cabinets, wallDimensions, {
        widthChanged: true,
        heightChanged: true,
        depthChanged: true
      })
    }

    // Trigger re-render to update UI snapshots
    setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
  }, [cabinets, wallDimensions, setSelectedCabinets])

  const handleBenchtopThicknessChange = useCallback((cabinetId: string, value: number) => {
    const benchtopCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!benchtopCabinet || benchtopCabinet.cabinetType !== 'benchtop') return

    // Only for child benchtops (have a parent)
    if (!benchtopCabinet.benchtopParentCabinetId) return

    // Clamp value between 20 and 60
    const clampedValue = Math.max(20, Math.min(60, value))

    // Store thickness on CabinetData for persistence
    benchtopCabinet.benchtopThickness = clampedValue

    // Get current dimensions
    const currentWidth = benchtopCabinet.carcass.dimensions.width
    const currentDepth = benchtopCabinet.carcass.dimensions.depth

    // Update via CarcassAssembly.updateDimensions() - height = thickness for benchtop
    benchtopCabinet.carcass.updateDimensions({
      width: currentWidth,
      height: clampedValue,
      depth: currentDepth,
    })

    // Update position after thickness change
    const parentCabinet = cabinets.find(c => c.cabinetId === benchtopCabinet.benchtopParentCabinetId)
    if (parentCabinet) {
      updateAllDependentComponents(parentCabinet, cabinets, wallDimensions, {
        widthChanged: true,
        heightChanged: true,
        depthChanged: true
      })
    }

    // Trigger re-render to update UI snapshots
    setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
  }, [cabinets, wallDimensions, setSelectedCabinets])

  const handleBenchtopHeightFromFloorChange = useCallback((cabinetId: string, value: number) => {
    const benchtopCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!benchtopCabinet || benchtopCabinet.cabinetType !== 'benchtop') return

    // Only for independent benchtops (no parent)
    if (benchtopCabinet.benchtopParentCabinetId) return

    // Clamp value between 0 and 1200
    const clampedValue = Math.max(0, Math.min(1200, value))

    // Update the height from floor value on CabinetData
    benchtopCabinet.benchtopHeightFromFloor = clampedValue

    // Update the Y position of the benchtop group
    benchtopCabinet.group.position.setY(clampedValue)

    // Trigger re-render to update UI snapshots
    setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
  }, [cabinets, setSelectedCabinets])

  // Handle bulkhead selection from modal - creates bulkhead with proper product association
  const handleBulkheadSelect = useCallback((cabinetId: string, productId: string) => {
    handleBulkheadSelectHandler(cabinetId, productId, {
      cabinets,
      wsProducts,
      createCabinet,
      deleteCabinet,
      wallDimensions
    })
  }, [cabinets, wsProducts, createCabinet, deleteCabinet, wallDimensions])

  const propagateLockToPairedCabinets = useCallback(
    (sourceCabinetId: string, leftLock: boolean, rightLock: boolean) => {
      const group = cabinetGroups.get(sourceCabinetId)
      if (!group || group.length === 0) return

      group.forEach(pair => {
        updateCabinetLock(pair.cabinetId, leftLock, rightLock)
      })
    },
    [cabinetGroups, updateCabinetLock]
  )

  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showAddToCartModal, setShowAddToCartModal] = useState(false)
  const [cartItemsToAdd, setCartItemsToAdd] = useState<{ items: ReturnType<typeof collectCartItems>['items'], skipped: ReturnType<typeof collectCartItems>['skipped'] } | null>(null)

  const handleAddToCart = useCallback(() => {
    if (cabinets.length === 0) {
      toast.error("No cabinets in the scene to add to cart.")
      return
    }

    // Collect items from all cabinets
    const { items, skipped } = collectCartItems(cabinets)

    console.log({ items, skipped })

    if (items.length === 0) {
      toast.error(
        skipped.length > 0
          ? `No items ready. ${skipped.length} cabinet(s) need configuration.`
          : "Please configure your cabinets first."
      )
      return
    }

    // Store items and open modal
    setCartItemsToAdd({ items, skipped })
    setShowAddToCartModal(true)
  }, [cabinets])

  const handleConfirmAddToCart = useCallback(async (projectName: string, userEmail: string) => {
    if (!cartItemsToAdd) return

    setIsAddingToCart(true)

    try {
      // Pass existing projectId if we're updating a user room
      const response = await addToCart(
        cartItemsToAdd.items,
        projectName,
        currentUserRoom?.projectId
      )

      if (response.success) {
        // Save or update the user room after successful add to cart
        if (currentRoomId) {
          try {
            // Get room category from wsRooms
            const roomMeta = wsRooms?.rooms?.[currentRoomId]
            const categoryId = roomMeta?.categoryId
            const categoryName = categoryId
              ? wsRooms?.categories?.[categoryId]?.category
              : undefined

            // Serialize current room state
            const roomData = serializeRoom({
              cabinets,
              cabinetGroups,
              wallDimensions,
              wallColor,
              activeViews: viewManager.activeViews,
              getCabinetView: viewManager.getCabinetView,
              wsProducts,
              roomName: currentRoomName || projectName,
              roomCategory: (categoryName as RoomCategory) || "Kitchen",
              cabinetSyncs,
            })

            // Save user room with project details using mutation
            const saveResult = await saveUserRoomMutation.mutateAsync({
              ...roomData,
              userRoomId: currentUserRoom?.id,
              userEmail: userEmail.toLowerCase().trim(),
              originalRoomId: currentRoomId,
              originalRoomName: currentRoomName || "",
              projectName,
              projectId: response.projectId,
              updatedAt: new Date().toISOString(),
            })

            // Update current user room state
            setCurrentUserRoom((prev) => ({
              ...roomData,
              id: saveResult.userRoomId,
              userEmail: userEmail.toLowerCase().trim(),
              originalRoomId: currentRoomId,
              originalRoomName: currentRoomName || "",
              projectName,
              projectId: response.projectId,
              createdAt: prev?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }))

            console.log("User room saved:", saveResult.userRoomId)
          } catch (saveError) {
            console.error("Failed to save user room:", saveError)
            // Don't fail the whole operation if room save fails
          }
        }

        setShowAddToCartModal(false)
        setCartItemsToAdd(null)
        
        if (response.itemErrors && response.itemErrors.length > 0) {
          toast.success(
            `Added ${response.itemsAdded} item(s) to cart! (${response.itemErrors.length} had errors)`,
            { duration: 5000 }
          )
        } else {
          toast.success(
            `Added ${response.itemsAdded} item(s) to cart! Total: $${response.projectTotals.totalPrice.toFixed(2)}`,
            { duration: 4000 }
          )
        }
      } else if (response.error === "AUTH_REQUIRED") {
        toast.error("Please sign in to continue. Redirecting...")
        window.location.reload()
      } else {
        toast.error(
          `Failed to add to cart: ${response.error}`,
          { duration: 5000 }
        )
      }
    } catch (error) {
      console.error("Add to cart error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsAddingToCart(false)
    }
  }, [cartItemsToAdd, currentUserRoom, currentRoomId, currentRoomName, wsRooms, cabinets, cabinetGroups, wallDimensions, wallColor, viewManager, wsProducts, cabinetSyncs, saveUserRoomMutation])

  const handleCloseAddToCartModal = useCallback(() => {
    if (!isAddingToCart) {
      setShowAddToCartModal(false)
      setCartItemsToAdd(null)
    }
  }, [isAddingToCart])

  // Handler to show user rooms modal
  const handleShowMyRooms = useCallback(() => {
    setShowUserRoomsModal(true)
  }, [])

  // Handler to load a user room
  const handleLoadUserRoom = useCallback(async (userRoomId: string) => {
    try {
      const userRoom = await loadUserRoomMutation.mutateAsync(userRoomId)
      if (userRoom) {
        // Set the user room state first
        setCurrentUserRoom(userRoom)
        // Load the room using existing room loading logic
        await loadRoom(userRoom)
        // Reset history with the loaded room
        resetHistory(userRoom)
        setShowUserRoomsModal(false)
        toast.success(`Loaded: ${userRoom.name}`)
      } else {
        toast.error("Room not found")
      }
    } catch (err) {
      console.error("Failed to load user room:", err)
      toast.error("Failed to load room. Please try again.")
    }
  }, [loadRoom, resetHistory, loadUserRoomMutation])

  // Handler to show save user room modal
  const handleSaveUserRoom = useCallback(() => {
    if (!currentRoomId) {
      toast.error("Please load a room template first")
      return
    }
    setShowSaveRoomModal(true)
  }, [currentRoomId])

  // Handler to confirm save room (without adding to cart)
  const handleConfirmSaveRoom = useCallback(async (projectName: string, userEmail: string) => {
    if (!currentRoomId) return

    setIsSavingRoom(true)

    try {
      // Get room category from wsRooms
      const roomMeta = wsRooms?.rooms?.[currentRoomId]
      const categoryId = roomMeta?.categoryId
      const categoryName = categoryId
        ? wsRooms?.categories?.[categoryId]?.category
        : undefined

      // Serialize current room state
      const roomData = serializeRoom({
        cabinets,
        cabinetGroups,
        wallDimensions,
        wallColor,
        activeViews: viewManager.activeViews,
        getCabinetView: viewManager.getCabinetView,
        wsProducts,
        roomName: currentRoomName || projectName,
        roomCategory: (categoryName as RoomCategory) || "Kitchen",
        cabinetSyncs,
      })

      // Save user room using mutation
      const saveResult = await saveUserRoomMutation.mutateAsync({
        ...roomData,
        userRoomId: currentUserRoom?.id,
        userEmail: userEmail.toLowerCase().trim(),
        originalRoomId: currentRoomId,
        originalRoomName: currentRoomName || "",
        projectName,
        projectId: currentUserRoom?.projectId,
        updatedAt: new Date().toISOString(),
      })

      // Update current user room state
      setCurrentUserRoom((prev) => ({
        ...roomData,
        id: saveResult.userRoomId,
        userEmail: userEmail.toLowerCase().trim(),
        originalRoomId: currentRoomId,
        originalRoomName: currentRoomName || "",
        projectName,
        projectId: currentUserRoom?.projectId,
        createdAt: prev?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      setShowSaveRoomModal(false)
      toast.success("Room saved successfully!")
    } catch (error) {
      console.error("Failed to save room:", error)
      toast.error("Failed to save room. Please try again.")
    } finally {
      setIsSavingRoom(false)
    }
  }, [currentRoomId, currentRoomName, currentUserRoom, wsRooms, cabinets, cabinetGroups, wallDimensions, wallColor, viewManager, wsProducts, cabinetSyncs, saveUserRoomMutation])

  const handleShowProducts = useCallback(() => {
    setShowProductsDrawer(true)
  }, [])

  const handleExport = useCallback(() => {
    if (cabinets.length === 0) {
      alert('No cabinets in the scene to export.')
      return
    }

    try {
      const partDataList = partData.getAllParts()
      if (partDataList.length === 0) {
        alert('No parts found to export.')
        return
      }

      const parts = partDataList.map((part) => ({
        id: part.partId,
        label: `${part.cabinetType} ${part.cabinetId} - ${part.partName}`,
        width: Math.max(part.dimX, part.dimY, part.dimZ),
        height: [part.dimX, part.dimY, part.dimZ].sort((a, b) => b - a)[1],
        materialId: part.materialId,
        materialName: part.materialName,
        materialColor: part.materialColor,
        grainDirection: 'none' as const,
        cabinetId: part.cabinetId,
        cabinetType: part.cabinetType,
        cabinetNumber: part.cabinetNumber,
        cabinetName: part.cabinetName,
        partName: part.partName,
        originalWidth: Math.max(part.dimX, part.dimY, part.dimZ),
        originalHeight: [part.dimX, part.dimY, part.dimZ].sort((a, b) => b - a)[1],
        originalDimX: part.dimX,
        originalDimY: part.dimY,
        originalDimZ: part.dimZ,
      }))

      exportPartsToCSV(parts, `nesting-parts-export-${Date.now()}.csv`)
    } catch (error) {
      console.error('Error exporting parts:', error)
      alert('Failed to export parts. Please check the console for details.')
    }
  }, [cabinets, partData])

  const handleNesting = useCallback(() => {
    setShowNestingModal(true)
  }, [])

  // Handle width change from UserWidthSlider in User mode
  // Uses actual selectedCabinets to support sync relationships when multiple cabinets are selected
  const handleUserWidthChange = useCallback((cabinetId: string, newWidth: number) => {
    const cabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!cabinet) return

    handleProductDimensionChange(
      {
        width: newWidth,
        height: cabinet.carcass.dimensions.height,
        depth: cabinet.carcass.dimensions.depth
      },
      {
        selectedCabinet: cabinet,
        cabinets,
        cabinetSyncs,
        selectedCabinets,
        cabinetGroups,
        viewManager,
        wallDimensions
      }
    )

    // Update part data for all affected cabinets
    partData.updateCabinet(cabinet)
    // Also update synced cabinets if they exist
    const syncedCabinetIds = cabinetSyncs.get(cabinet.cabinetId) || []
    syncedCabinetIds.forEach(syncId => {
      const syncedCab = cabinets.find(c => c.cabinetId === syncId)
      if (syncedCab) partData.updateCabinet(syncedCab)
    })
    debouncedIncrementDimensionVersion()
  }, [cabinets, cabinetSyncs, cabinetGroups, viewManager, wallDimensions, partData, debouncedIncrementDimensionVersion, selectedCabinets])

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Scene Container */}
      <div ref={mountRef} className="w-full h-full" />

      <ModeToggle selectedMode={selectedMode} onModeChange={setSelectedMode} />

      <CartSection
        totalPrice={totalPrice}
        onAddToCart={handleAddToCart}
        onShowProducts={handleShowProducts}
        onShowMyRooms={handleShowMyRooms}
        onSaveRoom={handleSaveUserRoom}
        isLoading={isAddingToCart}
        isSaving={isSavingRoom}
        isPriceCalculating={isPriceCalculating}
        appMode={selectedMode}
        userEmail={userEmail || null}
        userRole={userRole || null}
      />

      {selectedMode === 'admin' && (
        <BottomRightActions
          cabinetsCount={cabinets.length}
          onExport={handleExport}
          onNesting={handleNesting}
          onSettings={handleSettingsClick}
        />
      )}

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
          wallDimensions={wallDimensions}
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
          onKickerHeightChange={(viewId, height) => {
            handleKickerHeightChange(viewId as ViewId, height, {
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
        onX={() => { setCameraMode('constrained'); setCameraXView(); setIsOrthoView(true); setCameraViewMode('x'); }}
        onY={() => { setCameraMode('constrained'); setCameraYView(); setIsOrthoView(true); setCameraViewMode('y'); }}
        onZ={() => { setCameraMode('constrained'); setCameraZView(); setIsOrthoView(true); setCameraViewMode('z'); }}
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
        isOrthoView={isOrthoView}
        onResetTo3D={() => { resetToPerspective(zoomLevel); setIsOrthoView(false); setCameraViewMode(null); }}
        mode={selectedMode}
      />

      {/* Camera Movement Instructions moved to CameraControls component - appears on hover */}

      {/* Cabinet Lock Icons - appear on double-click (Admin mode only) */}
      {/* Don't show icons for fillers/panels added from modal (marked with hideLockIcons) */}
      {selectedMode === 'admin' && cabinetWithLockIcons &&
        !cabinetWithLockIcons.hideLockIcons && (
          <CabinetLockIcons
            cabinet={cabinetWithLockIcons}
            camera={cameraRef.current}
            allCabinets={cabinets}
            onClose={() => setCabinetWithLockIcons(null)}
            onLockChange={(cabinetId, leftLock, rightLock) => {
              // Update the cabinet's lock state
              updateCabinetLock(cabinetId, leftLock, rightLock)
              propagateLockToPairedCabinets(cabinetId, leftLock, rightLock)
              // Update cabinetWithLockIcons if it's the one being changed
              if (cabinetWithLockIcons?.cabinetId === cabinetId) {
                setCabinetWithLockIcons(prev => prev ? { ...prev, leftLock, rightLock } : null)
              }
            }}
            onKickerToggle={handleKickerToggle}
            onBulkheadToggle={handleBulkheadToggle}
            onUnderPanelToggle={handleUnderPanelToggle}
            wsProducts={wsProducts}
            onFillerSelect={handleFillerSelect}
            onFillerToggle={handleFillerToggle}
            onKickerSelect={handleKickerSelect}
            onBulkheadSelect={handleBulkheadSelect}
            onUnderPanelSelect={handleUnderPanelSelect}
            onBenchtopToggle={handleBenchtopToggle}
            onBenchtopSelect={handleBenchtopSelect}
          />
        )}

      {/* User Width Slider - appears on right-click (User mode only) */}
      {selectedMode === 'user' && cabinetWithLockIcons && (() => {
        const constraints = getWidthConstraints(cabinetWithLockIcons.productId)
        return (
          <UserWidthSlider
            cabinet={cabinetWithLockIcons}
            onClose={() => setCabinetWithLockIcons(null)}
            onWidthChange={handleUserWidthChange}
            minWidth={constraints?.min}
            maxWidth={constraints?.max}
          />
        )
      })()}

      {/* CabinetsInfoPanel hidden per user request */}
      {/* <CabinetsInfoPanel cabinets={cabinets} /> */}


      {/* Info Panel */}

      {/* Appliance Panel - shown when appliance is selected */}
      {showProductPanel && selectedCabinet?.cabinetType === 'appliance' && (
        <AppliancePanel
          isVisible={true}
          selectedCabinet={selectedCabinet}
          onClose={() => {
            setShowProductPanel(false)
            setSelectedCabinet(null)
          }}
          viewManager={viewManager}
          onViewChange={(cabinetId, viewId) => {
            updateCabinetViewId(cabinetId, viewId === 'none' ? undefined : viewId)
          }}
          cabinets={cabinets}
          cabinetGroups={cabinetGroups}
          wallDimensions={wallDimensions}
        />
      )}

      {/* Product Panel - shown when NON-appliance cabinet is selected (Admin mode only) */}
      {selectedMode === 'admin' && showProductPanel && selectedCabinet?.cabinetType !== 'appliance' && (
        <ProductPanel
          isVisible={true}
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
            sortNumber: selectedCabinet.sortNumber,
            doorEnabled: selectedCabinet.carcass.config.doorEnabled,
            doorCount: selectedCabinet.carcass.config.doorCount,
            doorMaterial: selectedCabinet.carcass.config.doorMaterial,
            overhangDoor: selectedCabinet.carcass.config.overhangDoor,
            drawerEnabled: selectedCabinet.carcass.config.drawerEnabled,
            drawerQuantity: selectedCabinet.carcass.config.drawerQuantity,
            drawerHeights: selectedCabinet.carcass.config.drawerHeights,
            cabinetId: selectedCabinet.cabinetId,
            viewId: selectedCabinet.viewId,
            carcass: selectedCabinet.carcass,
            hideLockIcons: selectedCabinet.hideLockIcons,
            benchtopParentCabinetId: selectedCabinet.benchtopParentCabinetId,
            benchtopFrontOverhang: selectedCabinet.benchtopFrontOverhang,
            benchtopLeftOverhang: selectedCabinet.benchtopLeftOverhang,
            benchtopRightOverhang: selectedCabinet.benchtopRightOverhang,
            benchtopThickness: selectedCabinet.benchtopThickness,
            benchtopHeightFromFloor: selectedCabinet.benchtopHeightFromFloor
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

                const sourceCabinet = cabinets.find(c => c.cabinetId === cabinetId)
                if (sourceCabinet) {
                  const sourceLeftLock = !!sourceCabinet.leftLock
                  const sourceRightLock = !!sourceCabinet.rightLock
                  updateCabinetLock(addedId, sourceLeftLock, sourceRightLock)
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

          onBenchtopOverhangChange={handleBenchtopOverhangChange}
          onBenchtopThicknessChange={handleBenchtopThicknessChange}
          onBenchtopHeightFromFloorChange={handleBenchtopHeightFromFloorChange}

          onShelfCountChange={(newCount: number) => {
            if (selectedCabinet) {
              selectedCabinet.carcass.updateConfig({ shelfCount: newCount })
              // Update part data when shelf count changes
              partData.updateCabinet(selectedCabinet)
            }
          }}

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
              // Update part data when dimensions change
              // Update all affected cabinets (selected + synced + grouped)
              const affectedCabinets = new Set<CabinetData>([selectedCabinet])
              const syncCabinets = cabinetSyncs.get(selectedCabinet.cabinetId) || []
              syncCabinets.forEach(id => {
                const cab = cabinets.find(c => c.cabinetId === id)
                if (cab) affectedCabinets.add(cab)
              })
              const groupCabinets = cabinetGroups.get(selectedCabinet.cabinetId) || []
              groupCabinets.forEach(({ cabinetId }) => {
                const cab = cabinets.find(c => c.cabinetId === cabinetId)
                if (cab) affectedCabinets.add(cab)
              })
              affectedCabinets.forEach(cab => partData.updateCabinet(cab))

              // Debounced increment to trigger wall adjustments after dimension change
              debouncedIncrementDimensionVersion()
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

              // Update all dependent components
              updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
                kickerHeightChanged: true
              })
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

              // Update part data when door material changes
              partData.updateCabinet(selectedCabinet)
            }
          }}
          onDoorCountChange={(count) => {
            if (selectedCabinet) {
              // Update door count
              selectedCabinet.carcass.updateDoorConfiguration(count);
              // Update part data when door count changes
              partData.updateCabinet(selectedCabinet)
            }
          }}
          onOverhangDoorToggle={(overhang) => {
            if (selectedCabinet) {
              // Update overhang door setting
              selectedCabinet.carcass.updateOverhangDoor(overhang);

              // Update all dependent components when overhang changes
              updateAllDependentComponents(selectedCabinet, cabinets, wallDimensions, {
                overhangChanged: true
              })
            }
          }}
          onDrawerToggle={(enabled) => {
            if (selectedCabinet) {

              // Toggle drawers on/off directly on the carcass
              selectedCabinet.carcass.updateDrawerEnabled(enabled);

              // Update part data when drawer toggle changes
              partData.updateCabinet(selectedCabinet)

              // Trigger re-render while preserving multi-selection
              setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
            }
          }}
          onDrawerQuantityChange={(quantity) => {
            if (selectedCabinet) {

              // Update drawer quantity directly on the carcass
              selectedCabinet.carcass.updateDrawerQuantity(quantity);

              // Update part data when drawer quantity changes
              partData.updateCabinet(selectedCabinet)

              // Trigger re-render while preserving multi-selection
              setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
            }
          }}
          onDrawerHeightChange={(index, height, changedId) => {
            if (selectedCabinet) {

              // Update individual drawer height directly on the carcass
              selectedCabinet.carcass.updateDrawerHeight(index, height, changedId);

              // Update part data when drawer height changes
              partData.updateCabinet(selectedCabinet)

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

              // Get drawer heights from the carcass
              const heights = selectedCabinet.carcass.getDrawerHeights();

              // Reset drawer heights directly on the carcass and force update via public API
              selectedCabinet.carcass.config.drawerHeights = [...heights]
              const qty = selectedCabinet.carcass.config.drawerQuantity || heights.length
              selectedCabinet.carcass.updateDrawerQuantity(qty)

              // Trigger re-render while preserving multi-selection
              setSelectedCabinets(prev => prev.map(cab => ({ ...cab })))
            }
          }}
        />
      )}

      {/* Save Modal */}
      <SaveModal
        isOpen={showSaveModal}
        onClose={closeSaveModal}
        onSave={async () => {
          try {
            await handleSaveRoom()
            closeSaveModal()
          } catch (error) {
            // Error is already shown by the hook
            console.error('Save failed:', error)
          }
        }}
        currentRoomName={currentRoomName}
        isSaving={isSaving}
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
              setCabinetToDelete,
              allCabinets: cabinets,
              wallDimensions
            })
            // Remove cabinet from part data database
            partData.removeCabinet(cabinetToDelete.cabinetId)
            closeDeleteModal()
          }
        }}
        itemName="the selected cabinet"
      />

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={handleCloseAddToCartModal}
        onConfirm={handleConfirmAddToCart}
        itemCount={cartItemsToAdd?.items.length ?? 0}
        skippedCount={cartItemsToAdd?.skipped.length ?? 0}
        isLoading={isAddingToCart}
        initialEmail={currentUserRoom?.userEmail}
        initialProjectName={currentUserRoom?.projectName}
        isUserRoomMode={!!currentUserRoom}
      />

      {/* User Rooms Modal */}
      <UserRoomsModal
        isOpen={showUserRoomsModal}
        onClose={() => setShowUserRoomsModal(false)}
        onSelectRoom={handleLoadUserRoom}
      />

      {/* Save Room Modal */}
      <SaveRoomModal
        isOpen={showSaveRoomModal}
        onClose={() => setShowSaveRoomModal(false)}
        onConfirm={handleConfirmSaveRoom}
        isLoading={isSavingRoom}
        initialEmail={currentUserRoom?.userEmail}
        initialProjectName={currentUserRoom?.projectName}
      />

      {/* Nesting Modal */}
      <NestingModal
        isOpen={showNestingModal}
        onClose={() => setShowNestingModal(false)}
        cabinets={cabinets}
        wsProducts={wsProducts}
      />

      {/* Products List Drawer */}
      <ProductsListDrawer
        isOpen={showProductsDrawer}
        onClose={() => setShowProductsDrawer(false)}
        cabinets={cabinets}
        wsProducts={wsProducts}
        totalPrice={totalPrice}
        cabinetPrices={cabinetPrices}
        isCabinetCalculating={isCabinetCalculating}
        cabinetErrors={cabinetErrors}
      />

      <HistoryControls
        past={past}
        future={future}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        createCheckpoint={createCheckpoint}
        deleteCheckpoint={deleteCheckpoint}
        jumpTo={jumpTo}
      />

      {selectedMode === 'admin' && <SaveButton onSave={openSaveModal} />}

      <DimensionLineControls
        hasSelection={!!selectedDimLineId}
        hasModifications={hasDimLineModifications}
        onHide={hideDimLine}
        onReset={resetDimLines}
        isOrthoView={isOrthoView}
      />
    </div>
  )
}

export default WallScene
