# Cabinet Carcass System

This directory contains a complete 3D cabinet carcass system built with Three.js and TypeScript. The system allows you to create different types of cabinets with dynamic dimensions and configurations.

## Structure

```
components/Carcass/
├── parts/                    # Individual carcass components
│   ├── CarcassEnd.ts        # Left/Right end panels
│   ├── CarcassBack.ts       # Back panel
│   ├── CarcassBottom.ts     # Bottom shelf/base
│   ├── CarcassShelf.ts      # Adjustable shelves
│   ├── CarcassTop.ts        # Top panel (with Base Rail support)
├── Material.ts               # Centralized material management
├── MaterialLoader.ts         # Material loading from data files
├── CarcassAssembly.ts       # Main assembly class
└── index.ts                 # Export file
```

## Features

- **Modular Design**: Each cabinet part is a separate class for easy maintenance
- **Dynamic Dimensions**: All parts automatically adjust when cabinet dimensions change
- **Multiple Cabinet Types**: Support for Top, Base, and Tall cabinets
- **Base Rail Support**: Base cabinets automatically use 60mm deep top rails instead of full depth
- **Configurable**: Panel thickness, back thickness, shelf count, and spacing
- **3D Visualization**: Full Three.js integration with wireframe outlines
- **Memory Management**: Proper disposal of geometries and materials

## Usage

### Basic Cabinet Creation

```typescript
import { CarcassAssembly, CarcassDimensions } from './components/Carcass';

// Define cabinet dimensions
const dimensions: CarcassDimensions = {
  width: 600,    // 600mm width
  height: 600,   // 600mm height
  depth: 300     // 300mm depth
};

// Create a top cabinet
const topCabinet = CarcassAssembly.createTopCabinet(dimensions);

// Add to your Three.js scene
scene.add(topCabinet.group);
```

### Custom Configuration

```typescript
// Create with custom configuration
const cabinet = CarcassAssembly.createBaseCabinet(dimensions, {
  material: customMaterial,  // Custom material with thickness and colour
  shelfCount: 3,            // 3 adjustable shelves
  shelfSpacing: 250         // 250mm between shelves
});
```

### Material Management

The system now uses a centralized material system that manages both colour and panel thickness:

```typescript
import { CarcassMaterial, MaterialLoader } from './components/Carcass';

// Load material from data file
const material = MaterialLoader.loadMaterialById('premium-wood');

// Create cabinet with specific material
const cabinet = CarcassAssembly.createBaseCabinet(dimensions, { material });

// Update material on existing cabinet
cabinet.updateMaterial(newMaterial);

// List all available materials
const materials = MaterialLoader.getAllMaterials();
```

### Updating Dimensions

```typescript
// Update cabinet dimensions
cabinet.updateDimensions({
  width: 800,
  height: 720,
  depth: 400
});
```

### Updating Configuration

```typescript
// Update cabinet configuration
cabinet.updateConfig({
  shelfCount: 4,
  shelfSpacing: 200
});

// Update material specifically
cabinet.updateMaterial(newMaterial);
```

## Cabinet Types

### Top Cabinet
- **Position**: Mounted at wall height (2400mm from floor)
- **Typical Use**: Upper storage, above base cabinets
- **Default Dimensions**: 600×600×300mm (W×H×D)
- **Top Panel**: Full depth (follows carcass depth)

### Base Cabinet
- **Position**: On the floor
- **Typical Use**: Lower storage, kitchen base units
- **Default Dimensions**: 600×720×600mm (W×H×D)
- **Top Panel**: Base Rail (60mm depth, configurable)

### Tall Cabinet
- **Position**: On the floor
- **Typical Use**: Full-height storage, pantries
- **Default Dimensions**: 600×2400×600mm (W×H×D)
- **Top Panel**: Full depth (follows carcass depth)

## Base Rail Setting

The Base Rail is a special feature for Base cabinets that provides a shallower top panel:

### What is Base Rail?
- **Purpose**: Creates a 60mm deep top rail instead of full carcass depth
- **Position**: Starts from the front edge and extends 60mm toward positive Z direction (toward the front)
- **Default Value**: 60mm (configurable in data.js)
- **Cabinet Types**: Only applies to Base cabinets

### Configuration
The Base Rail depth is configured in `data.js`:

```javascript
"baseRailSetting": {
  "default": 60,
  "description": "Base Rail depth for Base cabinet types (in mm)"
}
```

### Positioning Formula
For Base cabinets, the Base Rail Z position is calculated as:
```
Z = backThickness + (railDepth/2) + (carcassDepth - railDepth)/2
```

This ensures the front edge of the Base Rail aligns with the front edge of the end panels.

### Example Calculation

For a 600mm deep Base cabinet with 60mm Base Rail and 18mm back thickness:
- `depthDifference = 600 - 60 = 540mm`
- `zPosition = 18 + (60/2) + (540/2) = 18 + 30 + 270 = 318mm`
- Front edge of rail = `318 - 30 = 288mm` (which equals `backThickness`)

### Usage Examples

