/**
 * DrawerHeightManager - Centralized logic for managing drawer heights
 * Handles all calculations, validation, and redistribution of drawer heights
 */

export interface DrawerHeightConfig {
    carcassHeight: number;
    drawerQuantity: number;
    currentHeights: number[];
  }
  
  export interface DrawerHeightValidation {
    isValid: boolean;
    totalHeight: number;
    remainingHeight: number;
    errors: string[];
  }
  
  export interface DrawerHeightUpdate {
    newHeights: number[];
    changedIndex: number;
    balanceApplied: boolean;
  }
  
  export class DrawerHeightManager {
    private static readonly MIN_DRAWER_HEIGHT = 50; // Minimum drawer height in mm
    private static readonly DECIMAL_PRECISION = 1; // One decimal place
  
    /**
     * Calculate optimal drawer heights with equal distribution
     */
    static calculateOptimalHeights(carcassHeight: number, drawerQuantity: number): number[] {
      if (drawerQuantity <= 0) return [];
      
      const height = Math.round((carcassHeight / drawerQuantity) * Math.pow(10, this.DECIMAL_PRECISION)) / Math.pow(10, this.DECIMAL_PRECISION);
      return Array(drawerQuantity).fill(height);
    }
  
    /**
     * Update a single drawer height and redistribute remaining heights
     */
    static updateDrawerHeight(
      config: DrawerHeightConfig,
      changedIndex: number,
      newHeight: number
    ): DrawerHeightUpdate {
      // Validate and round the new height
      const validatedHeight = this.validateHeight(newHeight, config.carcassHeight);
      
      // Create a copy of current heights
      const newHeights = [...config.currentHeights];
      
      // Ensure array has correct length
      while (newHeights.length < config.drawerQuantity) {
        newHeights.push(0);
      }
      
      // Update the changed drawer height
      newHeights[changedIndex] = validatedHeight;
      
      // Calculate remaining height to distribute
      const remainingHeight = config.carcassHeight - validatedHeight;
      const remainingDrawers = config.drawerQuantity - 1;
      
      if (remainingDrawers > 0 && remainingHeight > 0) {
        // Distribute remaining height equally among other drawers
        const heightPerDrawer = Math.round((remainingHeight / remainingDrawers) * Math.pow(10, this.DECIMAL_PRECISION)) / Math.pow(10, this.DECIMAL_PRECISION);
        
        // Ensure minimum height for each drawer
        const finalHeightPerDrawer = Math.max(heightPerDrawer, this.MIN_DRAWER_HEIGHT);
        
        // Update all other drawer heights
        for (let i = 0; i < config.drawerQuantity; i++) {
          if (i !== changedIndex) {
            newHeights[i] = finalHeightPerDrawer;
          }
        }
        
        // Validate total height and adjust if necessary
        const totalHeight = newHeights.reduce((sum, height) => sum + height, 0);
        if (totalHeight > config.carcassHeight) {
          // If total exceeds carcass height, reset to optimal distribution
          const optimalHeights = this.calculateOptimalHeights(config.carcassHeight, config.drawerQuantity);
          return {
            newHeights: optimalHeights,
            changedIndex,
            balanceApplied: true
          };
        }
      } else if (remainingDrawers > 0 && remainingHeight <= 0) {
        // If no remaining height or negative, reset to optimal distribution
        const optimalHeights = this.calculateOptimalHeights(config.carcassHeight, config.drawerQuantity);
        return {
          newHeights: optimalHeights,
          changedIndex,
          balanceApplied: true
        };
      }
      
      return {
        newHeights,
        changedIndex,
        balanceApplied: false
      };
    }
  
    /**
     * Validate drawer heights configuration
     */
    static validateHeights(config: DrawerHeightConfig): DrawerHeightValidation {
      const errors: string[] = [];
      
      if (config.drawerQuantity <= 0) {
        errors.push('At least one drawer is required');
      }
  
      if (config.currentHeights.length !== config.drawerQuantity) {
        errors.push(`Height array length (${config.currentHeights.length}) doesn't match drawer quantity (${config.drawerQuantity})`);
      }
  
      const totalHeight = config.currentHeights.reduce((sum, height) => sum + (height || 0), 0);
      const remainingHeight = config.carcassHeight - totalHeight;
      
      if (totalHeight > config.carcassHeight) {
        errors.push(`Total drawer height (${totalHeight}mm) exceeds carcass height (${config.carcassHeight}mm)`);
      }
  
      if (config.currentHeights.some(height => height < this.MIN_DRAWER_HEIGHT)) {
        errors.push(`All drawer heights must be at least ${this.MIN_DRAWER_HEIGHT}mm`);
      }
  
      return {
        isValid: errors.length === 0,
        totalHeight,
        remainingHeight,
        errors
      };
    }
  
    /**
     * Scale drawer heights proportionally when carcass height changes
     */
    static scaleHeightsProportionally(
      currentHeights: number[],
      oldCarcassHeight: number,
      newCarcassHeight: number
    ): number[] {
      if (currentHeights.length === 0 || oldCarcassHeight <= 0) {
        return currentHeights;
      }
      
      const scaleRatio = newCarcassHeight / oldCarcassHeight;
      const scaledHeights = currentHeights.map(height => 
        Math.round((height * scaleRatio) * Math.pow(10, this.DECIMAL_PRECISION)) / Math.pow(10, this.DECIMAL_PRECISION)
      );
      
      // Validate total doesn't exceed new carcass height
      const totalScaledHeight = scaledHeights.reduce((sum, height) => sum + height, 0);
      if (totalScaledHeight > newCarcassHeight) {
        // If scaled heights exceed new carcass height, reset to optimal distribution
        return this.calculateOptimalHeights(newCarcassHeight, currentHeights.length);
      }
      
      return scaledHeights;
    }
  
    /**
     * Reset heights to optimal equal distribution
     */
    static resetToOptimal(carcassHeight: number, drawerQuantity: number): number[] {
      return this.calculateOptimalHeights(carcassHeight, drawerQuantity);
    }
  
    /**
     * Get height distribution summary for UI display
     */
    static getHeightSummary(config: DrawerHeightConfig): {
      totalUsed: number;
      remainingHeight: number;
      isOptimal: boolean;
      exceedsLimit: boolean;
      heightPercentage: number;
    } {
      const totalUsed = config.currentHeights.reduce((sum, height) => sum + (height || 0), 0);
      const remainingHeight = config.carcassHeight - totalUsed;
      const optimalHeights = this.calculateOptimalHeights(config.carcassHeight, config.drawerQuantity);
      const isOptimal = config.currentHeights.every((height, index) => 
        Math.abs(height - optimalHeights[index]) < 0.1
      );
      const exceedsLimit = totalUsed > config.carcassHeight;
      const heightPercentage = (totalUsed / config.carcassHeight) * 100;
      
      return {
        totalUsed,
        remainingHeight,
        isOptimal,
        exceedsLimit,
        heightPercentage
      };
    }
  
    /**
     * Validate and round a single height value
     */
    private static validateHeight(height: number, maxHeight: number): number {
      // Round to specified decimal precision
      let validatedHeight = Math.round(height * Math.pow(10, this.DECIMAL_PRECISION)) / Math.pow(10, this.DECIMAL_PRECISION);
      
      // Ensure within valid range
      validatedHeight = Math.max(this.MIN_DRAWER_HEIGHT, validatedHeight);
      validatedHeight = Math.min(maxHeight, validatedHeight);
      
      return validatedHeight;
    }
  
    /**
     * Calculate the proportional height for a drawer based on cabinet height and quantity
     */
    static getProportionalHeight(carcassHeight: number, drawerQuantity: number): number {
      if (drawerQuantity <= 0) return 0;
      return Math.round((carcassHeight / drawerQuantity) * Math.pow(10, this.DECIMAL_PRECISION)) / Math.pow(10, this.DECIMAL_PRECISION);
    }
  
    /**
     * Check if current heights are at optimal distribution
     */
    static isOptimalDistribution(config: DrawerHeightConfig): boolean {
      const optimal = this.calculateOptimalHeights(config.carcassHeight, config.drawerQuantity);
      return config.currentHeights.every((height, index) => 
        Math.abs(height - optimal[index]) < 0.1
      );
    }
  }