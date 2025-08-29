import * as THREE from 'three';
import { CarcassEnd } from './parts/CarcassEnd';
import { CarcassBack } from './parts/CarcassBack';
import { CarcassBottom } from './parts/CarcassBottom';
import { CarcassShelf } from './parts/CarcassShelf';
import { CarcassTop } from './parts/CarcassTop';
import { CarcassLeg } from './parts/CarcassLeg';
import { CarcassDoor } from './parts/CarcassDoor';
import { CarcassDrawer } from './parts/CarcassDrawer';
import { CarcassMaterial, CarcassMaterialData } from './Material';
import { DoorMaterial } from './DoorMaterial';
import { MaterialLoader } from './MaterialLoader';
import { categoriesData } from '../categoriesData';

export interface CarcassDimensions {
  width: number;    // Width of the cabinet (X Axes)
  height: number;   // Height of the cabinet (Y Axes)
  depth: number;    // Depth of the cabinet (Z Axes)
}

export interface CarcassConfig {
  material: CarcassMaterial;  // Material properties including thickness and colour
  shelfCount: number;         // Number of adjustable shelves
  shelfSpacing: number;       // Spacing between shelves
  doorEnabled?: boolean;      // Whether doors are enabled for this cabinet
  doorMaterial?: DoorMaterial; // Door material properties
  doorCount?: number;         // Number of doors (1 or 2)
  overhangDoor?: boolean;     // Whether doors should overhang (Top/Wall cabinets only)
  drawerEnabled?: boolean;    // Whether drawers are enabled for this cabinet
  drawerQuantity?: number;    // Number of drawers (1-6)
  drawerHeights?: number[];   // Individual drawer heights
}

export type CabinetType = 'top' | 'base' | 'tall';

export class CarcassAssembly {
  public group: THREE.Group;
  public dimensions: CarcassDimensions;
  public config: CarcassConfig;
  public cabinetType: CabinetType;

  // Carcass parts
  private leftEnd!: CarcassEnd;
  private rightEnd!: CarcassEnd;
  private back!: CarcassBack;
  private bottom!: CarcassBottom;
  private top!: CarcassTop;
  private shelves: CarcassShelf[] = [];
  private legs: CarcassLeg[] = [];
  private doors: CarcassDoor[] = [];
  private drawers: CarcassDrawer[] = [];

  constructor(
    cabinetType: CabinetType,
    dimensions: CarcassDimensions,
    config?: Partial<CarcassConfig>
  ) {
    this.cabinetType = cabinetType;
    this.dimensions = dimensions;

    // Set default configuration
    this.config = {
      material: config?.material || CarcassMaterial.getDefaultMaterial(),
      shelfCount: 2,         // Default 2 shelves
      shelfSpacing: 300,     // 300mm between shelves
      doorEnabled: config?.doorEnabled !== undefined ? config.doorEnabled : true, // Doors enabled by default
      doorMaterial: config?.doorMaterial || DoorMaterial.getDefaultMaterial(),
      doorCount: config?.doorCount || 2, // Default 2 doors
      overhangDoor: config?.overhangDoor !== undefined ? config.overhangDoor : (cabinetType === 'top'), // Overhang only for Top cabinets by default
      drawerEnabled: config?.drawerEnabled !== undefined ? config.drawerEnabled : false, // Drawers disabled by default
      drawerQuantity: config?.drawerQuantity || 3, // Default 3 drawers
      drawerHeights: config?.drawerHeights || [], // Will be calculated based on quantity
      ...config
    };

    // Debug logging for config
    console.log('CarcassAssembly config set to:', this.config);

    // Create main group
    this.group = new THREE.Group();
    this.group.name = `${cabinetType}_carcass`;

    // Build the carcass based on type
    this.buildCarcass();
  }

  private buildCarcass(): void {
    // Create all carcass parts
    this.createEndPanels();
    this.createBackPanel();
    this.createBottomPanel();
    this.createTopPanel();
    this.createShelves();
    this.createLegs();
    this.createDrawers();
    this.createDoors();

    // Add all parts to the main group
    this.group.add(this.leftEnd.group);
    this.group.add(this.rightEnd.group);
    this.group.add(this.back.group);
    this.group.add(this.bottom.group);
    this.group.add(this.top.group);

    this.shelves.forEach(shelf => {
      this.group.add(shelf.group);
    });

    // Add legs for base and tall cabinets
    this.legs.forEach(leg => {
      this.group.add(leg.group);
    });

    // Add drawers if enabled
    this.drawers.forEach(drawer => {
      this.group.add(drawer.group);
    });

    // Add doors if enabled
    this.doors.forEach(door => {
      this.group.add(door.group);
    });

    // Position the entire carcass based on type
    this.positionCarcass();
  }

