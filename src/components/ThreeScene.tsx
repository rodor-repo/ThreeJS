import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Settings } from 'lucide-react'
import { Subcategory } from './categoriesData'
import { CabinetType, DoorMaterial } from './Carcass'
import ProductPanel from './ProductPanel'
import { WALL_THICKNESS } from './three/scene-utils'
import { useCameraDrag } from '../hooks/useCameraDrag'
import { useThreeRenderer } from '../hooks/useThreeRenderer'
import { useCabinets } from '../hooks/useCabinets'
import { useSceneInteractions } from '../hooks/useSceneInteractions'
import { CameraControls } from './three/CameraControls'
import { WallSettingsModal } from './three/WallSettingsModal'
import { CabinetsInfoPanel } from './three/CabinetsInfoPanel'
import type { Category, WallDimensions as WallDims } from './three/types'

interface ThreeSceneProps {
  wallDimensions: WallDims
  onDimensionsChange: (dimensions: WallDims) => void
  selectedCategory?: Category | null
  selectedSubcategory?: { category: Category; subcategory: Subcategory } | null
  isMenuOpen?: boolean
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1.5)

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

  // interactions hook wires global events and cabinet drag/select
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    zoomLevel
  })
  const cameraDrag = useCameraDrag(
    cameraRef,
    wallDimensions,
    isMenuOpen || false,
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
    cabinets,
    selectedCabinet,
    setSelectedCabinet,
    showProductPanel,
    setShowProductPanel,
    cameraDrag
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
      console.log('Subcategory selected:', selectedSubcategory.category.name, '>', selectedSubcategory.subcategory.name);

      // Create cabinet based on category and subcategory
      createCabinet(selectedSubcategory.category.id as CabinetType, selectedSubcategory.subcategory.id);
    }
  }, [selectedSubcategory]);

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
        onReset={resetCameraPosition}
        onClear={clearCabinets}
        onX={setCameraXView}
        onY={setCameraYView}
        onZ={setCameraZView}
      />

      {/* Camera Movement Instructions */}
      {isMenuOpen && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          Menu Open • Camera controls disabled
        </div>
      )}
      {isDragging && !isMenuOpen && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          3D View: Dragging • Use wheel to zoom • X/Y/Z for orthographic views
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
          doorEnabled: selectedCabinet.carcass.config.doorEnabled,
          doorCount: selectedCabinet.carcass.config.doorCount,
          doorMaterial: selectedCabinet.carcass.config.doorMaterial,
          overhangDoor: selectedCabinet.carcass.config.overhangDoor,
          drawerEnabled: selectedCabinet.carcass.config.drawerEnabled,
          drawerQuantity: selectedCabinet.carcass.config.drawerQuantity,
          drawerHeights: selectedCabinet.carcass.config.drawerHeights
        } : null}
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