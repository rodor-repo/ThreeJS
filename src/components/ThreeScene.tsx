import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Settings, X, Move } from 'lucide-react';
import { Subcategory } from './categoriesData';
import { CarcassAssembly, CarcassDimensions, CabinetType, CarcassMaterial, DoorMaterial } from './Carcass';
import ProductPanel from './ProductPanel';

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

  // Create cabinet function
  const createCabinet = (categoryType: CabinetType, subcategoryType: string) => {
    if (!sceneRef.current) return;

    // Default dimensions for different cabinet types
    const defaultDimensions: Record<CabinetType, CarcassDimensions> = {
      top: { width: 600, height: 600, depth: 300 },      // Top cabinet: 600x600x300mm
      base: { width: 600, height: 720, depth: 600 },     // Base cabinet: 600x720x600mm
      tall: { width: 600, height: 2400, depth: 600 }     // Tall cabinet: 600x2400x600mm
    };

    // Get dimensions for the selected category
    const dimensions = defaultDimensions[categoryType];
    
    // Create carcass assembly based on category type
    let carcass: CarcassAssembly;
    switch (categoryType) {
      case 'top':
        carcass = CarcassAssembly.createTopCabinet(dimensions, {
          shelfCount: 2,
          shelfSpacing: 300
        });
        break;
      case 'base':
        if (subcategoryType === 'drawer') {
          // For drawer cabinets, use the correct default height (730mm)
          const drawerDimensions = { ...dimensions, height: 730 };
          
          // For drawer cabinets, enable drawers and disable doors/shelves
          carcass = CarcassAssembly.createBaseCabinet(drawerDimensions, {
            shelfCount: 0, // No shelves for drawer cabinets
            shelfSpacing: 0,
            doorEnabled: false, // No doors for drawer cabinets
            drawerEnabled: true, // Enable drawers
            drawerQuantity: 3, // Default 3 drawers
            drawerHeights: [] // Will be calculated automatically
          });
        } else {
          // For other base cabinets, use standard configuration
          carcass = CarcassAssembly.createBaseCabinet(dimensions, {
            shelfCount: 2,
            shelfSpacing: 300
          });
        }
        break;
      case 'tall':
        carcass = CarcassAssembly.createTallCabinet(dimensions, {
          shelfCount: 4,
          shelfSpacing: 300
        });
        break;
      default:
        carcass = CarcassAssembly.createTopCabinet(dimensions, {
          shelfCount: 2,
          shelfSpacing: 300
        });
    }

    // Position cabinet based on counter (spread them out)
    const offsetX = cabinetCounter * (dimensions.width + 100);
    carcass.group.position.x = offsetX;

    // Add to scene
    sceneRef.current.add(carcass.group);
    
    // Add to cabinets list
    setCabinets(prev => [...prev, { 
      group: carcass.group, 
      carcass: carcass, 
      cabinetType: categoryType,
      subcategoryId: subcategoryType
    }]);
    
    // Increment counter for next cabinet
    setCabinetCounter(prev => prev + 1);

    console.log(`Created ${categoryType} cabinet at position ${offsetX}`);
  };

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
    const gridHelper = new THREE.GridHelper(2000, 20, 0x888888, 0xcccccc);
    gridHelper.position.set(1000, 0, 1000);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);

    // Create initial wall and floor
    createWall(scene, wallDimensions.height, wallDimensions.length, wallColor);
    createFloor(scene, wallDimensions.length);
    updateCameraPosition(camera, wallDimensions.height, wallDimensions.length);

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

    // Function to update cabinet selection highlighting
  const updateCabinetHighlighting = (newSelectedCabinet: CabinetData | null) => {
    // Remove highlighting from all cabinets
    cabinets.forEach(cabinet => {
      // Reset all wireframes to default color and properties
      cabinet.group.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          const lineMaterial = child.material as THREE.LineBasicMaterial;
          // Restore original color and linewidth
          if ((lineMaterial as any).originalColor) {
            lineMaterial.color.copy((lineMaterial as any).originalColor);
          } else {
            lineMaterial.color.setHex(0x333333); // Default dark gray
          }
          
          if ((lineMaterial as any).originalLinewidth !== undefined) {
            lineMaterial.linewidth = (lineMaterial as any).originalLinewidth;
          } else {
            lineMaterial.linewidth = 1; // Default linewidth
          }
        }
      });
      
      // Restore original material colors
      cabinet.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.Material;
          if (material.color && (material as any).originalColor) {
            material.color.copy((material as any).originalColor);
          }
        }
      });
      
      // No bounding box to clean up - using only wireframe color changes
    });

    // Add highlighting to selected cabinet
    if (newSelectedCabinet) {
      // Enhanced wireframe highlighting - make selected cabinet wireframes more prominent
      newSelectedCabinet.group.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          const lineMaterial = child.material as THREE.LineBasicMaterial;
          // Store original color and properties
          (lineMaterial as any).originalColor = (lineMaterial as any).originalColor || lineMaterial.color.clone();
          (lineMaterial as any).originalLinewidth = lineMaterial.linewidth || 1;
          
          // Set selection highlighting
          lineMaterial.color.setHex(0x00ff00); // Bright green for selection
          lineMaterial.linewidth = 3; // Thicker lines for better visibility
        }
      });

      // Enhanced wireframe highlighting without additional bounding box
      // This prevents duplicate wireframes and positioning issues

      // Add subtle glow effect by making materials slightly brighter
      newSelectedCabinet.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.Material;
          if (material.color) {
            // Store original color and make it slightly brighter
            (material as any).originalColor = (material as any).originalColor || material.color.clone();
            material.color.multiplyScalar(1.2); // 20% brighter
          }
        }
      });
    }
  };

  // Function to add hover effect for draggable cabinets
  const addHoverEffect = (cabinet: CabinetData) => {
    if (cabinet === selectedCabinet) {
      // Add cursor pointer and make wireframes slightly pulsing
      cabinet.group.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          const lineMaterial = child.material as THREE.LineBasicMaterial;
          // Make wireframes slightly brighter when hovering over selected cabinet
          if (lineMaterial.color.getHex() === 0x00ff00) {
            lineMaterial.color.setHex(0x00ff88); // Brighter green for hover
          }
        }
      });
    }
  };

  // Function to remove hover effect
  const removeHoverEffect = (cabinet: CabinetData) => {
    if (cabinet === selectedCabinet) {
      // Restore selection highlighting
      cabinet.group.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          const lineMaterial = child.material as THREE.LineBasicMaterial;
          lineMaterial.color.setHex(0x00ff00); // Back to selection green
        }
      });
    }
  };

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
        moveCameraWithMouse(event);
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
      scene.remove(floorRef.current);
      floorRef.current.geometry.dispose();
      if (floorRef.current.material) {
        if (Array.isArray(floorRef.current.material)) {
          floorRef.current.material.forEach(mat => mat.dispose());
        } else {
          floorRef.current.material.dispose();
        }
      }
    }

    // Remove existing floor grid
    if (floorGridRef.current) {
      scene.remove(floorGridRef.current);
      floorGridRef.current.geometry.dispose();
      floorGridRef.current.material.dispose();
    }

    // Floor dimensions - extends from origin along wall length and positive Z
    const floorWidth = wallLength; // Along X-axis (same as wall length)
    const floorDepth = wallLength; // Along Z-axis (positive direction only)
    
    // Create floor geometry
    const geometry = new THREE.PlaneGeometry(floorWidth, floorDepth, 600, 600);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x1e3a8a, // Dark blue for wireframe lines
      transparent: true,
      opacity: 0, // Fully transparent surface
      wireframe: true // Show only the mesh lines
    });
    
    const floor = new THREE.Mesh(geometry, material);
    
    // Position floor: starts at origin, extends in positive X and positive Z
    // Rotate to be horizontal and position correctly
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.set(floorWidth / 2, 0, floorDepth / 2);
    floor.receiveShadow = true;
    
    floorRef.current = floor;
    scene.add(floor);

    // Add floor grid lines
    const floorGrid = new THREE.GridHelper(floorDepth, Math.floor(floorDepth / 100), 0xcccccc, 0xe0e0e0);
    floorGrid.position.set(floorWidth / 2, 0.1, floorDepth / 2);
    floorGridRef.current = floorGrid;
    scene.add(floorGrid);
  };

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

    // Wall dimensions in mm
    const wallThickness = 90;
    
    // Create wall group to contain both mesh and wireframe
    const wallGroup = new THREE.Group();
    
    // Create wall geometry
    // Position: starts from origin, extends along positive X, depth toward negative Z
    const geometry = new THREE.BoxGeometry(length, height, wallThickness);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });
    
    const wall = new THREE.Mesh(geometry, material);
    
    // Position wall: center at (length/2, height/2, -thickness/2)
    wall.position.set(length / 2, height / 2, -wallThickness / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    
    wallGroup.add(wall);

    // Add wireframe outline
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x666666 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.copy(wall.position);
    wallGroup.add(wireframe);
    
    wallRef.current = wallGroup;
    scene.add(wallGroup);
  };

  // Update camera position based on wall dimensions
  const updateCameraPosition = (camera: THREE.PerspectiveCamera, height: number, length: number) => {
    const wallThickness = 90;
    
    // Camera position: center of wall + zoom level distance in Z
    const wallCenterX = length / 2;
    const wallCenterY = height / 2;
    const wallCenterZ = -wallThickness / 2;
    
    const cameraDistance = zoomLevel * length;
    
    // Camera Y position: 25% above wall center (125% of half height)
    const cameraY = height * 0.625; // This gives 25% above center
    
    camera.position.set(
      wallCenterX,
      cameraY,
      wallCenterZ + cameraDistance
    );
    
    // Calculate lookAt point for 15-degree downward angle
    const angleRadians = (15 * Math.PI) / 180; // Convert 15 degrees to radians
    const lookAtY = cameraY - cameraDistance * Math.tan(angleRadians);
    
    // Look at the calculated point (15 degrees downward)
    camera.lookAt(wallCenterX, lookAtY, wallCenterZ);
  };

  // Move camera within bounds based on mouse position (now with relative movement)
  const moveCameraWithMouse = (event: MouseEvent) => {
    if (isMenuOpen || !isDragging || !cameraRef.current) {
      // If menu is open or not dragging, ensure dragging state is reset
      if (isMenuOpen && isDragging) {
        setIsDragging(false);
      }
      return;
    }

    const camera = cameraRef.current;
    
    // Camera movement sensitivity multiplier
    const movementSensitivity = 1.5; // Makes camera move 1.5x more than mouse

    // Calculate mouse movement delta from drag start position
    const currentMouseX = event.clientX / window.innerWidth;
    const currentMouseY = 1 - (event.clientY / window.innerHeight);
    
    const deltaX = (currentMouseX - dragStart.x) * wallDimensions.length * movementSensitivity;
    const deltaY = (currentMouseY - dragStart.y) * wallDimensions.height * movementSensitivity;

    // Only move if there's actual mouse movement (prevents initial jump)
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      return; // No movement, stay in current position
    }

    // Apply delta movement to camera's starting position (inverted for opposite movement)
    const newCameraX = cameraStart.x - deltaX; // Inverted X movement
    const newCameraY = cameraStart.y - deltaY; // Inverted Y movement

    // Extended bounds for wider exploration
    const clampedX = Math.max(-wallDimensions.length * 0.5, Math.min(wallDimensions.length * 1.5, newCameraX));
    const clampedY = Math.max(-wallDimensions.height * 0.5, Math.min(wallDimensions.height * 1.5, newCameraY));

    // Update camera position (keep same Z)
    camera.position.set(clampedX, clampedY, camera.position.z);
    
    // Look at wall center
    const wallCenterX = wallDimensions.length / 2;
    const wallCenterY = wallDimensions.height / 2;
    const wallThickness = 90;
    const wallCenterZ = -wallThickness / 2;
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

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
      
      // Start camera dragging
      setIsDragging(true);
      setIsDraggingCabinet(false);
      
      // Capture starting positions for camera movement
      setDragStart({
        x: event.clientX / window.innerWidth,
        y: 1 - (event.clientY / window.innerHeight)
      });
      
      setCameraStart({
        x: cameraRef.current.position.x,
        y: cameraRef.current.position.y
      });
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
      setIsDragging(false);
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
      setIsDragging(false);
      return;
    }
    
    // Check if the wheel event is on the ProductPanel or its children
    if (isEventOnProductPanel(event.target)) {
      // Wheel event is on ProductPanel - don't handle zoom
      return;
    }
    
    event.preventDefault();
    
    const zoomSpeed = 0.1;
    const minZoom = 0.3; // Minimum distance (0.3x wall length)
    const maxZoom = 5.0;  // Maximum distance (5x wall length)
    
    // Determine zoom direction
    const deltaY = event.deltaY;
    let newZoomLevel = zoomLevel;
    
    if (deltaY > 0) {
      // Zoom out
      newZoomLevel = Math.min(maxZoom, zoomLevel + zoomSpeed);
    } else {
      // Zoom in
      newZoomLevel = Math.max(minZoom, zoomLevel - zoomSpeed);
    }
    
    setZoomLevel(newZoomLevel);
    
    // Update camera position immediately if not dragging
    if (!isDragging && cameraRef.current) {
      const camera = cameraRef.current;
      const wallThickness = 90;
      const wallCenterZ = -wallThickness / 2;
      const cameraDistance = newZoomLevel * wallDimensions.length;
      
      // Keep current X,Y position but update Z
      const currentX = camera.position.x;
      const currentY = camera.position.y;
      camera.position.set(currentX, currentY, wallCenterZ + cameraDistance);
      
      // Update look-at target
      const wallCenterX = wallDimensions.length / 2;
      const wallCenterY = wallDimensions.height / 2;
      camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
    }
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
      event.preventDefault();
      setZoomLevel(1.5); // Reset to default zoom
      resetCameraPosition();
    }
  };

  // Reset camera to default position
  const resetCameraPosition = () => {
    if (cameraRef.current) {
      updateCameraPosition(cameraRef.current, wallDimensions.height, wallDimensions.length);
    }
  };

  // Set camera to X view (Side view - looking at wall profile)
  const setCameraXView = () => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    const wallThickness = 90;
    const wallCenterX = wallDimensions.length / 2;
    const wallCenterY = wallDimensions.height / 2;
    const wallCenterZ = -wallThickness / 2;
    
    // Position camera to the side (positive X direction)
    const distance = wallDimensions.length * 1.5;
    camera.position.set(wallDimensions.length + distance, wallCenterY, wallCenterZ);
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

  // Set camera to Y view (Front view - looking at wall face)
  const setCameraYView = () => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    const wallThickness = 90;
    const wallCenterX = wallDimensions.length / 2;
    const wallCenterY = wallDimensions.height / 2;
    const wallCenterZ = -wallThickness / 2;
    
    // Position camera in front of wall (positive Z direction)
    const distance = wallDimensions.length * 1.5;
    camera.position.set(wallCenterX, wallCenterY, wallCenterZ + distance);
    camera.lookAt(wallCenterX, wallCenterY, wallCenterZ);
  };

  // Set camera to Z view (Top view - looking down at wall)
  const setCameraZView = () => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    const wallThickness = 90;
    const wallCenterX = wallDimensions.length / 2;
    const wallCenterY = wallDimensions.height / 2;
    const wallCenterZ = -wallThickness / 2;
    
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
          className={`${
            isDragging 
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
            
            // Update the selectedCabinet state with the new drawer heights from the carcass
            setSelectedCabinet({
              ...selectedCabinet,
              drawerEnabled: enabled,
              drawerHeights: selectedCabinet.carcass.getDrawerHeights(),
              // Keep the original carcass object intact
              carcass: selectedCabinet.carcass
            });
          }
        }}
        onDrawerQuantityChange={(quantity) => {
          if (selectedCabinet) {
            console.log('Updating drawer quantity:', quantity);
            
            // Update drawer quantity directly on the carcass
            selectedCabinet.carcass.updateDrawerQuantity(quantity);
            
            // Update the selectedCabinet state with the new drawer heights from the carcass
            setSelectedCabinet({
              ...selectedCabinet,
              drawerQuantity: quantity,
              drawerHeights: selectedCabinet.carcass.getDrawerHeights(),
              // Keep the original carcass object intact
              carcass: selectedCabinet.carcass
            });
          }
        }}
        onDrawerHeightChange={(index, height) => {
          if (selectedCabinet) {
            console.log('Updating drawer height:', index, height);
            
            // Update individual drawer height directly on the carcass
            selectedCabinet.carcass.updateDrawerHeight(index, height);
            
            // Update the selectedCabinet state with the new drawer heights from the carcass
            setSelectedCabinet({
              ...selectedCabinet,
              drawerHeights: selectedCabinet.carcass.getDrawerHeights(),
              // Keep the original carcass object intact
              carcass: selectedCabinet.carcass
            });
          }
        }}
        onDrawerHeightsBalance={() => {
          if (selectedCabinet) {
            console.log('Balancing drawer heights');
            
            // Balance drawer heights directly on the carcass
            selectedCabinet.carcass.balanceDrawerHeights();
            
            // Update the selectedCabinet state with the balanced drawer heights from the carcass
            setSelectedCabinet({
              ...selectedCabinet,
              drawerHeights: selectedCabinet.carcass.getDrawerHeights(),
              // Keep the original carcass object intact
              carcass: selectedCabinet.carcass
            });
          }
        }}
        onDrawerHeightsReset={() => {
          if (selectedCabinet) {
            console.log('Resetting drawer heights to optimal');
            
            // Get optimal drawer heights from the carcass
            const optimalHeights = selectedCabinet.carcass.getOptimalDrawerHeights();
            
            // Reset drawer heights directly on the carcass
            selectedCabinet.carcass.config.drawerHeights = [...optimalHeights];
            selectedCabinet.carcass.updateDrawerPositions();
            
            // Update the selectedCabinet state with the optimal drawer heights from the carcass
            setSelectedCabinet({
              ...selectedCabinet,
              drawerHeights: selectedCabinet.carcass.getDrawerHeights(),
              // Keep the original carcass object intact
              carcass: selectedCabinet.carcass
            });
          }
        }}
      />
    </div>
  );
};

export default WallScene;