  private createEndPanels(): void {
    // End Left: EndLHeight= Height (Y Axes), EndLDepth =Depth (Z Axes), EndLThickness= Thickness (X Axes)
    // Position: bottom back corner at (0,0,0)
    this.leftEnd = new CarcassEnd({
      height: this.dimensions.height,
      depth: this.dimensions.depth,
      thickness: this.config.material.getThickness(),
      position: 'left',
      material: this.config.material.getMaterial()
    });

    // End Right: EndRHeight= Height (Y Axes), EndRDepth =Depth (Z Axes), EndRThickness= Thickness (X Axes)
    // Position: bottom back corner at (Width - Thickness, 0, 0)
    this.rightEnd = new CarcassEnd({
      height: this.dimensions.height,
      depth: this.dimensions.depth,
      thickness: this.config.material.getThickness(),
      position: 'right',
      material: this.config.material.getMaterial()
    });

    // Position the right end panel correctly
    // End Right Surface: (EndRWidth+BackWidth,0,0) to (0,EndRHeight,EndRDepth)
    // The right end is positioned at: Width - (Thickness/2) (center of the panel)
    const rightEndX = this.dimensions.width - (this.config.material.getThickness() / 2);
    this.rightEnd.setXPosition(rightEndX);
  }

  private createBackPanel(): void {
    // Back: BackHeight= Height (Y Axes), BackWidth =Width - 2x Thickness (X Axes), BackThickness= Thickness (Z Axes)
    // Width should be: Carcass width - (EndLThickness + EndRThickness) = Width - (2 × Thickness)
    this.back = new CarcassBack({
      height: this.dimensions.height,
      width: this.dimensions.width - (this.config.material.getThickness() * 2), // Account for both end panels
      thickness: this.config.material.getThickness(),
      leftEndThickness: this.config.material.getThickness(),
      material: this.config.material.getMaterial()
    });
  }

  private createBottomPanel(): void {
    // Bottom: BottomHeight= Depth (Z Axes), BottomWidth =Width - 2x Thickness (X Axes), BottomThickness= Thickness (Y Axes)
    // Width should be: Carcass width - (EndLThickness + EndRThickness) = Width - (2 × Thickness)
    // This ensures the panel fits exactly between the two end panels
    const panelWidth = this.dimensions.width - (this.config.material.getThickness() * 2);
    this.bottom = new CarcassBottom({
      depth: this.dimensions.depth - this.config.material.getThickness(), // Account for back panel
      width: panelWidth, // Account for both end panels
      thickness: this.config.material.getThickness(),
      leftEndThickness: this.config.material.getThickness(),
      backThickness: this.config.material.getThickness(),
      material: this.config.material.getMaterial()
    });
  }

  private createTopPanel(): void {
    // Top: TopHeight= Depth (Z Axes), TopWidth =Width - 2x Thickness (X Axes), TopThickness= Thickness (Y Axes)
    // Width should be: Carcass width - (EndLThickness + EndRThickness) = Width - (2 × Thickness)
    // This ensures the panel fits exactly between the two end panels
    const panelWidth = this.dimensions.width - (this.config.material.getThickness() * 2);
    
    // Get Base Rail depth from data using MaterialLoader
    const baseRailDepth = MaterialLoader.getBaseRailDepth(this.cabinetType);
    
    // Determine if this is a Drawer Base cabinet
    const isDrawerBase = this.cabinetType === 'base' && this.config.drawerEnabled;
    
    this.top = new CarcassTop({
      depth: this.dimensions.depth - this.config.material.getThickness(), // Account for back panel
      width: panelWidth, // Account for both end panels
      thickness: this.config.material.getThickness(),
      height: this.dimensions.height,
      leftEndThickness: this.config.material.getThickness(),
      backThickness: this.config.material.getThickness(),
      material: this.config.material.getMaterial(),
      cabinetType: this.cabinetType,
      baseRailDepth: baseRailDepth,
      isDrawerBase: isDrawerBase
    });
  }

  private createShelves(): void {
    this.shelves = [];

    if (this.config.shelfCount > 0) {
      const startHeight = this.config.material.getThickness() + 100; // Start above bottom panel
      const endHeight = this.dimensions.height - this.config.material.getThickness() - 100; // End below top panel

      if (endHeight > startHeight) {
        const totalShelfSpace = endHeight - startHeight;
        const spacing = Math.min(this.config.shelfSpacing, totalShelfSpace / (this.config.shelfCount + 1));

        // Calculate panel width to ensure it fits exactly between end panels
        const panelWidth = this.dimensions.width - (this.config.material.getThickness() * 2);

        for (let i = 0; i < this.config.shelfCount; i++) {
          const height = startHeight + (i + 1) * spacing;

          const shelf = new CarcassShelf({
            depth: this.dimensions.depth - this.config.material.getThickness(), // Account for back panel
            width: panelWidth, // Account for both end panels
            thickness: this.config.material.getThickness(),
            height: height,
            leftEndThickness: this.config.material.getThickness(),
            backThickness: this.config.material.getThickness(),
            material: this.config.material.getMaterial()
          });

          this.shelves.push(shelf);
        }
      }
    }
  }

