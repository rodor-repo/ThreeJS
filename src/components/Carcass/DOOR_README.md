# Door System for Cabinet Carcasses

This document describes the door system implementation for the cabinet carcass project.

## Overview

The door system allows users to add doors to any type of cabinet (base, top, tall). Doors are positioned at the front edge of the carcass and dynamically resize with the cabinet dimensions.

## Features

- **Dynamic Sizing**: Door width and height automatically adjust with carcass dimensions
- **Material System**: Configurable door materials with color and thickness
- **Multiple Door Configurations**: Support for 1 or 2 doors
- **Toggle Control**: Enable/disable doors for each cabinet
- **Real-time Updates**: Doors update automatically when carcass dimensions change

## Architecture

### Core Classes

#### 1. DoorMaterial
- **Location**: `components/Carcass/DoorMaterial.ts`
- **Purpose**: Manages door material properties (color, thickness, opacity)
- **Interface**: `DoorMaterialData`

#### 2. CarcassDoor
- **Location**: `components/Carcass/parts/CarcassDoor.ts`
- **Purpose**: Creates and manages door geometry and positioning
- **Interface**: `CarcassDoorProps`

#### 3. CarcassAssembly Integration
- **Location**: `components/Carcass/CarcassAssembly.ts`
- **Purpose**: Integrates doors into the main carcass system

### Data Structure

Door materials are defined in `public/data/data.js`:

```javascript
const doorMaterials = [
  {
    "id": "standard-door",
    "name": "Standard Door",
    "description": "Standard door material for cabinet doors",
    "colour": "#8B4513",
    "thickness": 18,
    "opacity": 0.9,
    "transparent": true
  },
  // ... more materials
];
```

## Usage

### Basic Door Creation

```typescript
import { CarcassAssembly, DoorMaterial } from './Carcass';

// Create cabinet with doors enabled
const carcass = CarcassAssembly.createBaseCabinet(
  { width: 600, height: 720, depth: 600 },
  {
    doorEnabled: true,
    doorMaterial: DoorMaterial.getDefaultMaterial(),
    doorCount: 1
  }
);
```

### Door Management

```typescript
// Toggle doors on/off
carcass.toggleDoors(true);

// Change door count
carcass.updateDoorConfiguration(2);

// Update door material
const newMaterial = new DoorMaterial({
  colour: '#87CEEB',
  thickness: 6,
  opacity: 0.3,
  transparent: true
});
carcass.updateDoorMaterial(newMaterial);
```

### Dynamic Updates

Doors automatically update when carcass dimensions change:

```typescript
// Update carcass dimensions - doors will resize automatically
carcass.updateDimensions({
  width: 800,
  height: 800,
  depth: 600
});
```

## UI Integration

### ProductPanel Controls

The ProductPanel includes door controls:

- **Enable/Disable Toggle**: Checkbox to turn doors on/off
- **Door Count**: Dropdown to select 1 or 2 doors
- **Door Color**: Color picker and text input for hex values
- **Door Thickness**: Dropdown with predefined material options

### ThreeScene Integration

Doors are integrated into the main 3D scene with callbacks:

```typescript
<ProductPanel
  // ... other props
  onDoorToggle={(enabled) => {
    if (selectedCabinet) {
      selectedCabinet.carcass.toggleDoors(enabled);
    }
  }}
  onDoorMaterialChange={(materialChanges) => {
    // Handle material updates
  }}
  onDoorCountChange={(count) => {
    // Handle door count changes
  }}
/>
```

## Door Positioning

### Coordinate System
- **X-axis**: Width of the carcass
- **Y-axis**: Height of the carcass  
- **Z-axis**: Depth of the carcass

### Door Placement
- Doors are positioned at the front edge of the carcass (Z = depth)
- Single doors are centered on the carcass width
- Two doors are split evenly across the carcass width
- Doors have a 2mm clearance offset from the carcass front

### Sizing Logic
- **Door Width**: `carcassWidth - (endPanelThickness * 2)`
- **Door Height**: `carcassHeight`
- **Door Depth**: `doorMaterialThickness`

## Material System

### Default Materials
- **Standard Door**: 18mm thickness, brown color
- **Premium Door**: 18mm thickness, dark brown color
- **Light Door**: 18mm thickness, light brown color
- **Thick Door**: 25mm thickness, brown color
- **Glass Door**: 6mm thickness, blue color, high transparency

### Material Properties
- **Color**: Hex color string
- **Thickness**: Material thickness in millimeters
- **Opacity**: Transparency level (0-1)
- **Transparent**: Boolean flag for transparency

## Performance Considerations

- Doors are only created when `doorEnabled` is true
- Door geometry is disposed of when doors are disabled
- Materials are shared and reused when possible
- Wireframe outlines are included for visual clarity

## Future Enhancements

- **Hinge System**: Add realistic door hinges and swing animations
- **Door Styles**: Different door panel designs (flat, raised, shaker)
- **Hardware**: Door handles, knobs, and other accessories
- **Animation**: Smooth door opening/closing animations
- **Collision Detection**: Prevent doors from intersecting with other objects

## Testing

**Note:** Demo files have been removed from the production codebase. 
The door functionality is now fully integrated into the main cabinet system.

### Testing in Main Application
- Use the ProductPanel to toggle doors on/off
- Change door count between 1 and 2 doors
- Modify door materials and colors
- Test door positioning and sizing

## Troubleshooting

### Common Issues

1. **Doors not appearing**: Check if `doorEnabled` is true
2. **Wrong door size**: Verify carcass dimensions are correct
3. **Material not updating**: Ensure DoorMaterial instance is properly created
4. **Performance issues**: Check if unused doors are properly disposed

### Debug Information

Enable console logging to see door operations:

```typescript
// Check door configuration
console.log(carcass.config.doorEnabled);
console.log(carcass.config.doorCount);
console.log(carcass.config.doorMaterial);
```
