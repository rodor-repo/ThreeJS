import * as THREE from 'three'
import { DoorMaterial } from '@/features/carcass'
import { Subcategory } from '@/components/categoriesData'
import { Settings, ShoppingCart, Undo, Redo, Flag, History, Clock, Trash2, ChevronDown } from 'lucide-react'
import { debounce } from 'lodash'
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
import type { Category, WallDimensions as WallDims, CabinetData } from './types'
import { CameraControls } from './ui/CameraControls'
import { SettingsSidebar } from './ui/SettingsSidebar'
import { WallSettingsDrawer } from './ui/WallSettingsDrawer'
import { ViewsListDrawer } from './ui/ViewsListDrawer'
import { ViewDetailDrawer } from './ui/ViewDetailDrawer'
import { ProductsListDrawer } from './ui/ProductsListDrawer'
import { SaveModal } from './ui/SaveModal'
import { DeleteConfirmationModal } from './ui/DeleteConfirmationModal'
import { NestingModal } from './ui/NestingModal'
import { WsProducts } from '@/types/erpTypes'
import type { ViewId } from '../cabinets/ViewManager'
import type { SavedRoom } from '@/data/savedRooms'
import { exportPartsToCSV } from '@/nesting/ExportPartExcel'
import { extractPartsFromScene } from '@/nesting/nest-mapper'
import { usePartData } from '@/nesting/usePartData'
import { handleViewDimensionChange } from './utils/handlers/viewDimensionHandler'
import { handleSplashbackHeightChange } from './utils/handlers/splashbackHandler'
import { handleKickerHeightChange } from './utils/handlers/kickerHeightHandler'
import { handleProductDimensionChange } from './utils/handlers/productDimensionHandler'
import { handleDeleteCabinet } from './utils/handlers/deleteCabinetHandler'
import { updateChildCabinets } from './utils/handlers/childCabinetHandler'

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
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false, selectedProductId, wsProducts, onLoadRoomReady }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'constrained' | 'free'>('constrained')
  const [dimensionsVisible, setDimensionsVisible] = useState(true)
  const [numbersVisible, setNumbersVisible] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'admin' | 'user'>('user') // Radio button selection
  const [isOrthoView, setIsOrthoView] = useState(false) // Track ortho view state for UI
  const [cameraViewMode, setCameraViewMode] = useState<'x' | 'y' | 'z' | null>(null) // Track which ortho view is active
  const [showProductsDrawer, setShowProductsDrawer] = useState(false) // Control products list drawer
  const [showNestingModal, setShowNestingModal] = useState(false) // Control nesting modal
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

  // Snap guides for visual feedback during cabinet dragging
  const { updateSnapGuides, clearSnapGuides } = useSnapGuides(sceneRef, wallDimensions)

  // Dimension lines for showing cabinet measurements
  useDimensionLines(sceneRef, cabinets, dimensionsVisible, viewManager.viewManager, wallDimensions, cameraViewMode)

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
    { isOrthoActiveRef, orthoCameraRef } // orthoRefs
  )

  // Control wall transparency based on camera view mode
  // X view: Side walls (left, right, middle) transparent, back wall normal
  // Y view: Back wall transparent, side walls (left, right, middle) normal
  // Z view or 3D: All walls normal
  useEffect(() => {
    // Determine opacity for back wall and side walls based on view mode
    const backWallOpacity = cameraViewMode === 'y' ? 0 : 0.9 // Transparent in Y view, normal otherwise
    const sideWallsOpacity = cameraViewMode === 'x' ? 0 : 0.9 // Transparent in X view, normal otherwise

    // Update back wall
    if (wallRef.current) {
      wallRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshLambertMaterial
          if (material.transparent !== undefined) {
            material.opacity = backWallOpacity
            material.needsUpdate = true
          }
        }
      })
    }

    // Update left wall
    if (leftWallRef.current) {
      leftWallRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshLambertMaterial
          if (material.transparent !== undefined) {
            material.opacity = sideWallsOpacity
            material.needsUpdate = true
          }
        }
      })
    }

    // Update right wall
    if (rightWallRef.current) {
      rightWallRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshLambertMaterial
          if (material.transparent !== undefined) {
            material.opacity = sideWallsOpacity
            material.needsUpdate = true
          }
        }
      })
    }

    // Update additional walls (middle walls)
    // Traverse the scene to find additional walls
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        // Skip the back wall (wallRef.current)
        if (child === wallRef.current) {
          return
        }

        // Check if this is an additional wall by checking its geometry
        // Additional walls are perpendicular to back wall (extend in Z direction)
        if (child instanceof THREE.Group && child.children.length > 0) {
          const firstChild = child.children[0]
          if (firstChild instanceof THREE.Mesh) {
            const material = firstChild.material as THREE.MeshLambertMaterial
            // Check if this is an additional wall (has thickness in X direction, extends in Z)
            // Additional walls have geometry with small X dimension (thickness)
            if (material && material.transparent !== undefined && firstChild.geometry) {
              const geometry = firstChild.geometry as THREE.BoxGeometry
              // Additional walls have small X dimension (wall thickness)
              // and are positioned away from X=0 and X=backWallLength
              if (geometry.parameters && geometry.parameters.width < 100) {
                // This is likely a wall (has small width/thickness)
                // Check if it's not the back wall (back wall has large X dimension)
                const xPos = child.position.x
                const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length
                // Additional walls are positioned between 0 and backWallLength
                if (xPos > 0 && xPos < backWallLength) {
                  material.opacity = sideWallsOpacity
                  material.needsUpdate = true
                }
              }
            }
          }
        }
      })
    }
  }, [cameraViewMode, wallRef, leftWallRef, rightWallRef, sceneRef, wallDimensions])

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
    positionVersion: dragEndVersion + dimensionVersion,
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

  // Handle filler selection and creation
  const handleFillerSelect = useCallback((cabinetId: string, productId: string, side: 'left' | 'right') => {
    if (!wsProducts || !sceneRef.current) return

    const parentCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!parentCabinet) return

    const productEntry = wsProducts.products[productId]
    if (!productEntry) return

    const productName = productEntry.product
    const designId = productEntry.designId
    const designEntry = wsProducts.designs[designId || ""]
    if (!designEntry) return

    // Check if it's a filler or panel type
    const cabinetType = designEntry.type3D
    if (cabinetType !== 'filler' && cabinetType !== 'panel') return

    // Determine filler type from product name (only for fillers)
    const fillerType = cabinetType === 'filler' && (productName?.toLowerCase().includes("l shape") || productName?.toLowerCase().includes("l-shape"))
      ? "l-shape"
      : "linear"

    // Get filler subcategory (find first filler subcategory)
    const fillersCategory = Object.entries(wsProducts.categories).find(([, cat]) =>
      cat.category.toLowerCase().includes('filler') || cat.category.toLowerCase().includes('panel')
    )
    if (!fillersCategory) return

    const [categoryId] = fillersCategory
    const fillerSubcategory = Object.entries(wsProducts.subCategories).find(([, sc]) => sc.categoryId === categoryId)
    if (!fillerSubcategory) return

    const [subcategoryId, subcategoryData] = fillerSubcategory

    // Match height to parent cabinet height
    const itemHeight = parentCabinet.carcass.dimensions.height

    // Determine filler return position for L-Shape fillers
    // When added to LEFT side: return should be on RIGHT side of filler (toward cabinet)
    // When added to RIGHT side: return should be on LEFT side of filler (toward cabinet)
    const fillerReturnPosition = cabinetType === 'filler' && fillerType === 'l-shape'
      ? (side === 'left' ? 'right' : 'left')
      : undefined

    // Create filler or panel using the hook (adds to scene and state)
    const newCabinet = createCabinet(cabinetType, subcategoryId, {
      productId,
      productName,
      fillerReturnPosition,
      additionalProps: {
        hideLockIcons: true,
        parentCabinetId: cabinetId,
        parentSide: side,
      }
    })
    if (!newCabinet) return

    // Check if parent is overhead cabinet with overhang doors
    const isOverheadWithOverhang = parentCabinet.cabinetType === 'top' &&
      parentCabinet.carcass.config.overhangDoor === true
    const overhangAmount = 20 // 20mm overhang extension

    // Update dimensions to match parent cabinet height
    // For overhead cabinets with overhang: extend height downward by overhang amount
    let finalHeight = itemHeight
    if (isOverheadWithOverhang) {
      finalHeight = itemHeight + overhangAmount
    }

    if (cabinetType === 'filler') {
      // Filler dimensions
      newCabinet.carcass.updateDimensions({
        width: fillerType === 'l-shape' ? 100 : 16, // L-shape uses width for gap, linear uses 16mm thickness
        height: finalHeight, // Match parent cabinet height (with overhang extension if applicable)
        depth: fillerType === 'l-shape' ? 40 : 100, // L-shape return depth, linear face width
      })
    } else if (cabinetType === 'panel') {
      // Panel dimensions: width = thickness (16mm), height = panel height
      // For END/Side Panels: depth = parent depth + 20mm (extend in positive Z)
      // For other panels: depth = panel face width (600mm default)
      const parentDepth = parentCabinet.carcass.dimensions.depth

      // Check if this is an END Panel or Side Panel by checking product name or subcategory
      const productNameLower = productName?.toLowerCase() || ''
      const subcategoryName = subcategoryData?.subCategory?.toLowerCase() || ''
      const isEndPanel = productNameLower.includes("end") ||
        productNameLower.includes("side panel") ||
        subcategoryName.includes("side-panel") ||
        subcategoryName.includes("side panel")

      const panelDepth = isEndPanel ? parentDepth + 20 : 600 // END/Side Panel: parent depth + 20mm, others: 600mm

      newCabinet.carcass.updateDimensions({
        width: 16, // Panel thickness
        height: finalHeight, // Match parent cabinet height (with overhang extension if applicable)
        depth: panelDepth, // END/Side Panel: parent depth + 20mm, others: 600mm default
      })
    }

    // Position next to parent cabinet
    const parentX = parentCabinet.group.position.x
    const parentWidth = parentCabinet.carcass.dimensions.width
    const parentY = parentCabinet.group.position.y
    const parentZ = parentCabinet.group.position.z
    const parentDepth = parentCabinet.carcass.dimensions.depth

    // Calculate door front edge position to align fillers/panels with doors
    // Door center Z position: parentZ + parentDepth + doorThickness/2 + 2mm offset
    // Door front edge Z: door center + doorThickness/2 = parentZ + parentDepth + doorThickness + 2mm
    const doorMaterial = parentCabinet.carcass.config.doorMaterial
    const doorThickness = doorMaterial ? doorMaterial.getThickness() : 0
    const doorOffset = 2 // 2mm clearance offset
    const doorFrontEdgeZ = parentZ + parentDepth + doorThickness + doorOffset

    // For fillers/panels, we need to position them so their front edge aligns with door front edge
    // Filler/panel back edge is at fillerZ (cabinet origin is at back-bottom-left)
    // Filler/panel front edge is at: fillerZ + fillerDepth
    // So: fillerZ + fillerDepth = doorFrontEdgeZ
    // Therefore: fillerZ = doorFrontEdgeZ - fillerDepth
    // L-Shape fillers need an additional 20mm forward offset
    const fillerDepth = newCabinet.carcass.dimensions.depth
    const lShapeOffset = cabinetType === 'filler' && fillerType === 'l-shape' ? 20 : 0
    const fillerZ = doorFrontEdgeZ - fillerDepth + lShapeOffset

    // Calculate Y position: align bottom with parent bottom, extend upward (positive Y)
    // For overhead with overhang: position 20mm lower (negative Y) to align with door overhang
    let fillerY = parentY // Align bottom Y with parent bottom Y (extends upward in positive Y direction)
    if (isOverheadWithOverhang) {
      // Position 20mm lower (negative Y) to align with door overhang extension
      fillerY = parentY - overhangAmount
    }

    if (side === 'left') {
      // Position to the left of the cabinet
      newCabinet.group.position.set(
        parentX - newCabinet.carcass.dimensions.width,
        fillerY, // Y position (with overhang adjustment if applicable)
        fillerZ // Align front edge with door front edge
      )
    } else {
      // Position to the right of the cabinet
      newCabinet.group.position.set(
        parentX + parentWidth,
        fillerY, // Y position (with overhang adjustment if applicable)
        fillerZ // Align front edge with door front edge
      )
    }

    // Add to same view as parent cabinet
    if (parentCabinet.viewId) {
      updateCabinetViewId(newCabinet.cabinetId, parentCabinet.viewId)
    }

    // Set lock states for fillers based on which side they're added
    // Right filler: activate LEFT lock, release RIGHT lock
    // Left filler: activate RIGHT lock, release LEFT lock
    if (cabinetType === 'filler' || cabinetType === 'panel') {
      if (side === 'right') {
        updateCabinetLock(newCabinet.cabinetId, true, false) // Left lock ON, Right lock OFF
      } else {
        updateCabinetLock(newCabinet.cabinetId, false, true) // Left lock OFF, Right lock ON
      }
    }

    // Update bulkhead if parent has one (bulkhead width needs to include new child)
    if (parentCabinet.cabinetType === 'top' || parentCabinet.cabinetType === 'tall') {
      import('./utils/handlers/bulkheadPositionHandler').then(({ updateBulkheadPosition }) => {
        // Use setTimeout to ensure newCabinet is in cabinets array
        setTimeout(() => {
          const updatedCabinets = [...cabinets, newCabinet]
          updateBulkheadPosition(parentCabinet, updatedCabinets, wallDimensions, {
            widthChanged: true
          })
        }, 0)
      })
    }
  }, [cabinets, wsProducts, sceneRef, createCabinet, updateCabinetViewId, updateCabinetLock, wallDimensions])

  // Handle kicker selection from modal - creates kicker with proper product association
  const handleKickerSelect = useCallback((cabinetId: string, productId: string) => {
    if (!wsProducts) return

    const parentCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!parentCabinet || (parentCabinet.cabinetType !== 'base' && parentCabinet.cabinetType !== 'tall')) {
      return
    }

    // Get product info from wsProducts
    const productEntry = wsProducts.products[productId]
    if (!productEntry) return

    const designId = productEntry.designId
    const designEntry = wsProducts.designs[designId || ""]
    if (!designEntry || designEntry.type3D !== 'kicker') return

    const subcategoryId = productEntry.subCategoryId

    // Check if kicker already exists
    const existingKickerCabinet = cabinets.find(
      (c) => c.cabinetType === 'kicker' && c.kickerParentCabinetId === cabinetId
    )

    if (existingKickerCabinet) {
      // Kicker already exists, don't create another one
      return
    }

    // Get kicker height from cabinet's Y position
    const kickerHeight = Math.max(0, parentCabinet.group.position.y)

    // Calculate effective kicker width including children
    const parentX = parentCabinet.group.position.x
    const parentWidth = parentCabinet.carcass.dimensions.width

    let minX = parentX
    let maxX = parentX + parentWidth

    // Find all child fillers/panels that have "off the floor" > 0
    const childCabinets = cabinets.filter(
      (c) =>
        c.parentCabinetId === cabinetId &&
        (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
        c.hideLockIcons === true &&
        c.group.position.y > 0
    )

    childCabinets.forEach((child) => {
      const childLeftX = child.group.position.x
      const childRightX = childLeftX + child.carcass.dimensions.width
      if (childLeftX < minX) minX = childLeftX
      if (childRightX > maxX) maxX = childRightX
    })

    const effectiveWidth = maxX - minX
    const effectiveLeftX = minX

    // Create kicker using createCabinet (same pattern as filler creation)
    const kickerCabinet = createCabinet("kicker", subcategoryId, {
      productId,
      customDimensions: {
        width: effectiveWidth,
        height: kickerHeight,
        depth: parentCabinet.carcass.dimensions.depth,
      },
      additionalProps: {
        viewId: parentCabinet.viewId,
        kickerParentCabinetId: cabinetId,
        hideLockIcons: true,
      }
    })

    if (!kickerCabinet) return

    // Calculate world position for kicker
    const cabinetWorldPos = new THREE.Vector3()
    parentCabinet.group.getWorldPosition(cabinetWorldPos)

    const kickerLocalX = effectiveWidth / 2
    const kickerLocalY = -kickerHeight / 2
    const kickerLocalZ = parentCabinet.carcass.dimensions.depth - 70 + 16 / 2

    const kickerWorldPos = new THREE.Vector3(
      effectiveLeftX + kickerLocalX,
      cabinetWorldPos.y + kickerLocalY,
      cabinetWorldPos.z + kickerLocalZ
    )

    kickerCabinet.group.position.copy(kickerWorldPos)
    kickerCabinet.group.name = `kicker_${parentCabinet.cabinetId}`
  }, [cabinets, wsProducts, createCabinet])

  // Handle kicker face removal for a specific cabinet
  // Note: Kicker creation is handled by handleKickerSelect with product association
  const handleKickerToggle = useCallback((cabinetId: string, enabled: boolean) => {
    if (enabled) {
      // Creation is now handled by handleKickerSelect with proper product association
      // This toggle only handles removal
      return
    }

    const cabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!cabinet || (cabinet.cabinetType !== 'base' && cabinet.cabinetType !== 'tall')) {
      return
    }

    // Remove kicker face from this cabinet
    const existingKickerCabinet = cabinets.find(
      (c) => c.cabinetType === 'kicker' && c.kickerParentCabinetId === cabinetId
    )

    if (existingKickerCabinet) {
      // Dispose the kicker face via carcass
      const kickerFace = existingKickerCabinet.carcass?.kickerFace
      if (kickerFace && typeof kickerFace.dispose === 'function') {
        kickerFace.dispose()
      }

      // Remove kicker using deleteCabinet method
      deleteCabinet(existingKickerCabinet.cabinetId)
    }
  }, [cabinets, deleteCabinet])

  // Handle bulkhead removal for base, overhead and tall cabinets
  // Note: Bulkhead creation is handled by handleBulkheadSelect with product association
  const handleBulkheadToggle = useCallback((cabinetId: string, enabled: boolean) => {
    if (enabled) {
      // Creation is now handled by handleBulkheadSelect with proper product association
      // This toggle only handles removal
      return
    }

    const cabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!cabinet || (cabinet.cabinetType !== 'top' && cabinet.cabinetType !== 'tall')) {
      return
    }

    // Remove bulkhead from this cabinet
    const existingBulkheadCabinet = cabinets.find(
      (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === cabinetId
    )

    if (existingBulkheadCabinet) {
      // Dispose entire bulkhead carcass (includes face and returns)
      // CarcassAssembly.dispose() handles all cleanup
      existingBulkheadCabinet.carcass?.dispose()

      // Remove bulkhead using deleteCabinet method
      deleteCabinet(existingBulkheadCabinet.cabinetId)
    }
  }, [cabinets, deleteCabinet])

  // Handle bulkhead selection from modal - creates bulkhead with proper product association
  const handleBulkheadSelect = useCallback((cabinetId: string, productId: string) => {
    if (!wsProducts) return

    const parentCabinet = cabinets.find(c => c.cabinetId === cabinetId)
    if (!parentCabinet || (parentCabinet.cabinetType !== 'base' && parentCabinet.cabinetType !== 'top' && parentCabinet.cabinetType !== 'tall')) {
      return
    }

    // Get product info from wsProducts
    const productEntry = wsProducts.products[productId]
    if (!productEntry) return

    const designId = productEntry.designId
    const designEntry = wsProducts.designs[designId || ""]
    if (!designEntry || designEntry.type3D !== 'bulkhead') return

    const subcategoryId = productEntry.subCategoryId

    // Import helper functions dynamically
    import('./utils/handlers/bulkheadPositionHandler').then(({ hasLeftAdjacentCabinet, hasRightAdjacentCabinet }) => {
      // Check if bulkhead already exists
      const existingBulkheadCabinet = cabinets.find(
        (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === cabinetId
      )

      if (existingBulkheadCabinet) {
        // Bulkhead already exists, don't create another one
        return
      }

      // Calculate effective width (cabinet + children)
      const childCabinets = cabinets.filter(
        (c) =>
          c.parentCabinetId === cabinetId &&
          (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
          c.hideLockIcons === true
      )

      let minX = parentCabinet.group.position.x
      let maxX = parentCabinet.group.position.x + parentCabinet.carcass.dimensions.width

      childCabinets.forEach((child) => {
        const childLeft = child.group.position.x
        const childRight = child.group.position.x + child.carcass.dimensions.width
        if (childLeft < minX) minX = childLeft
        if (childRight > maxX) maxX = childRight
      })

      const effectiveWidth = maxX - minX

      // Calculate height from cabinet top to back wall top
      const cabinetTopY = parentCabinet.group.position.y + parentCabinet.carcass.dimensions.height
      const bulkheadHeight = Math.max(0, wallDimensions.height - cabinetTopY)

      // Create bulkhead using createCabinet (same pattern as filler creation)
      const bulkheadCabinet = createCabinet("bulkhead", subcategoryId, {
        productId,
        customDimensions: {
          width: effectiveWidth,
          height: bulkheadHeight,
          depth: parentCabinet.carcass.dimensions.depth,
        },
        additionalProps: {
          viewId: parentCabinet.viewId,
          bulkheadParentCabinetId: cabinetId,
          hideLockIcons: true,
        }
      })

      if (!bulkheadCabinet) return

      // Calculate world position for bulkhead
      const cabinetWorldPos = new THREE.Vector3()
      parentCabinet.group.getWorldPosition(cabinetWorldPos)

      const bulkheadWorldPos = new THREE.Vector3(
        minX + effectiveWidth / 2,
        cabinetTopY + bulkheadHeight / 2,
        cabinetWorldPos.z + parentCabinet.carcass.dimensions.depth - 16 / 2
      )

      bulkheadCabinet.group.position.copy(bulkheadWorldPos)
      bulkheadCabinet.group.name = `bulkhead_${parentCabinet.cabinetId}`

      // For overhead and tall cabinets, add return bulkheads via CarcassAssembly
      if (parentCabinet.cabinetType === 'top' || parentCabinet.cabinetType === 'tall') {
        const leftAdjacentCabinet = hasLeftAdjacentCabinet(parentCabinet, cabinets)
        const rightAdjacentCabinet = hasRightAdjacentCabinet(parentCabinet, cabinets)
        const currentCabinetDepth = parentCabinet.carcass.dimensions.depth

        let needsLeftReturn = leftAdjacentCabinet === null
        if (leftAdjacentCabinet) {
          const leftAdjacentDepth = leftAdjacentCabinet.carcass.dimensions.depth
          needsLeftReturn = currentCabinetDepth >= leftAdjacentDepth
        }

        let needsRightReturn = rightAdjacentCabinet === null
        if (rightAdjacentCabinet) {
          const rightAdjacentDepth = rightAdjacentCabinet.carcass.dimensions.depth
          needsRightReturn = currentCabinetDepth >= rightAdjacentDepth
        }

        const frontEdgeOffsetZ = parentCabinet.carcass.dimensions.depth - 16
        const returnDepth = frontEdgeOffsetZ
        const returnHeight = bulkheadHeight
        const offsetX = effectiveWidth / 2 // Distance from center to edge

        // Add returns via CarcassAssembly methods (returns are part of the bulkhead carcass)
        if (needsLeftReturn) {
          bulkheadCabinet.carcass.addBulkheadReturn('left', returnHeight, returnDepth, offsetX)
        }

        if (needsRightReturn) {
          bulkheadCabinet.carcass.addBulkheadReturn('right', returnHeight, returnDepth, offsetX)
        }
      }
    })
  }, [cabinets, wsProducts, wallDimensions, createCabinet])

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
        <div className="bg-white px-4 py-1 rounded-lg shadow-lg border border-gray-200 w-full text-center relative" data-price-box>
          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
            Total Price
            <span className="text-[8px] font-normal text-gray-500">(Incl GST)</span>
          </div>
          <div className="text-xl font-bold text-gray-800">
            ${totalPrice.toFixed(2)}
          </div>
          {/* Dropdown Arrow - Bottom Left */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowProductsDrawer(true)
            }}
            className="absolute bottom-1 left-1 p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="View Products List"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Settings and Nesting Icons - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex gap-3 z-10">
        {/* Export Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (cabinets.length === 0) {
              alert('No cabinets in the scene to export.')
              return
            }
            try {
              // Get parts from PartDataManager (uses actual calculated part dimensions from part classes)
              const partDataList = partData.getAllParts()
              if (partDataList.length === 0) {
                alert('No parts found to export.')
                return
              }

              // Convert PartData to Part format for export
              const parts = partDataList.map((part) => ({
                id: part.partId,
                label: `${part.cabinetType} ${part.cabinetId} - ${part.partName}`,
                width: Math.max(part.dimX, part.dimY, part.dimZ), // Biggest dimension
                height: [part.dimX, part.dimY, part.dimZ].sort((a, b) => b - a)[1], // Second biggest
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

              // Export to CSV
              exportPartsToCSV(parts, `nesting-parts-export-${Date.now()}.csv`)
            } catch (error) {
              console.error('Error exporting parts:', error)
              alert('Failed to export parts. Please check the console for details.')
            }
          }}
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium"
          title="Export Parts to Excel/CSV"
        >
          Export
        </button>

        {/* Nesting Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowNestingModal(true)
          }}
          className="bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 font-medium"
          title="Nesting"
        >
          Nesting
        </button>

        {/* Settings Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleSettingsClick()
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>

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
              viewManager
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
      />

      {/* Camera Movement Instructions moved to CameraControls component - appears on hover */}

      {/* Cabinet Lock Icons - appear on double-click */}
      {/* Don't show icons for fillers/panels added from modal (marked with hideLockIcons) */}
      {cabinetWithLockIcons &&
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
            wsProducts={wsProducts}
            onFillerSelect={handleFillerSelect}
            onKickerSelect={handleKickerSelect}
            onBulkheadSelect={handleBulkheadSelect}
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
          hideLockIcons: selectedCabinet.hideLockIcons
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

            // Update child cabinets (fillers/panels) when overhang changes
            if (selectedCabinet.cabinetType === 'top') {
              updateChildCabinets(selectedCabinet, cabinets, {
                overhangChanged: true
              })
            }
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
              setCabinetToDelete,
              allCabinets: cabinets
            })
            // Remove cabinet from part data database
            partData.removeCabinet(cabinetToDelete.cabinetId)
            closeDeleteModal()
          }
        }}
        itemName="the selected cabinet"
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
      <div className="fixed bottom-4 left-4 z-50 flex gap-3 items-center">
        <button
          onClick={openSaveModal}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors duration-200 font-medium"
        >
          SAVE
        </button>
      </div>
    </div>
  );
};

export default WallScene;