  private createLegs(): void {
    this.legs = [];

    // Only create legs for base and tall cabinets
    if (this.cabinetType === 'base' || this.cabinetType === 'tall') {
      // Get leg height from data.js via MaterialLoader
      const legHeight = MaterialLoader.getLegHeight();
      const panelWidth = this.dimensions.width - (this.config.material.getThickness() * 2);

      // Create 4 legs at the corners
      const legPositions: Array<'frontLeft' | 'frontRight' | 'backLeft' | 'backRight'> = [
        'frontLeft',
        'frontRight', 
        'backLeft',
        'backRight'
      ];

      legPositions.forEach(position => {
        const leg = new CarcassLeg({
          height: legHeight,
          diameter: 50, // 50mm diameter as specified
          position: position,
          width: this.dimensions.width,
          depth: this.dimensions.depth,
          thickness: this.config.material.getThickness(),
          material: this.config.material.getMaterial()
        });

        this.legs.push(leg);
      });
    }
  }

  private createDrawers(): void {
    this.drawers = [];

    // Only create drawers if they are enabled
    if (this.config.drawerEnabled && this.config.drawerQuantity) {
      // Calculate drawer width accounting for end panel thicknesses
      // The carcass extends from x=0 to x=width, but end panels take up thickness
      const endPanelThickness = this.config.material.getPanelThickness();
      const drawerWidth = this.dimensions.width - (endPanelThickness * 2);
      const drawerDepth = this.dimensions.depth;
      
      // Calculate default drawer heights if not provided
      let drawerHeights = this.config.drawerHeights || [];
      if (drawerHeights.length === 0) {
        // Calculate equal distribution ensuring it fits within carcass height
        const defaultHeight = Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
        drawerHeights = Array(this.config.drawerQuantity).fill(defaultHeight);
        this.config.drawerHeights = [...drawerHeights];
      } else {
        // Validate existing heights and ensure they fit within carcass height
        const totalHeight = drawerHeights.reduce((sum, height) => sum + height, 0);
        if (totalHeight > this.dimensions.height) {
          // Redistribute equally to fit within carcass height
          const adjustedHeight = Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
          drawerHeights = Array(this.config.drawerQuantity).fill(adjustedHeight);
          this.config.drawerHeights = [...drawerHeights];
          console.log(`Total drawer height exceeded carcass height. Redistributed to ${adjustedHeight}mm each.`);
        }
      }
      
      // Create drawer fronts
      for (let i = 0; i < this.config.drawerQuantity; i++) {
        const drawerHeight = drawerHeights[i] || Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
        const drawer = new CarcassDrawer({
          width: drawerWidth,
          height: drawerHeight,
          depth: this.dimensions.depth, // Carcass depth - drawer will be positioned at this Z coordinate
          material: this.config.material,
          position: i,
          totalDrawers: this.config.drawerQuantity,
          carcassHeight: this.dimensions.height
        });
        this.drawers.push(drawer);
      }
      
      // Update positions after creating all drawers
      this.updateDrawerPositions();
    }
  }

  private createDoors(): void {
    this.doors = [];

    // Debug logging for door creation
    console.log('Creating doors with config:', {
      doorEnabled: this.config.doorEnabled,
      doorCount: this.config.doorCount,
      overhangDoor: this.config.overhangDoor
    });

    // Only create doors if they are enabled
    if (this.config.doorEnabled) {
      const doorWidth = this.dimensions.width;
      const doorHeight = this.dimensions.height;
      const doorDepth = this.dimensions.depth;

      if (this.config.doorCount === 2) {
        // Get door gap from data.js
        const doorGap = categoriesData.doorSettings?.gap || 2;
        
        // Create two doors side by side with gap applied
        const singleDoorWidth = (doorWidth / 2) - doorGap;
        const doorHeightWithGap = doorHeight - (doorGap * 2);
        
        // Left door
        const leftDoor = new CarcassDoor({
          width: singleDoorWidth,
          height: doorHeightWithGap,
          depth: doorDepth,
          thickness: this.config.material.getThickness(),
          material: this.config.doorMaterial!,
          position: 'left',
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang: this.cabinetType === 'top' ? (this.config.overhangDoor || false) : false
        });

        // Right door
        const rightDoor = new CarcassDoor({
          width: singleDoorWidth,
          height: doorHeightWithGap,
          depth: doorDepth,
          thickness: this.config.material.getThickness(),
          material: this.config.doorMaterial!,
          position: 'right',
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang: this.cabinetType === 'top' ? (this.config.overhangDoor || false) : false
        });

        this.doors.push(leftDoor, rightDoor);
      } else {
        // Get door gap from data.js
        const doorGap = categoriesData.doorSettings?.gap || 2;
        
        // Create single centered door with gap applied
        const doorWidthWithGap = doorWidth - (doorGap * 2);
        const doorHeightWithGap = doorHeight - (doorGap * 2);
        
        const door = new CarcassDoor({
          width: doorWidthWithGap,
          height: doorHeightWithGap,
          depth: doorDepth,
          thickness: this.config.material.getThickness(),
          material: this.config.doorMaterial!,
          position: 'center',
          offset: 2, // 2mm clearance from carcass
          carcassWidth: this.dimensions.width,
          overhang: this.cabinetType === 'top' ? (this.config.overhangDoor || false) : false
        });

        this.doors.push(door);
      }
    }
  }

