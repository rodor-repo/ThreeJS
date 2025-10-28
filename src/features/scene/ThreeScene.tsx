import { CabinetType, DoorMaterial } from '@/features/carcass'
import { Subcategory } from '@/components/categoriesData'
import { Settings } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useCabinets } from '../cabinets/hooks/useCabinets'
import { CabinetsInfoPanel } from '../cabinets/ui/CabinetsInfoPanel'
import ProductPanel from '../cabinets/ui/ProductPanel'
import { useCameraDrag } from './hooks/useCameraDrag'
import { useSceneInteractions } from './hooks/useSceneInteractions'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useThreeRenderer } from './hooks/useThreeRenderer'
import type { Category, WallDimensions as WallDims } from './types'
import { CameraControls } from './ui/CameraControls'
import { WallSettingsModal } from './ui/WallSettingsModal'
import { WsProducts } from '@/types/erpTypes'

interface ThreeSceneProps {
  wallDimensions: WallDims
  onDimensionsChange: (dimensions: WallDims) => void
  selectedCategory?: Category | null
  selectedSubcategory?: { category: Category; subcategory: Subcategory } | null
  isMenuOpen?: boolean
  /** Optional productId selected from the menu to associate with the created 3D object */
  selectedProductId?: string
  wsProducts?: WsProducts | null
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false, selectedProductId, wsProducts }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1.5)
  const [cameraMode, setCameraMode] = useState<'constrained' | 'free'>('constrained')

  const {
    sceneRef,
    cameraRef,
    createWall,
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
    setSelectedCabinet,
    showProductPanel,
    setShowProductPanel,
    createCabinet,
    clearCabinets
  } = useCabinets(sceneRef)

  // Snap guides for visual feedback during cabinet dragging
  const { updateSnapGuides, clearSnapGuides } = useSnapGuides(sceneRef, wallDimensions)

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
  useSceneInteractions(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
    cameraMode,
    cabinets,
    selectedCabinet,
    setSelectedCabinet,
    showProductPanel,
    setShowProductPanel,
    cameraDrag,
    updateSnapGuides,
    clearSnapGuides
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
      createWall(newDimensions.height, newDimensions.length, newColor)
      createFloor(newDimensions.length)
      if (cameraRef.current) updateCameraPosition(newDimensions.height, newDimensions.length, zoomLevel)
    }
  };

  // Modal form handlers
  const [wallColor, setWallColor] = useState('#dcbfa0')
  const handleApplyModal = (dims: WallDims, color: string) => {
    if (color !== wallColor) setWallColor(color)
    handleDimensionChange(dims, color)
    setShowModal(false)
  }
  const handleModalOpen = () => setShowModal(true)

  // When the product panel opens for a selected cabinet, try loading its WsProduct config

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Scene Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Settings Icon */}
      <button
        onClick={handleModalOpen}
        className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200 z-10"
        title="Wall Settings"
      >
        <Settings size={24} />
      </button>

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
      />

      {/* Camera Movement Instructions */}
      {isMenuOpen && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          Menu Open • Camera controls disabled
        </div>
      )}
      {!isMenuOpen && cameraMode === 'constrained' && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          Constrained Mode • Drag to pan • Wheel to zoom • Right-click cabinet to select
        </div>
      )}
      {!isMenuOpen && cameraMode === 'free' && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          Free Mode • Drag to rotate • Right-drag to pan • Shift+click cabinets
        </div>
      )}

      <CabinetsInfoPanel cabinets={cabinets} />

      <WallSettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        wallDimensions={wallDimensions}
        wallColor={wallColor}
        onApply={handleApplyModal}
      />

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
          cabinetId: selectedCabinet.cabinetId
        } : null}

        onShelfCountChange={(newCount: number) => { if (selectedCabinet) selectedCabinet.carcass.updateConfig({ shelfCount: newCount }); }}

        onDimensionsChange={(newDimensions) => {
          if (selectedCabinet) {
            // Update the carcass dimensions
            selectedCabinet.carcass.updateDimensions(newDimensions);
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
    </div>
  );
};

export default WallScene;