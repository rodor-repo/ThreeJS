import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Settings, X, Move } from 'lucide-react';
import { Subcategory } from './categoriesData';
import { CarcassAssembly, CarcassDimensions, CabinetType, CarcassMaterial, DoorMaterial } from './Carcass';
import ProductPanel from './ProductPanel';
import { buildWall, buildFloor, positionCamera, lookAtWallCenter, WALL_THICKNESS } from './three/scene-utils'
import { createCabinet as createCabinetEntry } from './three/cabinet-factory'
import { clearHighlight, highlightSelected, pulseHover, unpulseHover } from './three/selection'
import { useCameraDrag } from '../hooks/useCameraDrag'

interface WallDimensions {
  height: number;
  length: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface CabinetData {
  group: THREE.Group;
  carcass: CarcassAssembly;
  cabinetType: CabinetType;
  subcategoryId: string;
}

interface ThreeSceneProps {
  wallDimensions: WallDimensions;
  onDimensionsChange: (dimensions: WallDimensions) => void;
  selectedCategory?: Category | null;
  selectedSubcategory?: { category: Category; subcategory: Subcategory } | null;
  isMenuOpen?: boolean;
}

const WallScene: React.FC<ThreeSceneProps> = ({ wallDimensions, onDimensionsChange, selectedCategory, selectedSubcategory, isMenuOpen = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallRef = useRef<THREE.Group | null>(null);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const floorGridRef = useRef<THREE.GridHelper | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingCabinet, setIsDraggingCabinet] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cameraStart, setCameraStart] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.5); // Default 1.5x wall length

  // Cabinet management
  const [cabinets, setCabinets] = useState<CabinetData[]>([]);
  const [cabinetCounter, setCabinetCounter] = useState(0);

  // Product Panel state
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [selectedCabinet, setSelectedCabinet] = useState<CabinetData | null>(null);

  // Helper function to check if an event target is on the ProductPanel
  const isEventOnProductPanel = (target: EventTarget | null): boolean => {
    if (!target) return false;
    const element = target as HTMLElement;
    return !!(element.closest('.product-panel') || element.closest('[data-product-panel]'));
  };

  // Helper function to check if mouse is over a selected cabinet
  const isMouseOverSelectedCabinet = (mouseX: number, mouseY: number): boolean => {
    if (!selectedCabinet || !cameraRef.current) return false;

    const mouse = new THREE.Vector2();
    mouse.x = (mouseX / window.innerWidth) * 2 - 1;
    mouse.y = -(mouseY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Check intersection with the selected cabinet
    const intersects = raycaster.intersectObject(selectedCabinet.group, true);
    return intersects.length > 0;
  };

  // Create cabinet function via factory
  const createCabinet = (categoryType: CabinetType, subcategoryType: string) => {
    if (!sceneRef.current) return
    const data = createCabinetEntry(categoryType, subcategoryType, {
      indexOffset: cabinetCounter
    })
    sceneRef.current.add(data.group)
    setCabinets(prev => [...prev, data])
    setCabinetCounter(prev => prev + 1)
    console.log(`Created ${categoryType} cabinet index ${cabinetCounter}`)
  }

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

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      50000
    );
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5000, 5000, 5000);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Grid helper - smaller grid for reference
    const gridHelper = new THREE.GridHelper(2000, 20, 0x888888, 0xcccccc)
    gridHelper.position.set(1000, 0, 1000)
    scene.add(gridHelper)

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);

    // Create initial wall and floor
    createWall(scene, wallDimensions.height, wallDimensions.length, wallColor)
    createFloor(scene, wallDimensions.length)
    updateCameraPosition(camera, wallDimensions.height, wallDimensions.length)

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();

      // Dispose all cabinets
      cabinets.forEach(cabinet => {
        if (sceneRef.current) {
          sceneRef.current.remove(cabinet.group);
        }
      });
      setCabinets([]);
    };
  }, []);

  // Function to update cabinet selection highlighting via utilities
  const updateCabinetHighlighting = (newSelectedCabinet: CabinetData | null) => {
    cabinets.forEach(c => clearHighlight(c.group))
    if (newSelectedCabinet) highlightSelected(newSelectedCabinet.group)
  }

  const addHoverEffect = (cabinet: CabinetData) => {
    if (cabinet === selectedCabinet) pulseHover(cabinet.group)
  }

  // Function to remove hover effect
  const removeHoverEffect = (cabinet: CabinetData) => {
    if (cabinet === selectedCabinet) unpulseHover(cabinet.group)
  }

  // Update highlighting when selectedCabinet changes
  useEffect(() => {
    updateCabinetHighlighting(selectedCabinet);
  }, [selectedCabinet, cabinets]);

  // Handle mouse listeners for camera movement and zoom
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDraggingCabinet) {
        moveCabinetWithMouse(event);
      } else if (isDragging && cameraRef.current) {
        cameraDrag.move(event.clientX, event.clientY)
      }
    };

    const handleGlobalMouseDown = (event: MouseEvent) => handleMouseDown(event);
    const handleGlobalMouseUp = (event: MouseEvent) => handleMouseUp(event);
    const handleGlobalWheel = (event: WheelEvent) => handleWheel(event);
    const handleGlobalMiddleClick = (event: MouseEvent) => handleMiddleClick(event);
    const handleContextMenu = (event: Event) => event.preventDefault();

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('wheel', handleGlobalWheel, { passive: false });
    document.addEventListener('mousedown', handleGlobalMiddleClick);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('wheel', handleGlobalWheel);
      document.removeEventListener('mousedown', handleGlobalMiddleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isDragging, isDraggingCabinet, zoomLevel, wallDimensions.length, wallDimensions.height, dragStart, cameraStart, isMenuOpen]);

  // Create floor geometry
  const createFloor = (scene: THREE.Scene, wallLength: number) => {
    // Remove existing floor
    if (floorRef.current) {
      scene.remove(floorRef.current)
      floorRef.current.geometry.dispose()
      if (floorRef.current.material) {
        if (Array.isArray(floorRef.current.material)) {
          floorRef.current.material.forEach(mat => mat.dispose())
        } else {
          floorRef.current.material.dispose()
        }
      }
    }

    // Remove existing floor grid
    if (floorGridRef.current) {
      scene.remove(floorGridRef.current)
      floorGridRef.current.geometry.dispose()
        ; (floorGridRef.current.material as THREE.Material).dispose()
    }

    const { floor, grid } = buildFloor(wallLength)
    floorRef.current = floor
    floorGridRef.current = grid
    scene.add(floor)
    scene.add(grid)
  }

  // Create wall geometry
  const createWall = (scene: THREE.Scene, height: number, length: number, color: string = '#dcbfa0') => {
    // Remove existing wall group
    if (wallRef.current) {
      scene.remove(wallRef.current);
      // Dispose of all geometries and materials in the group
      wallRef.current.traverse((child) => {
        if ('geometry' in child && child.geometry) {
          (child as any).geometry.dispose();
        }
        if ('material' in child && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    }

    const wallGroup = buildWall({ height, length }, color)
    wallRef.current = wallGroup
    scene.add(wallGroup)
  };

  // Update camera position based on wall dimensions
  const updateCameraPosition = (camera: THREE.PerspectiveCamera, height: number, length: number) => {
    positionCamera(camera, { height, length }, zoomLevel)
  }

  // Hook for camera drag/zoom
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    cameraStart: { x: 0, y: 0 },
    zoomLevel
  })
  const cameraDrag = useCameraDrag(
    cameraRef,
    wallDimensions,
    isMenuOpen,
    dragState,
    (next) => {
      setDragState(prev => ({ ...prev, ...next }))
      if (next.zoomLevel !== undefined) setZoomLevel(next.zoomLevel)
      if (next.isDragging !== undefined) setIsDragging(next.isDragging)
    }
  )

  // Move selected cabinet based on mouse movement
  const moveCabinetWithMouse = (event: MouseEvent) => {
    if (!selectedCabinet || !isDraggingCabinet) return;

    const camera = cameraRef.current;
    if (!camera) return;

    // Calculate mouse movement delta
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;

    // Convert screen delta to world space movement
    const worldDeltaX = (deltaX / window.innerWidth) * wallDimensions.length * 0.8;
    const worldDeltaY = -(deltaY / window.innerHeight) * wallDimensions.height * 0.8;

    // Get current cabinet position
    const currentX = selectedCabinet.group.position.x;
    const currentY = selectedCabinet.group.position.y;

    // Calculate new position based on cabinet type
    let newX = currentX + worldDeltaX;
    let newY = currentY + worldDeltaY;

    // Apply movement constraints based on cabinet type
    if (selectedCabinet.cabinetType === 'top') {
      // Top cabinets can move on X and Y axes
      newX = Math.max(0, Math.min(wallDimensions.length - selectedCabinet.carcass.dimensions.width, newX));
      newY = Math.max(0, Math.min(wallDimensions.height - selectedCabinet.carcass.dimensions.height, newY));
    } else {
      // Base/Tall cabinets can only move on X axis
      newX = Math.max(0, Math.min(wallDimensions.length - selectedCabinet.carcass.dimensions.width, newX));
      newY = currentY; // Keep Y position fixed
    }

    // Update cabinet position
    selectedCabinet.group.position.set(newX, newY, selectedCabinet.group.position.z);

    // Update drag start to prevent jumping
    setDragStart({ x: event.clientX, y: event.clientY });
  };

  // Handle mouse down (start dragging)
  const handleMouseDown = (event: MouseEvent) => {
    if (isMenuOpen) {
      // If menu is open, ensure dragging is stopped and return
      setIsDragging(false);
      setIsDraggingCabinet(false);
      return;
    }

    // Check if the click is on the ProductPanel or its children
    if (isEventOnProductPanel(event.target)) {
      // Click is on ProductPanel - don't handle camera movement or panel closing
      return;
    }

    if (event.button === 0 && cameraRef.current) { // Left mouse button
      // Check if mouse is over selected cabinet
      if (selectedCabinet && isMouseOverSelectedCabinet(event.clientX, event.clientY)) {
        // Start cabinet dragging
        setIsDraggingCabinet(true);
        setIsDragging(false);

        // Capture starting positions for cabinet dragging
        setDragStart({
          x: event.clientX,
          y: event.clientY
        });

        console.log('Started dragging cabinet:', selectedCabinet.cabinetType);
        return;
      }

      // Check if clicking on empty space to close ProductPanel
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // Check intersection with cabinets
      const cabinetMeshes: THREE.Object3D[] = [];
      cabinets.forEach(cabinet => {
        cabinet.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            cabinetMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(cabinetMeshes);

      if (intersects.length === 0) {
        // Clicked on empty space - close ProductPanel
        setShowProductPanel(false);
        setSelectedCabinet(null);
      }

      // Start camera dragging via hook
      setIsDraggingCabinet(false)
      cameraDrag.startDrag(event.clientX, event.clientY)
    } else if (event.button === 2 && cameraRef.current && sceneRef.current) { // Right mouse button
      event.preventDefault();

      // Raycasting to detect cabinet selection
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // Check intersection with cabinets
      const cabinetMeshes: THREE.Object3D[] = [];
      cabinets.forEach(cabinet => {
        cabinet.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            cabinetMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(cabinetMeshes);

      if (intersects.length > 0) {
        // Find which cabinet this mesh belongs to
        const intersectedMesh = intersects[0].object;
        let selectedCabinetData: CabinetData | null = null;

        for (const cabinet of cabinets) {
          let found = false;
          cabinet.group.traverse((child) => {
            if (child === intersectedMesh) {
              found = true;
            }
          });
          if (found) {
            selectedCabinetData = cabinet;
            break;
          }
        }

        if (selectedCabinetData) {
          setSelectedCabinet(selectedCabinetData);
          setShowProductPanel(true);
        }
      } else {
        // No cabinet was clicked - close ProductPanel
        setShowProductPanel(false);
        setSelectedCabinet(null);
      }
    }
  };

  // Handle mouse up (stop dragging)
  const handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) { // Left mouse button
      cameraDrag.end()
      setIsDraggingCabinet(false);

      if (isDraggingCabinet) {
        console.log('Stopped dragging cabinet');
      }
    }
  };

  // Handle zoom with wheel/touchpad
  const handleWheel = (event: WheelEvent) => {
    if (isMenuOpen) {
      // If menu is open, ensure dragging is stopped and return
      setIsDragging(false)
      return;
    }

    // Check if the wheel event is on the ProductPanel or its children
    if (isEventOnProductPanel(event.target)) {
      // Wheel event is on ProductPanel - don't handle zoom
      return;
    }

    event.preventDefault();

    cameraDrag.wheel(event.deltaY)
  };

  // Handle middle mouse button for zoom reset
  const handleMiddleClick = (event: MouseEvent) => {
    if (isMenuOpen) {
      // If menu is open, ensure dragging is stopped and return
      setIsDragging(false);
      return;
    }

    // Check if the click is on ProductPanel - don't handle zoom reset
    if (isEventOnProductPanel(event.target)) {
      // Click is on ProductPanel - don't handle zoom reset
      return;
    }

    if (event.button === 1) { // Middle mouse button
      event.preventDefault()
      cameraDrag.middleClick()
    }
  };

  // Reset camera to default position
  const resetCameraPosition = () => {
    if (cameraRef.current) {
      updateCameraPosition(cameraRef.current, wallDimensions.height, wallDimensions.length)
    }
  };

  // Set camera to X view (Side view - looking at wall profile)
  const setCameraXView = () => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2

    // Position camera to the side (positive X direction)
    const distance = wallDimensions.length * 1.5;
    camera.position.set(wallDimensions.length + distance, wallCenterY, wallCenterZ);
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

  // Set camera to Y view (Front view - looking at wall face)
  const setCameraYView = () => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2

    // Position camera in front of wall (positive Z direction)
    const distance = wallDimensions.length * 1.5;
    camera.position.set(wallCenterX, wallCenterY, wallCenterZ + distance);
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

  // Set camera to Z view (Top view - looking down at wall)
  const setCameraZView = () => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const wallCenterX = wallDimensions.length / 2
    const wallCenterY = wallDimensions.height / 2
    const wallCenterZ = -WALL_THICKNESS / 2

    // Position camera above wall (positive Y direction)
    const distance = Math.max(wallDimensions.length, wallDimensions.height) * 1.5;
    camera.position.set(wallCenterX, wallCenterY + distance, wallCenterZ);
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

  // Handle wall dimension changes
  const handleDimensionChange = (newDimensions: WallDimensions, newColor?: string) => {
    onDimensionsChange(newDimensions);

    if (sceneRef.current && cameraRef.current) {
      // Use new color if provided, otherwise use current wall color
      const colorToUse = newColor || wallColor;
      createWall(sceneRef.current, newDimensions.height, newDimensions.length, colorToUse);
      createFloor(sceneRef.current, newDimensions.length);
      updateCameraPosition(cameraRef.current, newDimensions.height, newDimensions.length);
    }
  };

  // Modal form handlers
  const [tempHeight, setTempHeight] = useState(wallDimensions.height);
  const [tempLength, setTempLength] = useState(wallDimensions.length);
  const [wallColor, setWallColor] = useState('#dcbfa0'); // Default beige color
  const [tempWallColor, setTempWallColor] = useState('#dcbfa0');

  const handleApply = () => {
    const newDimensions = {
      height: Math.max(100, tempHeight),
      length: Math.max(100, tempLength)
    };

    // Update wall color first if it changed
    if (tempWallColor !== wallColor) {
      setWallColor(tempWallColor);
    }

    // Pass the new color to handleDimensionChange so it creates the wall with the correct color
    handleDimensionChange(newDimensions, tempWallColor);
    setShowModal(false);
  };

  const handleModalOpen = () => {
    setTempHeight(wallDimensions.height);
    setTempLength(wallDimensions.length);
    setTempWallColor(wallColor);
    setShowModal(true);
  };

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
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        {/* 3D Move Control */}
        <button
          onClick={resetCameraPosition}
          className={`${isDragging
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-600 hover:bg-gray-700'
            } text-white p-3 rounded-full shadow-lg transition-colors duration-200`}
          title="3D View: Drag to move camera • Wheel: Zoom • Middle click: Reset"
        >
          <Move size={24} />
        </button>

        {/* Clear Cabinets Button */}
        <button
          onClick={() => {
            if (sceneRef.current) {
              cabinets.forEach(cabinet => {
                sceneRef.current!.remove(cabinet.group);
              });
              setCabinets([]);
              setCabinetCounter(0);
            }
          }}
          className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Clear all cabinets"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">C</span>
          </div>
        </button>

        {/* X View (Side View) */}
        <button
          onClick={setCameraXView}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="X View: Side view of wall (profile)"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">X</span>
          </div>
        </button>

        {/* Y View (Front View) */}
        <button
          onClick={setCameraYView}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Y View: Front view of wall (face-on)"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">Y</span>
          </div>
        </button>

        {/* Z View (Top View) */}
        <button
          onClick={setCameraZView}
          className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
          title="Z View: Top view of wall (from above)"
        >
          <div className="flex items-center justify-center w-6 h-6">
            <span className="text-lg font-bold">Z</span>
          </div>
        </button>
      </div>

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

      {/* Cabinet Information */}
      {cabinets.length > 0 && (
        <div className="absolute top-16 right-4 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg text-sm z-10 max-w-xs">
          <div className="font-semibold mb-2">Cabinets in Scene:</div>
          <div className="space-y-1">
            {cabinets.map((cabinet, index) => (
              <div key={index} className="text-xs">
                Cabinet {index + 1}: {cabinet.carcass.group.name || 'Unknown Type'}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Total: {cabinets.length} cabinet{cabinets.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-90vw">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Wall Dimensions</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
                  Height (mm)
                </label>
                <input
                  type="number"
                  id="height"
                  value={tempHeight}
                  onChange={(e) => setTempHeight(Number(e.target.value) || 0)}
                  min="100"
                  max="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-1">
                  Length (mm)
                </label>
                <input
                  type="number"
                  id="length"
                  value={tempLength}
                  onChange={(e) => setTempLength(Number(e.target.value) || 0)}
                  min="100"
                  max="20000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="wallColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Wall Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="wallColor"
                    value={tempWallColor}
                    onChange={(e) => setTempWallColor(e.target.value)}
                    className="w-16 h-12 border border-gray-300 rounded-md cursor-pointer"
                    title="Click to change wall color"
                  />
                  <input
                    type="text"
                    value={tempWallColor}
                    onChange={(e) => setTempWallColor(e.target.value)}
                    placeholder="#dcbfa0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                {/* Live preview of the color change */}
                <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                  <span>Preview:</span>
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: tempWallColor }}
                    title={`Preview: ${tempWallColor}`}
                  />
                  <span className="font-mono text-xs">{tempWallColor}</span>
                  {tempWallColor !== wallColor && (
                    <span className="text-blue-600 text-xs">(Color will change)</span>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <p><strong>Current dimensions:</strong></p>
                <p>Height: {wallDimensions.height}mm</p>
                <p>Length: {wallDimensions.length}mm</p>
                <p>Thickness: 90mm (fixed)</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span><strong>Color:</strong></span>
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: wallColor }}
                    title={`Current wall color: ${wallColor}`}
                  />
                  <span className="font-mono text-xs">{wallColor}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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