  private positionCarcass(): void {
    // Position based on cabinet type
    switch (this.cabinetType) {
      case 'top':
        // Top cabinets are positioned at wall height (typically 2400mm from floor)
        this.group.position.set(0, 2400, 0);
        break;
      case 'base':
        // Base cabinets are positioned above the floor by leg height
        const baseLegHeight = MaterialLoader.getLegHeight();
        this.group.position.set(0, baseLegHeight, 0);
        break;
      case 'tall':
        // Tall cabinets are positioned above the floor by leg height
        const tallLegHeight = MaterialLoader.getLegHeight();
        this.group.position.set(0, tallLegHeight, 0);
        break;
    }
  }

  public updateDimensions(newDimensions: CarcassDimensions): void {
    this.dimensions = newDimensions;

    // Update all parts
    this.leftEnd.updateDimensions(
      this.dimensions.height,
      this.dimensions.depth,
      this.config.material.getThickness()
    );

    this.rightEnd.updateDimensions(
      this.dimensions.height,
      this.dimensions.depth,
      this.config.material.getThickness()
    );

    // Update right end position
    const rightEndX = this.dimensions.width - (this.config.material.getThickness() / 2);
    this.rightEnd.setXPosition(rightEndX);

    // Calculate panel width to ensure it fits exactly between end panels
    const panelWidth = this.dimensions.width - (this.config.material.getThickness() * 2);

    // Update back panel with corrected width: Width - (EndLThickness + EndRThickness)
    this.back.updateDimensions(
      this.dimensions.height,
      panelWidth, // Account for both end panels
      this.config.material.getThickness(),
      this.config.material.getThickness()
    );

    // Update bottom panel with corrected width: Width - (EndLThickness + EndRThickness)
    this.bottom.updateDimensions(
      this.dimensions.depth - this.config.material.getThickness(),
      panelWidth, // Account for both end panels
      this.config.material.getThickness(),
      this.config.material.getThickness(),
      this.config.material.getThickness()
    );

    // Update top panel with corrected width: Width - (EndLThickness + EndRThickness)
    this.top.updateDimensions(
      this.dimensions.depth - this.config.material.getThickness(),
      panelWidth, // Account for both end panels
      this.config.material.getThickness(),
      this.config.material.getThickness(),
      this.config.material.getThickness()
    );
    this.top.updateHeight(this.dimensions.height);
    
    // Update Base Rail settings for Base cabinets
    if (this.cabinetType === 'base') {
      const baseRailDepth = MaterialLoader.getBaseRailDepth(this.cabinetType);
      this.top.updateBaseRailSettings(this.cabinetType, baseRailDepth);
    }

    // Update shelves
    this.updateShelves();
    
    // Update legs with new dimensions
    this.updateLegs();
    
    // Update doors with new dimensions
    this.updateDoors();
    
    // Update drawers with new dimensions
    this.updateDrawers();
  }

  public updateConfig(newConfig: Partial<CarcassConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Store the current position before rebuilding
    const currentX = this.group.position.x;
    const currentY = this.group.position.y;
    const currentZ = this.group.position.z;

    // Rebuild carcass with new configuration
    this.dispose();
    this.buildCarcass();
    
    // Restore the position that was set when the cabinet was created
    this.group.position.set(currentX, currentY, currentZ);
  }

  public updateMaterial(newMaterial: CarcassMaterial): void {
    this.config.material = newMaterial;
    
    // Store the current position before rebuilding
    const currentX = this.group.position.x;
    const currentY = this.group.position.y;
    const currentZ = this.group.position.z;
    
    // Rebuild carcass with new material
    this.dispose();
    this.buildCarcass();
    
    // Restore the position that was set when the cabinet was created
    this.group.position.set(currentX, currentY, currentZ);
  }

  public updateMaterialProperties(materialChanges: Partial<CarcassMaterialData>): void {
    // Update the material properties
    this.config.material.updateMaterial(materialChanges);
    
    // Store the current position before rebuilding
    const currentX = this.group.position.x;
    const currentY = this.group.position.y;
    const currentZ = this.group.position.z;
    
    // Rebuild carcass with updated material properties
    this.dispose();
    this.buildCarcass();
    
    // Restore the position that was set when the cabinet was created
    this.group.position.set(currentX, currentY, currentZ);
  }

  public updateKickerHeight(kickerHeight: number): void {
    console.log('Updating kicker height to:', kickerHeight);
    
    // Update the leg height in the data file
    MaterialLoader.updateLegHeight(kickerHeight);
    
    // Update leg heights directly without rebuilding the entire carcass
    if (this.legs.length > 0) {
      this.legs.forEach(leg => {
        leg.updateDimensions(
          kickerHeight,
          this.dimensions.width,
          this.dimensions.depth,
          this.config.material.getThickness()
        );
      });
      
      // Update the cabinet's Y position to account for the new leg height
      if (this.cabinetType === 'base' || this.cabinetType === 'tall') {
        this.group.position.y = kickerHeight;
      }
    }
    
    console.log('Kicker height updated, cabinet repositioned. X position preserved:', this.group.position.x);
  }

