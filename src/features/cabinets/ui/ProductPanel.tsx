import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Settings, Palette, Ruler, DoorOpen } from 'lucide-react';
import { CarcassDimensions, CarcassMaterial, CarcassMaterialData, DoorMaterial, DoorMaterialData } from '../../../components/Carcass';
import { categoriesData } from '../../../components/categoriesData';

interface ProductPanelProps {
  isVisible: boolean;
  onClose: () => void;
  selectedCabinet?: {
    group: THREE.Group;
    dimensions: CarcassDimensions;
    material: CarcassMaterial;
    cabinetType: string;
    subcategoryId?: string;
    doorEnabled?: boolean;
    doorCount?: number;
    doorMaterial?: DoorMaterial;
    overhangDoor?: boolean;
    drawerEnabled?: boolean;
    drawerQuantity?: number;
    drawerHeights?: number[];
    carcass?: any; // Add carcass property for direct access
  } | null;
  onDimensionsChange?: (dimensions: CarcassDimensions) => void;
  onMaterialChange?: (material: Partial<CarcassMaterialData>) => void;
  onKickerHeightChange?: (kickerHeight: number) => void;
  onDoorToggle?: (enabled: boolean) => void;
  onDoorMaterialChange?: (material: Partial<DoorMaterialData>) => void;
  onDoorCountChange?: (count: number) => void;
  onOverhangDoorToggle?: (overhang: boolean) => void;
  onDrawerToggle?: (enabled: boolean) => void;
  onDrawerQuantityChange?: (quantity: number) => void;
  onDrawerHeightChange?: (index: number, height: number) => void;
  onDrawerHeightsBalance?: () => void;
  onDrawerHeightsReset?: () => void;
}