```typescript
import { CarcassAssembly } from './components/Carcass';

// Create a Base cabinet (automatically uses Base Rail)
const baseCabinet = CarcassAssembly.createBaseCabinet({
  width: 600,
  height: 720,
  depth: 600
});

// The top panel will automatically be 60mm deep instead of 600mm

// Create a Top cabinet (uses full depth)
const topCabinet = CarcassAssembly.createTopCabinet({
  width: 600,
  height: 600,
  depth: 300
});

// The top panel will be 300mm deep (full carcass depth)
```

### Dynamic Updates
You can update the Base Rail depth dynamically:

```typescript
// Update Base Rail depth for existing Base cabinet
if (baseCabinet.cabinetType === 'base') {
  const top = baseCabinet.top;
  top.updateBaseRailSettings('base', 80); // Change to 80mm
}
```

### Demo
**Note:** Demo files have been removed from the production codebase. 
The Base Rail functionality is now fully integrated into the main cabinet system.

You can test Base Rail functionality by:
- Creating Base cabinets (automatically use Base Rail)
- Modifying Base Rail depth in the ProductPanel
- Observing the reduced top panel depth on Base cabinets

## Integration with Menu System

The cabinet system integrates with the existing menu system:

1. **Select Category**: Choose from Top, Base, or Tall
2. **Select Subcategory**: Choose Standard, Corner, Blind, etc.
3. **Cabinet Creation**: Automatically creates and positions the cabinet in the 3D scene

### Menu Flow Example

```
Top > Standard → Creates a standard top cabinet
Base > Drawer → Creates a base cabinet with drawer configuration
Tall > Standard → Creates a full-height standard cabinet
```

## Technical Details

### Materials
The system now uses a centralized material system with the following properties:
- **Colour**: Hex color values (e.g., "#8B4513" for brown wood)
- **Panel Thickness**: Configurable thickness for all panels
- **Back Thickness**: Separate thickness for back panels
- **Opacity**: Material transparency (0-1)
- **Transparency**: Whether the material is transparent

### Available Materials (from data.js)
- **Standard Wood**: Brown (#8B4513), 18mm panels, 18mm back
- **Premium Wood**: Dark brown (#654321), 18mm panels, 18mm back
- **Light Wood**: Light brown (#DEB887), 18mm panels, 18mm back
- **Thick Panel**: Brown (#8B4513), 25mm panels, 18mm back

### Panel Thicknesses
- **Standard Panels**: 18mm (configurable via material)
- **Back Panel**: 18mm (configurable via material)
- **Shelves**: 18mm (configurable via material)

### Positioning
- **End Panels**: Left/right edges of cabinet
- **Back Panel**: Back center, accounting for end panel thickness
- **Bottom/Top**: Bottom/top center, accounting for all panel thicknesses
- **Shelves**: Evenly spaced between bottom and top panels

## Memory Management

The system includes proper cleanup methods:

```typescript
// Dispose of a single cabinet
cabinet.dispose();

// Clear all cabinets from scene
cabinets.forEach(cabinet => {
  scene.remove(cabinet);
  // Cabinet disposal is handled automatically
});
```

## Performance Considerations

- **Geometry Reuse**: Geometries are updated in-place when dimensions change
- **Material Sharing**: Materials can be shared between multiple parts
- **Efficient Updates**: Only necessary parts are updated when dimensions change
- **Proper Cleanup**: All resources are disposed when cabinets are removed

## Material System

The new centralized material system provides several benefits:

### Benefits
- **Centralized Management**: All material properties (colour, thickness, opacity) in one place
- **Data-Driven**: Materials can be loaded from external data files (data.js)
- **Easy Updates**: Change materials on existing cabinets without rebuilding
- **Consistent Properties**: All parts use the same material properties
- **Extensible**: Easy to add new materials and properties

### Usage Examples

```typescript
// Load and use specific materials
const standardWood = MaterialLoader.loadMaterialById('standard-wood');
const premiumWood = MaterialLoader.loadMaterialById('premium-wood');

// Create cabinets with different materials
const standardCabinet = CarcassAssembly.createBaseCabinet(dimensions, { material: standardWood });
const premiumCabinet = CarcassAssembly.createBaseCabinet(dimensions, { material: premiumWood });

// Update material on existing cabinet
standardCabinet.updateMaterial(premiumWood);
```

### Adding New Materials

To add new materials, update the `data.js` file:

```javascript
"carcassMaterials": [
  {
    "id": "new-material",
    "name": "New Material",
    "description": "Description of the new material",
    "colour": "#FF0000",
    "panelThickness": 20,
    "backThickness": 18,
    "opacity": 0.9,
    "transparent": true
  }
]
```

## Future Enhancements

- **Door Integration**: Add door systems to cabinets
- **Drawer Systems**: Implement drawer mechanisms
- **Hardware**: Add hinges, handles, and other hardware
- **Textures**: Support for different wood textures and materials
- **Animation**: Smooth transitions when updating dimensions
- **Export**: Export cabinet designs to common formats
- **Material Variants**: Support for different finishes and textures
- **Dynamic Loading**: Load materials from external APIs or databases
- **Advanced Base Rail**: Support for different Base Rail profiles and shapes