  // Static method to load material from data
  static loadMaterialFromData(materialId: string): CarcassMaterial | null {
    return MaterialLoader.loadMaterialById(materialId);
  }

  private updateShelves(): void {
    // Remove existing shelves
    this.shelves.forEach(shelf => {
      this.group.remove(shelf.group);
      shelf.dispose();
    });

    // Create new shelves with updated thickness
    this.createShelves();

    // Add new shelves to group
    this.shelves.forEach(shelf => {
      this.group.add(shelf.group);
    });
  }

  private updateLegs(): void {
    // Only update legs for base and tall cabinets
    if (this.legs.length > 0) {
      console.log(`Updating ${this.legs.length} legs with new dimensions:`, {
        width: this.dimensions.width,
        depth: this.dimensions.depth,
        thickness: this.config.material.getThickness()
      });
      
      this.legs.forEach((leg, index) => {
        console.log(`Updating leg ${index + 1} (${leg.position}) from:`, {
          width: leg.width,
          depth: leg.depth,
          thickness: leg.thickness
        });
        
        leg.updateDimensions(
          leg.height, // Keep current leg height
          this.dimensions.width,
          this.dimensions.depth,
          this.config.material.getThickness()
        );
        
        console.log(`Leg ${index + 1} updated to:`, {
          width: leg.width,
          depth: leg.depth,
          thickness: leg.thickness,
          position: leg.group.position
        });
      });
    }
  }

  private updateDoors(): void {
    // Only update doors if they are enabled
    if (this.config.doorEnabled && this.doors.length > 0) {
      const doorWidth = this.dimensions.width;
      const doorHeight = this.dimensions.height;
      const doorDepth = this.dimensions.depth;

      if (this.config.doorCount === 2 && this.doors.length === 2) {
        // Get door gap from data.js
        const doorGap = categoriesData.doorSettings?.gap || 2;
        
        // Update two doors side by side with gap applied
        const singleDoorWidth = (doorWidth / 2) - doorGap;
        const doorHeightWithGap = doorHeight - (doorGap * 2);
        
        // Update left door
        this.doors[0].updateDimensions(
          singleDoorWidth,
          doorHeightWithGap,
          doorDepth,
          this.config.material.getThickness()
        );
        this.doors[0].updateCarcassWidth(this.dimensions.width);

        // Update right door
        this.doors[1].updateDimensions(
          singleDoorWidth,
          doorHeightWithGap,
          doorDepth,
          this.config.material.getThickness()
        );
        this.doors[1].updateCarcassWidth(this.dimensions.width);
      } else if (this.doors.length === 1) {
        // Get door gap from data.js
        const doorGap = categoriesData.doorSettings?.gap || 2;
        
        // Update single door with gap applied
        const doorWidthWithGap = doorWidth - (doorGap * 2);
        const doorHeightWithGap = doorHeight - (doorGap * 2);
        
        this.doors[0].updateDimensions(
          doorWidthWithGap,
          doorHeightWithGap,
          doorDepth,
          this.config.material.getThickness()
        );
        this.doors[0].updateCarcassWidth(this.dimensions.width);
      }
    }
  }

  public dispose(): void {
    // Dispose all parts
    this.leftEnd.dispose();
    this.rightEnd.dispose();
    this.back.dispose();
    this.bottom.dispose();
    this.top.dispose();

    this.shelves.forEach(shelf => shelf.dispose());
    this.legs.forEach(leg => leg.dispose());
    this.doors.forEach(door => door.dispose());
    this.drawers.forEach(drawer => drawer.dispose());

    // Clear the group
    this.group.clear();
  }

  // Door management methods
  public toggleDoors(enabled: boolean): void {
    this.config.doorEnabled = enabled;
    
    if (enabled) {
      // Create doors if they don't exist
      if (this.doors.length === 0) {
        this.createDoors();
        this.doors.forEach(door => {
          this.group.add(door.group);
        });
      }
    } else {
      // Remove doors from group and dispose them
      this.doors.forEach(door => {
        this.group.remove(door.group);
        door.dispose();
      });
      this.doors = [];
    }
  }

  public updateDoorConfiguration(doorCount: number, doorMaterial?: DoorMaterial): void {
    this.config.doorCount = doorCount;
    if (doorMaterial) {
      this.config.doorMaterial = doorMaterial;
    }
    
    // Rebuild doors if they are enabled
    if (this.config.doorEnabled) {
      // Remove existing doors
      this.doors.forEach(door => {
        this.group.remove(door.group);
        door.dispose();
      });
      this.doors = [];
      
      // Create new doors with current dimensions
      this.createDoors();
      this.doors.forEach(door => {
        this.group.add(door.group);
      });
    }
  }

  public updateOverhangDoor(overhang: boolean): void {
    // Only allow overhang for Top cabinets
    if (this.cabinetType !== 'top') {
      console.log('Overhang door setting ignored for non-Top cabinet type:', this.cabinetType);
      return;
    }
    
    console.log(`Updating overhang door setting for ${this.cabinetType} cabinet:`, overhang);
    this.config.overhangDoor = overhang;
    
    // Update existing doors with new overhang setting
    if (this.config.doorEnabled && this.doors.length > 0) {
      this.doors.forEach(door => {
        door.updateOverhang(overhang);
      });
    }
  }