const ProductPanel: React.FC<ProductPanelProps> = ({
  isVisible,
  onClose,
  selectedCabinet,
  onDimensionsChange,
  onMaterialChange,
  onKickerHeightChange,
  onDoorToggle,
  onDoorMaterialChange,
  onDoorCountChange,
  onOverhangDoorToggle,
  onDrawerToggle,
  onDrawerQuantityChange,
  onDrawerHeightChange,
  onDrawerHeightsBalance,
  onDrawerHeightsReset
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dimensions, setDimensions] = useState<CarcassDimensions>({
    width: 600,
    height: 600,
    depth: 300
  });
  const [materialColor, setMaterialColor] = useState('#ffffff');
  const [materialThickness, setMaterialThickness] = useState(16);
  const [kickerHeight, setKickerHeight] = useState(100);
  const [doorEnabled, setDoorEnabled] = useState(true);
  const [doorColor, setDoorColor] = useState('#ffffff');
  const [doorThickness, setDoorThickness] = useState(18);
  const [doorCount, setDoorCount] = useState(2);
  const [doorCountAutoAdjusted, setDoorCountAutoAdjusted] = useState(false);
  const [overhangDoor, setOverhangDoor] = useState(true);
  const [drawerEnabled, setDrawerEnabled] = useState(false);
  const [drawerQuantity, setDrawerQuantity] = useState(3);
  const [drawerHeights, setDrawerHeights] = useState<number[]>([]);
  const [isEditingDrawerHeights, setIsEditingDrawerHeights] = useState(false);
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);

  // Ref to track the last cabinet that was synced to prevent unnecessary re-syncing
  const lastSyncedCabinetRef = useRef<THREE.Group | null>(null);

  // Ref to track the previous cabinet height for proportional scaling
  const previousCabinetHeightRef = useRef<number>(600);

  // Function to check if 1 door is allowed for current width
  const isOneDoorAllowed = () => dimensions.width <= 600;

  // Function to check if this is a drawer cabinet
  const isDrawerCabinet = () => selectedCabinet?.subcategoryId === 'drawer';

  // Drawer callback handlers
  const handleDrawerToggle = (enabled: boolean) => {
    setDrawerEnabled(enabled);
    onDrawerToggle?.(enabled);
  };

  // Function to recalculate drawer heights proportionally based on cabinet height and quantity
  const recalculateDrawerHeights = () => {
    if (drawerEnabled && drawerQuantity > 0) {
      const proportionalHeight = Math.round((dimensions.height / drawerQuantity) * 10) / 10;
      const newDrawerHeights = Array(drawerQuantity).fill(proportionalHeight);
      setDrawerHeights(newDrawerHeights);

      // Update each drawer height in the carcass
      newDrawerHeights.forEach((height, index) => {
        onDrawerHeightChange?.(index, height);
      });
    }
  };

  // Function to balance remaining drawer heights when one drawer height is changed
  const balanceRemainingDrawerHeights = (changedIndex: number, newHeight: number) => {
    console.log('balanceRemainingDrawerHeights called with:', { changedIndex, newHeight, drawerEnabled, drawerQuantity });

    if (!drawerEnabled || drawerQuantity <= 1) {
      console.log('Balance function early return - not enabled or quantity <= 1');
      return;
    }

    const newDrawerHeights = [...drawerHeights];
    newDrawerHeights[changedIndex] = newHeight;

    console.log('Initial newDrawerHeights:', newDrawerHeights);

    // Calculate remaining height to distribute
    const usedHeight = newDrawerHeights.reduce((sum, height) => sum + (height || 0), 0);
    const remainingHeight = dimensions.height - usedHeight;

    console.log('Height calculation:', { usedHeight, remainingHeight, dimensionsHeight: dimensions.height });

    if (remainingHeight > 0) {
      // Count how many drawers need height reassignment (all except the changed one)
      const remainingDrawers = drawerQuantity - 1;

      console.log('Remaining drawers to balance:', remainingDrawers);

      if (remainingDrawers > 0) {
        // Distribute remaining height equally among remaining drawers
        const heightPerRemainingDrawer = Math.round((remainingHeight / remainingDrawers) * 10) / 10;

        console.log('Height per remaining drawer:', heightPerRemainingDrawer);

        for (let i = 0; i < drawerQuantity; i++) {
          if (i !== changedIndex) {
            newDrawerHeights[i] = Math.max(50, heightPerRemainingDrawer); // Ensure minimum 50mm
            console.log(`Setting drawer ${i} to ${newDrawerHeights[i]}mm`);
          }
        }
      }
    }

    console.log('Final balanced drawer heights:', newDrawerHeights);
    setDrawerHeights(newDrawerHeights);
    return newDrawerHeights;
  };

  // Function to scale all drawer heights proportionally when cabinet height changes
  const scaleDrawerHeightsProportionally = (oldHeight: number, newHeight: number) => {
    if (!drawerEnabled || drawerQuantity <= 0 || drawerHeights.length === 0) return;

    const scaleRatio = newHeight / oldHeight;
    const newDrawerHeights = drawerHeights.map(height =>
      Math.round((height * scaleRatio) * 10) / 10
    );

    // Ensure total doesn't exceed new cabinet height
    const totalNewHeight = newDrawerHeights.reduce((sum, height) => sum + height, 0);
    if (totalNewHeight > newHeight) {
      // If still too tall, recalculate proportionally
      recalculateDrawerHeights();
    } else {
      setDrawerHeights(newDrawerHeights);

      // Update each drawer height in the carcass
      newDrawerHeights.forEach((height, index) => {
        onDrawerHeightChange?.(index, height);
      });
    }
  };

  const handleDrawerQuantityChange = (quantity: number) => {
    console.log(`ProductPanel: Changing drawer quantity from ${drawerQuantity} to ${quantity}`);
    setDrawerQuantity(quantity);

    // Always calculate proportional drawer heights: Cabinet Height / Drawer Quantity
    const proportionalHeight = Math.round((dimensions.height / quantity) * 10) / 10;
    const newDrawerHeights = Array(quantity).fill(proportionalHeight);
    console.log('ProductPanel: New proportional drawer heights for quantity change:', newDrawerHeights);
    setDrawerHeights(newDrawerHeights);

    // Call the callback to update the carcass
    onDrawerQuantityChange?.(quantity);
  };

  // Initialize drawer heights when component first loads or when drawer is enabled
  useEffect(() => {
    if (drawerEnabled && drawerQuantity > 0 && drawerHeights.length === 0) {
      console.log('ProductPanel: Initializing drawer heights...');
      const proportionalHeight = Math.round((dimensions.height / drawerQuantity) * 10) / 10;
      const initialDrawerHeights = Array(drawerQuantity).fill(proportionalHeight);
      console.log('ProductPanel: Initial drawer heights:', initialDrawerHeights);
      setDrawerHeights(initialDrawerHeights);
    }
  }, [drawerEnabled, drawerQuantity, dimensions.height, drawerHeights.length]);

  const handleDrawerHeightChange = (index: number, height: number) => {
    // Ensure proper decimal handling - max one digit after decimal point
    const roundedHeight = Math.round(height * 10) / 10;

    console.log(`ProductPanel: handleDrawerHeightChange called with:`, { index, height, roundedHeight });
    console.log(`ProductPanel: Current drawer heights:`, drawerHeights);
    console.log(`ProductPanel: Updating drawer ${index} height from ${drawerHeights[index]} to ${roundedHeight}`);

    // Set editing flag to prevent circular updates
    setIsEditingDrawerHeights(true);
    console.log('ProductPanel: Set editing flag to true');

    // Balance remaining drawer heights based on the new height
    console.log('ProductPanel: Calling balanceRemainingDrawerHeights...');
    const balancedHeights = balanceRemainingDrawerHeights(index, roundedHeight);
    console.log('ProductPanel: balanceRemainingDrawerHeights returned:', balancedHeights);

    // Call the callback to update the carcass for all drawers
    if (balancedHeights) {
      console.log('ProductPanel: Updating carcass with balanced heights...');
      // Update the changed drawer first
      onDrawerHeightChange?.(index, roundedHeight);

      // Then update the remaining balanced drawers
      balancedHeights.forEach((height, i) => {
        if (i !== index) { // Don't call the callback twice for the changed drawer
          console.log(`ProductPanel: Updating carcass drawer ${i} to ${height}mm`);
          onDrawerHeightChange?.(i, height);
        }
      });
    }

    // Clear editing flag after a short delay to allow carcass update to complete
    setTimeout(() => {
      setIsEditingDrawerHeights(false);
      console.log('ProductPanel: Cleared editing flag');
    }, 500); // Increased delay to ensure carcass update completes
  };

  // Function to get dimension constraints based on subcategory
  const getDimensionConstraints = (subcategoryId?: string) => {
    if (!subcategoryId) {
      return {
        height: { min: 300, max: 3000, default: 720 },
        width: { min: 200, max: 1200, default: 600 },
        depth: { min: 200, max: 800, default: 600 }
      };
    }

    for (const category of categoriesData.categories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      if (subcategory) {
        return subcategory.dimensions;
      }
    }

    return {
      height: { min: 300, max: 3000, default: 720 },
      width: { min: 200, max: 1200, default: 600 },
      depth: { min: 200, max: 800, default: 600 }
    };
  };

  const dimensionConstraints = getDimensionConstraints(selectedCabinet?.subcategoryId);

  // Door material options from data.js
  const doorMaterials = [
    { id: 'standard-door', name: 'Standard Door', colour: '#ffffff', thickness: 18 },
    { id: 'premium-door', name: 'Premium Door', colour: '#654321', thickness: 18 },
    { id: 'light-door', name: 'Light Door', colour: '#DEB887', thickness: 18 },
    { id: 'thick-door', name: 'Thick Door', colour: '#ffffff', thickness: 25 },
    { id: 'glass-door', name: 'Glass Door', colour: '#87CEEB', thickness: 6 }
  ];

  // Effect to sync drawer heights with carcass when they change externally
  useEffect(() => {
    // Don't sync if user is actively editing drawer heights
    if (isEditingDrawerHeights) {
      console.log('ProductPanel: Skipping drawer height sync - user is editing');
      return;
    }

    if (selectedCabinet && selectedCabinet.drawerHeights && selectedCabinet.drawerHeights.length > 0) {
      // Only update if the lengths match and the values are actually different
      if (drawerHeights.length === selectedCabinet.drawerHeights.length) {
        const hasChanges = selectedCabinet.drawerHeights.some((height, index) =>
          Math.abs((drawerHeights[index] || 0) - height) > 0.1
        );
        if (hasChanges) {
          console.log('ProductPanel: Syncing drawer heights from carcass:', selectedCabinet.drawerHeights);
          console.log('ProductPanel: Current local drawer heights:', drawerHeights);
          setDrawerHeights([...selectedCabinet.drawerHeights]);
        }
      } else if (drawerHeights.length === 0) {
        // Only sync if we don't have any local drawer heights yet
        console.log('ProductPanel: Initial sync of drawer heights from carcass:', selectedCabinet.drawerHeights);
        setDrawerHeights([...selectedCabinet.drawerHeights]);
      }
    }
  }, [selectedCabinet?.drawerHeights, isEditingDrawerHeights]);

  // Effect to sync with selected cabinet changes
  useEffect(() => {
    // Don't sync if user is actively editing dimensions
    if (isEditingDimensions) {
      console.log('ProductPanel: Skipping cabinet sync - user is editing dimensions');
      return;
    }

    if (selectedCabinet) {
      // Check if this is a completely new cabinet selection by comparing the group reference
      const isNewCabinet = lastSyncedCabinetRef.current !== selectedCabinet.group;

      // Only sync if this is a new cabinet selection
      if (isNewCabinet) {
        console.log('ProductPanel: New cabinet selected, syncing all properties');

        // Get dimension constraints for the subcategory
        const constraints = getDimensionConstraints(selectedCabinet.subcategoryId);

        // Sync dimensions with the actual cabinet dimensions
        const initialDimensions = {
          height: selectedCabinet.dimensions.height || constraints.height.default,
          width: selectedCabinet.dimensions.width || constraints.width.default,
          depth: selectedCabinet.dimensions.depth || constraints.depth.default
        };

        setDimensions(initialDimensions);

        // Update the previous height ref for proportional scaling
        previousCabinetHeightRef.current = initialDimensions.height;

        // Sync material properties
        setMaterialColor(selectedCabinet.material.getColour());
        setMaterialThickness(selectedCabinet.material.getPanelThickness());

        // Initialize kicker height from data for Base and Tall cabinets
        if (selectedCabinet.cabinetType === 'base' || selectedCabinet.cabinetType === 'tall') {
          const currentKickerHeight = categoriesData.legSettings?.default || 100;
          setKickerHeight(currentKickerHeight);
        }

        // Sync door properties
        setDoorEnabled(selectedCabinet.doorEnabled || false);
        setDoorColor(selectedCabinet.doorMaterial?.getColour() || '#ffffff');
        setDoorThickness(selectedCabinet.doorMaterial?.getThickness() || 18);
        setDoorCount(selectedCabinet.doorCount || 2);
        setOverhangDoor(selectedCabinet.overhangDoor || false);

        // Sync drawer properties - only sync if this is a new cabinet selection
        setDrawerEnabled(selectedCabinet.drawerEnabled || false);
        setDrawerQuantity(selectedCabinet.drawerQuantity || 3);

        // Don't override user input by checking if we already have drawer heights set
        if (drawerHeights.length === 0) {
          if (selectedCabinet.drawerHeights && selectedCabinet.drawerHeights.length > 0) {
            setDrawerHeights([...selectedCabinet.drawerHeights]);
          } else {
            // Calculate default drawer heights for new cabinet
            const defaultHeight = Math.round((initialDimensions.height / (selectedCabinet.drawerQuantity || 3)) * 10) / 10;
            const newDrawerHeights = Array(selectedCabinet.drawerQuantity || 3).fill(defaultHeight);
            setDrawerHeights(newDrawerHeights);
          }
        }

        // Update the ref to track this cabinet as synced
        lastSyncedCabinetRef.current = selectedCabinet.group;
      }
    }
  }, [selectedCabinet, isEditingDimensions]);

  // Effect to automatically recalculate drawer heights when cabinet height changes
  useEffect(() => {
    if (drawerEnabled && drawerQuantity > 0 && !isEditingDrawerHeights) {
      // If we have custom drawer heights, scale them proportionally
      // Otherwise, recalculate from scratch
      if (drawerHeights.length > 0 && drawerHeights.some(h => h > 0)) {
        // Scale existing drawer heights proportionally
        scaleDrawerHeightsProportionally(previousCabinetHeightRef.current, dimensions.height);
      } else {
        recalculateDrawerHeights();
      }
      // Update the previous height ref
      previousCabinetHeightRef.current = dimensions.height;
    }
  }, [dimensions.height, drawerEnabled, drawerQuantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDimensionChange = (field: keyof CarcassDimensions, value: number) => {
    console.log(`ProductPanel: handleDimensionChange called for ${field} with value ${value}`);
    console.log(`ProductPanel: Current editing state - isEditingDimensions: ${isEditingDimensions}`);

    // Set editing flag to prevent synchronization conflicts
    setIsEditingDimensions(true);

    // Validate the value is within the allowed range
    const constraints = getDimensionConstraints(selectedCabinet?.subcategoryId);

    if (value < constraints[field].min || value > constraints[field].max) {
      // Value is out of range - show alert and don't change
      alert(`${field.charAt(0).toUpperCase() + field.slice(1)} must be between ${constraints[field].min}mm and ${constraints[field].max}mm`);
      setIsEditingDimensions(false);
      return;
    }

    const newDimensions = { ...dimensions, [field]: value };
    console.log(`ProductPanel: Setting new dimensions:`, newDimensions);
    setDimensions(newDimensions);



    // Auto-adjust door count based on width
    if (field === 'width' && doorEnabled) {
      if (value > 600 && doorCount === 1) {
        // Auto-switch to 2 doors for wide cabinets
        setDoorCount(2);
        setDoorCountAutoAdjusted(true);
        if (onDoorCountChange && selectedCabinet) {
          onDoorCountChange(2);
        }
      } else if (value <= 600 && doorCount === 2) {
        // Allow switching back to 1 door for narrow cabinets
        // Note: We don't auto-switch back to avoid disrupting user choice
        setDoorCountAutoAdjusted(false);
      }
    }

    // Only call the callback if we're not currently editing to prevent circular updates
    if (onDimensionsChange && selectedCabinet) {
      console.log(`ProductPanel: Calling onDimensionsChange with:`, newDimensions);
      onDimensionsChange(newDimensions);
    }

    // Clear editing flag after a short delay to allow carcass update to complete
    // Increased delay to ensure carcass update completes and prevents race conditions
    setTimeout(() => {
      console.log(`ProductPanel: Clearing editing flag for ${field}`);
      setIsEditingDimensions(false);
    }, 500);
  };

  const handleMaterialChange = (field: 'colour' | 'panelThickness', value: string | number) => {
    if (field === 'colour') {
      setMaterialColor(value as string);
      if (onMaterialChange && selectedCabinet) {
        onMaterialChange({ colour: value as string });
      }
    } else if (field === 'panelThickness') {
      // Validate the thickness value is within the allowed range (6-50mm)
      const thickness = value as number;
      if (thickness < 6 || thickness > 50) {
        // Value is out of range - show alert and don't change
        alert(`Material thickness must be between 6mm and 50mm`);
        return;
      }

      setMaterialThickness(thickness);
      if (onMaterialChange && selectedCabinet) {
        // Update both panelThickness and backThickness to be the same
        onMaterialChange({
          panelThickness: thickness,
          backThickness: thickness
        });
      }
    }
  };

  const handleKickerHeightChange = (value: number) => {
    // Validate the kicker height value is within reasonable range (50-200mm)
    if (value < 50 || value > 200) {
      alert(`Kicker height must be between 50mm and 200mm`);
      return;
    }

    setKickerHeight(value);

    if (onKickerHeightChange && selectedCabinet) {
      onKickerHeightChange(value);
    }
  };

  const handleDoorToggle = (enabled: boolean) => {
    setDoorEnabled(enabled);

    if (onDoorToggle && selectedCabinet) {
      onDoorToggle(enabled);
    }
  };

  const handleOverhangDoorToggle = (enabled: boolean) => {
    console.log('Overhang door toggle:', enabled);
    setOverhangDoor(enabled);

    // Update overhang door setting
    if (onOverhangDoorToggle && selectedCabinet) {
      console.log('Calling onOverhangDoorToggle with:', enabled);
      onOverhangDoorToggle(enabled);
    }
  };

  const handleDoorMaterialChange = (field: 'colour' | 'thickness', value: string | number) => {
    if (field === 'colour') {
      setDoorColor(value as string);
    } else if (field === 'thickness') {
      setDoorThickness(value as number);
    }

    if (onDoorMaterialChange && selectedCabinet) {
      onDoorMaterialChange({ [field]: value });
    }
  };

  const handleDoorCountChange = (count: number) => {
    setDoorCount(count);

    if (onDoorCountChange && selectedCabinet) {
      onDoorCountChange(count);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 product-panel"
      data-product-panel="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div
        className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-80 max-w-[90vw]' : 'w-0'
          } overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >

        <div
          className="bg-gray-50 px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-lg font-semibold text-gray-800"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >Product Panel</h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >×</button>
          </div>
          {selectedCabinet && (
            <p
              className="text-sm text-gray-600 mt-1"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              {selectedCabinet.cabinetType.charAt(0).toUpperCase() + selectedCabinet.cabinetType.slice(1)} Cabinet
            </p>
          )}
        </div>

        <div
          className="p-2 sm:p-4 space-y-1 min-h-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {selectedCabinet ? (
            <>
              <div
                className="space-y-4"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center space-x-2 text-gray-700 font-medium"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <Ruler size={20} />
                  <h3>Dimensions</h3>
                </div>

                <div className="space-y-4">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Height (mm)</label>
                    <div
                      className="text-center mb-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        value={dimensions.height}
                        onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions(true)}
                        onBlur={() => {
                          // Clear editing flag when user finishes editing
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.height.min}
                        max={dimensionConstraints.height.max}
                        step="10"
                      />
                      <span
                        className="text-lg font-semibold text-blue-600 ml-1"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >mm</span>
                    </div>
                    <div
                      className="flex items-center space-x-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.height.min}</span>
                      <input
                        type="range"
                        value={dimensions.height}
                        onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsEditingDimensions(true);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          // Clear editing flag when user finishes dragging
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.height.min}
                        max={dimensionConstraints.height.max}
                        step="10"
                      />
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.height.max}</span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Width (mm)</label>
                    <div
                      className="text-center mb-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        value={dimensions.width}
                        onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions(true)}
                        onBlur={() => {
                          // Clear editing flag when user finishes editing
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.width.min}
                        max={dimensionConstraints.width.max}
                        step="10"
                      />
                      <span
                        className="text-lg font-semibold text-blue-600 ml-1"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >mm</span>
                    </div>
                    <div
                      className="flex items-center space-x-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.width.min}</span>
                      <input
                        type="range"
                        value={dimensions.width}
                        onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsEditingDimensions(true);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          // Clear editing flag when user finishes dragging
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.width.min}
                        max={dimensionConstraints.width.max}
                        step="10"
                      />
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.width.max}</span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Depth (mm)</label>
                    <div
                      className="text-center mb-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        value={dimensions.depth}
                        onChange={(e) => handleDimensionChange('depth', Number(e.target.value))}
                        onFocus={() => setIsEditingDimensions(true)}
                        onBlur={() => {
                          // Clear editing flag when user finishes editing
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min={dimensionConstraints.depth.min}
                        max={dimensionConstraints.depth.max}
                        step="10"
                      />
                      <span
                        className="text-lg font-semibold text-blue-600 ml-1"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >mm</span>
                    </div>
                    <div
                      className="flex items-center space-x-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.depth.min}</span>
                      <input
                        type="range"
                        value={dimensions.depth}
                        onChange={(e) => handleDimensionChange('depth', Number(e.target.value))}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setIsEditingDimensions(true);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          // Clear editing flag when user finishes dragging
                          setTimeout(() => setIsEditingDimensions(false), 100);
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min={dimensionConstraints.depth.min}
                        max={dimensionConstraints.depth.max}
                        step="10"
                      />
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >{dimensionConstraints.depth.max}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kicker Height Section - Only show for Base and Tall cabinets */}
              {(selectedCabinet?.cabinetType === 'base' || selectedCabinet?.cabinetType === 'tall') && (
                <div
                  className="space-y-4"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >

                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Kicker Height (mm)</label>
                    <div
                      className="text-center mb-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        value={kickerHeight}
                        onChange={(e) => handleKickerHeightChange(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="text-center text-lg font-semibold text-blue-600 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none px-2 py-1 w-24"
                        min="50"
                        max="200"
                        step="5"
                      />
                      <span
                        className="text-lg font-semibold text-blue-600 ml-1"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >mm</span>
                    </div>
                    <div
                      className="flex items-center space-x-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >50</span>
                      <input
                        type="range"
                        value={kickerHeight}
                        onChange={(e) => handleKickerHeightChange(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        min="50"
                        max="200"
                        step="5"
                      />
                      <span
                        className="text-xs text-gray-500 w-12"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >200</span>
                    </div>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      Controls the height of cabinet legs (Base and Tall cabinets only)
                    </p>
                  </div>
                </div>
              )}

              <div
                className="space-y-1"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center space-x-2 text-gray-700 font-medium"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <Palette size={20} />
                  <h3>Material Properties</h3>
                </div>

                <div
                  className="space-y-3"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Carcass Colour</label>
                    <div
                      className="flex items-center space-x-2"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <input
                        type="color"
                        value={materialColor}
                        onChange={(e) => handleMaterialChange('colour', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={materialColor}
                        onChange={(e) => handleMaterialChange('colour', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >Carcass Thickness</label>
                    <input
                      type="number"
                      value={materialThickness}
                      onChange={(e) => handleMaterialChange('panelThickness', Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="6"
                      max="50"
                      step="1"
                    />
                    <p
                      className="text-xs text-gray-500 mt-1"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      This will update both panel and back panel thickness
                    </p>
                  </div>
                </div>
              </div>

              {/* Door Controls - Disabled for Drawer cabinets */}
              {!isDrawerCabinet() && (
                <div
                  className="space-y-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <div
                    className="flex items-center space-x-2 mb-4"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <DoorOpen size={20} />
                    <h3>Door Settings</h3>
                  </div>

                  <div
                    className="space-y-3"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {/* Door Toggle */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <label
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={doorEnabled}
                          onChange={(e) => handleDoorToggle(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Doors</span>
                      </label>
                    </div>

                    {/* Overhang Door Toggle - Only show for Top/Wall cabinets */}
                    {doorEnabled && (selectedCabinet?.cabinetType === 'top') && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="flex items-center space-x-2 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={overhangDoor}
                            onChange={(e) => handleOverhangDoorToggle(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Overhang Door</span>
                        </label>
                        <p
                          className="text-xs text-gray-500 mt-1 ml-6"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          Makes door 20mm longer and positions it 20mm lower (Top/Wall cabinets only)
                        </p>
                      </div>
                    )}

                    {/* Door Count */}
                    {doorEnabled && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Number of Doors</label>
                        <select
                          value={doorCount}
                          onChange={(e) => handleDoorCountChange(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={!isOneDoorAllowed()}
                        >
                          <option value={1} disabled={!isOneDoorAllowed()}>1 Door</option>
                          <option value={2}>2 Doors</option>
                        </select>
                        {!isOneDoorAllowed() && (
                          <p
                            className="text-xs text-blue-600 mt-1"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                          >
                            ⓘ {doorCountAutoAdjusted ? 'Auto-switched to 2 doors' : '2 doors required'} for cabinets wider than 600mm
                          </p>
                        )}
                      </div>
                    )}

                    {/* Door Gap */}
                    {doorEnabled && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Door Gap (mm)</label>
                        <div
                          className="text-center mb-3"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            value={2}
                            disabled
                            className="text-center text-lg font-semibold text-gray-400 bg-gray-100 border-b-2 border-gray-300 px-2 py-1 w-24 cursor-not-allowed"
                            min="1"
                            max="5"
                            step="0.5"
                          />
                          <span
                            className="text-lg font-semibold text-gray-400 ml-1"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                          >mm</span>
                        </div>
                        <p
                          className="text-xs text-gray-500 mt-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          Gap between doors and carcass edges (read-only)
                        </p>
                      </div>
                    )}

                    {/* Door Material Colour */}
                    {doorEnabled && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Door Colour</label>
                        <div
                          className="flex items-center space-x-2"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <input
                            type="color"
                            value={doorColor}
                            onChange={(e) => handleDoorMaterialChange('colour', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            className="w-16 h-12 border border-gray-300 rounded-md cursor-pointer"
                          />
                          <input
                            type="text"
                            value={doorColor}
                            onChange={(e) => handleDoorMaterialChange('colour', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                    )}

                    {/* Door Thickness */}
                    {doorEnabled && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Door Thickness (mm)</label>
                        <select
                          value={doorThickness}
                          onChange={(e) => handleDoorMaterialChange('thickness', Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {doorMaterials.map(material => (
                            <option key={material.id} value={material.thickness}>
                              {material.name} ({material.thickness}mm)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Drawer Settings - Only show for Base > Drawer cabinets */}
              {isDrawerCabinet() && (
                <div
                  className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <div
                    className="flex items-center space-x-2 mb-4"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <Ruler size={20} />
                    <h3>Drawer Settings</h3>
                  </div>

                  <div
                    className="space-y-3"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {/* Drawer Toggle */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <label
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={drawerEnabled}
                          onChange={(e) => handleDrawerToggle(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Drawers</span>
                      </label>
                    </div>

                    {/* Drawer Quantity */}
                    {drawerEnabled && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Number of Drawers</label>
                        <select
                          value={drawerQuantity}
                          onChange={(e) => handleDrawerQuantityChange(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {Array.from({ length: 6 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} Drawer{num > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Individual Drawer Heights */}
                    {drawerEnabled && drawerQuantity > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-sm font-medium text-gray-700 mb-2"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >Drawer Heights (mm)</label>
                        {/* Proportional height calculation display */}
                        <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Proportional Height:</span> {Math.round((dimensions.height / drawerQuantity) * 10) / 10}mm per drawer</span>
                            <span className="text-blue-600">(Cabinet Height ÷ Drawer Quantity)</span>
                          </div>
                          <div className="mt-1 text-blue-600">
                            <span className="font-medium">Smart Balancing:</span> When you change one drawer height, others automatically adjust to fill remaining space
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: drawerQuantity }, (_, i) => (
                            <div key={`drawer-${i}-${drawerQuantity}`} className="flex items-center space-x-2">
                              <label className="text-xs text-gray-600 w-16">Drawer {i + 1}:</label>
                              <input
                                type="number"
                                value={drawerHeights[i] !== undefined ? drawerHeights[i] : Math.round((dimensions.height / drawerQuantity) * 10) / 10}
                                onChange={(e) => {
                                  // Don't trigger changes on every keystroke - just update local state for display
                                  const newDrawerHeights = [...drawerHeights];
                                  newDrawerHeights[i] = Number(e.target.value);
                                  setDrawerHeights(newDrawerHeights);
                                }}
                                onFocus={() => {
                                  console.log(`Drawer ${i} input onFocus`);
                                  setIsEditingDrawerHeights(true);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="50"
                                max={dimensions.height}
                                step="0.1"
                                title={`Drawer ${i + 1} height. Min: 50mm, Max: ${dimensions.height}mm. Proportional height: ${Math.round((dimensions.height / drawerQuantity) * 10) / 10}mm. Other drawer heights will adjust automatically.`}
                                onBlur={(e) => {
                                  console.log(`Drawer ${i} input onBlur: ${e.target.value}`);
                                  // Ensure proper decimal handling on blur
                                  const value = Number(e.target.value);
                                  if (!isNaN(value)) {
                                    const roundedValue = Math.round(value * 10) / 10;
                                    // Only trigger change if the value is actually different
                                    if (Math.abs(roundedValue - (drawerHeights[i] || 0)) > 0.1) {
                                      handleDrawerHeightChange(i, roundedValue);
                                    }
                                  }
                                  // Clear editing flag when user finishes editing
                                  setIsEditingDrawerHeights(false);
                                }}
                              />
                              <span className="text-xs text-gray-500">mm</span>
                            </div>
                          ))}
                        </div>

                        {/* Real-time height balance display */}
                        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700 border border-green-200">
                          <div className="flex justify-between items-center">
                            <span><span className="font-medium">Height Balance:</span> {Math.round((dimensions.height - drawerHeights.reduce((sum, height) => sum + (height || 0), 0)) * 10) / 10}mm remaining</span>
                            <span className="text-green-600">
                              {drawerHeights.filter(h => h === undefined || h === 0).length} drawer(s) to balance
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex-1">
                            <p className={`text-xs ${Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 > dimensions.height
                                ? 'text-red-500 font-medium'
                                : Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 === dimensions.height
                                  ? 'text-green-600 font-medium'
                                  : 'text-gray-500'
                              }`}>
                              Total: {Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10}mm / {dimensions.height}mm
                              {Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 > dimensions.height && (
                                <span className="block">⚠️ Total exceeds carcass height</span>
                              )}
                              {Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 === dimensions.height && (
                                <span className="block">✅ Heights are optimal</span>
                              )}
                            </p>
                            {/* Progress bar showing height usage */}
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 > dimensions.height
                                    ? 'bg-red-500'
                                    : Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 === dimensions.height
                                      ? 'bg-green-500'
                                      : 'bg-blue-500'
                                  }`}
                                style={{
                                  width: `${Math.min(100, (drawerHeights.reduce((sum, height) => sum + (height || 0), 0) / dimensions.height) * 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10 > dimensions.height && (
                              <button
                                onClick={() => {
                                  onDrawerHeightsBalance?.();
                                  // Immediately recalculate proportional heights
                                  recalculateDrawerHeights();
                                }}
                                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                              >
                                Balance Heights
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onDrawerHeightsReset?.();
                                // Immediately recalculate proportional heights
                                recalculateDrawerHeights();
                              }}
                              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                              Reset to Optimal
                            </button>
                            {/* Debug button - remove after testing */}
                            <button
                              onClick={() => {
                                console.log('Debug: Current drawer heights:', drawerHeights);
                                console.log('Debug: Testing balance function...');
                                const testResult = balanceRemainingDrawerHeights(0, 300);
                                console.log('Debug: Balance result:', testResult);
                              }}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >
                              Debug Balance
                            </button>
                          </div>
                        </div>

                        {/* Height distribution summary */}
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-700 mb-1">Height Distribution:</p>
                          <div className="grid grid-cols-2 gap-1">
                            {drawerHeights.map((height, index) => (
                              <div key={index} className="flex justify-between">
                                <span className="text-gray-600">Drawer {index + 1}:</span>
                                <span className="font-mono">{height || 0}mm</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Used:</span>
                              <span className="font-mono">{Math.round(drawerHeights.reduce((sum, height) => sum + (height || 0), 0) * 10) / 10}mm</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Available:</span>
                              <span className="font-mono">{Math.round((dimensions.height - drawerHeights.reduce((sum, height) => sum + (height || 0), 0)) * 10) / 10}mm</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="text-center text-gray-500 py-8"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <Settings size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Right-click on a cabinet to edit its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPanel;