  public updateDoorMaterial(doorMaterial: DoorMaterial): void {
    this.config.doorMaterial = doorMaterial;
    
    // Update existing doors
    this.doors.forEach(door => {
      door.updateMaterial(doorMaterial);
    });
  }

  // Drawer management methods
  public updateDrawerEnabled(enabled: boolean): void {
    console.log(`Updating drawer enabled setting for ${this.cabinetType} cabinet:`, enabled);
    this.config.drawerEnabled = enabled;
    
    if (enabled) {
      // Create drawers if they don't exist
      if (this.drawers.length === 0) {
        this.createDrawers();
        // Add drawers to the main group
        this.drawers.forEach(drawer => {
          this.group.add(drawer.group);
        });
      }
    } else {
      // Remove drawers from the main group and dispose them
      this.drawers.forEach(drawer => {
        this.group.remove(drawer.group);
        drawer.dispose();
      });
      this.drawers = [];
    }
  }

  public updateDrawerQuantity(quantity: number): void {
    console.log(`Updating drawer quantity for ${this.cabinetType} cabinet:`, quantity);
    
    // Store existing drawer heights to preserve user input
    const existingHeights = [...(this.config.drawerHeights || [])];
    
    this.config.drawerQuantity = quantity;
    
    // Calculate new drawer heights ensuring they fit within carcass height
    if (quantity > 0) {
      // Calculate default equal distribution
      const defaultHeight = Math.round((this.dimensions.height / quantity) * 10) / 10;
      let newDrawerHeights: number[] = [];
      
      if (existingHeights.length > 0 && quantity >= existingHeights.length) {
        // If increasing quantity, keep existing heights and add new ones
        newDrawerHeights = [...existingHeights];
        // Add default heights for new drawers
        for (let i = existingHeights.length; i < quantity; i++) {
          newDrawerHeights.push(defaultHeight);
        }
      } else if (existingHeights.length > 0 && quantity < existingHeights.length) {
        // If decreasing quantity, keep only the first N heights
        newDrawerHeights = existingHeights.slice(0, quantity);
      } else {
        // If no existing heights or quantity is 0, create default heights
        newDrawerHeights = Array(quantity).fill(defaultHeight);
      }
      
      // Ensure total height doesn't exceed carcass height
      const totalHeight = newDrawerHeights.reduce((sum, height) => sum + height, 0);
      if (totalHeight > this.dimensions.height) {
        // Redistribute equally to fit within carcass height
        const adjustedHeight = Math.round((this.dimensions.height / quantity) * 10) / 10;
        newDrawerHeights = Array(quantity).fill(adjustedHeight);
        console.log(`Total drawer height exceeded carcass height. Redistributed to ${adjustedHeight}mm each.`);
      }
      
      this.config.drawerHeights = newDrawerHeights;
      
      // Validate the final result
      const validation = this.validateDrawerHeights();
      if (!validation.isValid) {
        console.warn(`Drawer heights still exceed carcass height after quantity change. Auto-balancing.`);
        this.balanceDrawerHeights();
      }
    } else {
      // If quantity is 0, clear drawer heights
      this.config.drawerHeights = [];
    }
    
    // Remove existing drawers
    this.drawers.forEach(drawer => {
      this.group.remove(drawer.group);
      drawer.dispose();
    });
    this.drawers = [];
    
    // Create new drawers with the new quantity
    if (this.config.drawerEnabled) {
      this.createDrawers();
      // Add drawers to the main group
      this.drawers.forEach(drawer => {
        this.group.add(drawer.group);
      });
      
      // Ensure all drawer heights are properly set and distributed
      this.updateDrawerPositions();
    }
  }

  public updateDrawerHeight(index: number, height: number): void {
    console.log(`Updating drawer ${index} height for ${this.cabinetType} cabinet:`, height);
    
    // Ensure proper decimal handling - max one digit after decimal point
    height = Math.round(height * 10) / 10;
    
    // Validate the height value
    const minHeight = 50; // Minimum drawer height
    const maxHeight = this.dimensions.height; // Maximum drawer height
    
    if (height < minHeight) {
      console.warn(`Drawer height ${height}mm is below minimum ${minHeight}mm. Setting to minimum.`);
      height = minHeight;
    } else if (height > maxHeight) {
      console.warn(`Drawer height ${height}mm exceeds carcass height ${maxHeight}mm. Setting to maximum.`);
      height = maxHeight;
    }
    
    // Update the drawer height in the config
    if (!this.config.drawerHeights) {
      this.config.drawerHeights = [];
    }
    this.config.drawerHeights[index] = height;
    
    // Calculate height balance and redistribute among unchanged drawers
    this.redistributeDrawerHeights(index);
    
    // Validate final result and auto-balance if needed
    const validation = this.validateDrawerHeights();
    if (!validation.isValid) {
      console.warn(`Drawer heights still exceed carcass height after redistribution. Auto-balancing.`);
      this.balanceDrawerHeights();
    }
    
    // Update all drawer positions to account for height changes
    this.updateDrawerPositions();
  }

  /**
   * Get current drawer heights for UI display
   */
  public getDrawerHeights(): number[] {
    if (!this.config.drawerHeights || this.config.drawerHeights.length === 0) {
      // Return default heights if none are set
      const defaultHeight = Math.round((this.dimensions.height / (this.config.drawerQuantity || 1)) * 10) / 10;
      return Array(this.config.drawerQuantity || 1).fill(defaultHeight);
    }
    return [...this.config.drawerHeights];
  }

  /**
   * Get total drawer height for validation
   */
  public getTotalDrawerHeight(): number {
    const heights = this.getDrawerHeights();
    return heights.reduce((sum, height) => sum + height, 0);
  }

  /**
   * Validate that drawer heights fit within carcass height
   */
  public validateDrawerHeights(): { isValid: boolean; totalHeight: number; remainingHeight: number } {
    const totalHeight = this.getTotalDrawerHeight();
    const remainingHeight = this.dimensions.height - totalHeight;
    const isValid = totalHeight <= this.dimensions.height;
    
    return { isValid, totalHeight, remainingHeight };
  }

  /**
   * Redistribute remaining height among unchanged drawers
   * @param changedIndex - Index of the drawer that was just changed
   */
  private redistributeDrawerHeights(changedIndex: number): void {
    if (!this.config.drawerHeights || this.config.drawerHeights.length === 0) return;
    
    const totalCarcassHeight = this.dimensions.height;
    const totalDrawerQuantity = this.config.drawerQuantity || 1;
    
    // Calculate total height of all explicitly set drawer heights
    let totalExplicitHeight = 0;
    let unchangedDrawerCount = 0;
    
    for (let i = 0; i < totalDrawerQuantity; i++) {
      if (this.config.drawerHeights[i] && i !== changedIndex) {
        totalExplicitHeight += this.config.drawerHeights[i];
      } else if (i !== changedIndex) {
        unchangedDrawerCount++;
      }
    }
    
    // Add the height of the changed drawer
    totalExplicitHeight += this.config.drawerHeights[changedIndex] || 0;
    
    // Calculate remaining height to distribute
    const remainingHeight = totalCarcassHeight - totalExplicitHeight;
    
    if (remainingHeight > 0 && unchangedDrawerCount > 0) {
      // Distribute remaining height equally among unchanged drawers with proper decimal handling
      const heightPerDrawer = Math.round((remainingHeight / unchangedDrawerCount) * 10) / 10;
      
      for (let i = 0; i < totalDrawerQuantity; i++) {
        if (i !== changedIndex && !this.config.drawerHeights[i]) {
          this.config.drawerHeights[i] = heightPerDrawer;
        }
      }
      
      console.log(`Redistributed ${Math.round(remainingHeight * 10) / 10}mm among ${unchangedDrawerCount} unchanged drawers: ${heightPerDrawer}mm each`);
    } else if (remainingHeight < 0) {
      console.warn(`Total drawer height (${Math.round(totalExplicitHeight * 10) / 10}mm) exceeds carcass height (${totalCarcassHeight}mm)`);
      
      // If total exceeds carcass height, we need to adjust the changed drawer height
      const excessHeight = Math.abs(remainingHeight);
      const adjustedHeight = Math.round((this.config.drawerHeights[changedIndex] - excessHeight) * 10) / 10;
      
      // Ensure the adjusted height is at least 50mm (minimum drawer height)
      if (adjustedHeight >= 50) {
        this.config.drawerHeights[changedIndex] = adjustedHeight;
        console.log(`Adjusted drawer ${changedIndex} height to ${adjustedHeight}mm to fit within carcass height`);
        
        // Now redistribute the remaining height
        this.redistributeDrawerHeights(changedIndex);
      } else {
        // If we can't reduce enough, reset to default distribution
        console.warn(`Cannot reduce drawer height enough. Resetting to default distribution.`);
        this.resetDrawerHeightsToDefault();
      }
    }
    
    // Ensure all drawer heights are properly set (fill any undefined values)
    for (let i = 0; i < totalDrawerQuantity; i++) {
      if (!this.config.drawerHeights[i]) {
        // Calculate remaining height for this drawer
        const usedHeight = this.config.drawerHeights.reduce((sum, height, idx) => 
          sum + (idx !== i ? (height || 0) : 0), 0
        );
        const remainingForThisDrawer = totalCarcassHeight - usedHeight;
        
        if (remainingForThisDrawer >= 50) { // Minimum drawer height
          this.config.drawerHeights[i] = Math.round(remainingForThisDrawer * 10) / 10;
        } else {
          // If not enough height, set to minimum and redistribute
          this.config.drawerHeights[i] = 50;
          this.redistributeDrawerHeights(i);
        }
      }
    }
  }

  /**
   * Reset drawer heights to default equal distribution
   */
  private resetDrawerHeightsToDefault(): void {
    if (!this.config.drawerQuantity) return;
    
    const defaultHeight = Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
    this.config.drawerHeights = Array(this.config.drawerQuantity).fill(defaultHeight);
    
    console.log(`Reset drawer heights to default: ${defaultHeight}mm each`);
  }

  /**
   * Automatically balance drawer heights to fit within carcass height
   */
  public balanceDrawerHeights(): void {
    if (!this.config.drawerQuantity || this.config.drawerQuantity <= 0) return;
    
    const totalHeight = this.getTotalDrawerHeight();
    
    if (totalHeight > this.dimensions.height) {
      console.log(`Balancing drawer heights. Total: ${totalHeight}mm, Carcass: ${this.dimensions.height}mm`);
      
      // Reset to equal distribution
      this.resetDrawerHeightsToDefault();
      
      // Update drawer positions
      this.updateDrawerPositions();
      
      console.log('Drawer heights balanced and reset to equal distribution');
    }
  }

  /**
   * Get optimal drawer height distribution that fits within carcass height
   */
  public getOptimalDrawerHeights(): number[] {
    if (!this.config.drawerQuantity || this.config.drawerQuantity <= 0) {
      return [];
    }
    
    const defaultHeight = Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
    return Array(this.config.drawerQuantity).fill(defaultHeight);
  }

  private updateDrawerPositions(): void {
    if (!this.config.drawerEnabled || this.drawers.length === 0) return;
    
    // Get all drawer heights (use config heights if available, otherwise calculate defaults)
    const allDrawerHeights = this.drawers.map((drawer, index) => 
      this.config.drawerHeights?.[index] || Math.round((this.dimensions.height / (this.config.drawerQuantity || 1)) * 10) / 10
    );
    
    // Update each drawer's dimensions and position
    this.drawers.forEach((drawer, index) => {
      const drawerHeight = allDrawerHeights[index];
      
      // Always update drawer dimensions to ensure consistency
      const endPanelThickness = this.config.material.getPanelThickness();
      const drawerWidth = this.dimensions.width - (endPanelThickness * 2);
      
      drawer.updateDimensions(
        drawerWidth,
        drawerHeight,
        this.dimensions.depth
      );
      
      // Update position with all drawer heights for accurate positioning
      drawer.updatePositionWithAllHeights(allDrawerHeights);
    });
  }

  private updateDrawers(): void {
    if (this.config.drawerEnabled && this.drawers.length > 0) {
      // Calculate drawer width accounting for end panel thicknesses
      const endPanelThickness = this.config.material.getPanelThickness();
      const drawerWidth = this.dimensions.width - (endPanelThickness * 2);
      const drawerDepth = this.dimensions.depth;
      
      // Check if we need to recalculate drawer heights due to cabinet height change
      if (this.config.drawerHeights && this.config.drawerHeights.length > 0) {
        const drawerHeights = this.config.drawerHeights;
        const totalCurrentHeight = drawerHeights.reduce((sum, height) => sum + height, 0);
        const heightRatio = this.dimensions.height / totalCurrentHeight;
        
        // If the ratio is significantly different (more than 1% change), recalculate proportionally
        if (Math.abs(heightRatio - 1) > 0.01) {
          console.log(`Cabinet height changed. Recalculating drawer heights proportionally. Ratio: ${heightRatio}`);
          
          // Recalculate drawer heights proportionally
          this.config.drawerHeights = drawerHeights.map(height => 
            Math.round((height * heightRatio) * 10) / 10
          );
          
          // Ensure the total doesn't exceed the new cabinet height
          const totalNewHeight = this.config.drawerHeights!.reduce((sum, height) => sum + height, 0);
          if (totalNewHeight > this.dimensions.height) {
            // If still too tall, reset to equal distribution
            const defaultHeight = Math.round((this.dimensions.height / this.config.drawerQuantity) * 10) / 10;
            this.config.drawerHeights = Array(this.config.drawerQuantity).fill(defaultHeight);
            console.log(`Total drawer height still exceeds cabinet height after proportional adjustment. Reset to equal distribution: ${defaultHeight}mm each.`);
          }
        }
      }
      
      // Update each drawer with new dimensions
      this.drawers.forEach((drawer, index) => {
        const drawerHeight = this.config.drawerHeights?.[index] || Math.round((this.dimensions.height / (this.config.drawerQuantity || 1)) * 10) / 10;
        drawer.updateDimensions(drawerWidth, drawerHeight, drawerDepth);
        drawer.updateCarcassHeight(this.dimensions.height);
      });
      
      // Update drawer positions after dimension changes
      this.updateDrawerPositions();
    }
  }

  // Static factory methods for different cabinet types
  static createTopCabinet(dimensions: CarcassDimensions, config?: Partial<CarcassConfig>): CarcassAssembly {
    return new CarcassAssembly('top', dimensions, config);
  }

  static createBaseCabinet(dimensions: CarcassDimensions, config?: Partial<CarcassConfig>): CarcassAssembly {
    return new CarcassAssembly('base', dimensions, config);
  }

  static createTallCabinet(dimensions: CarcassDimensions, config?: Partial<CarcassConfig>): CarcassAssembly {
    return new CarcassAssembly('tall', dimensions, config);
  }
}
