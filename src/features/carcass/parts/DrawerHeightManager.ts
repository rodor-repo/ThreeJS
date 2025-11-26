/**
 * DrawerHeightManager - Centralized logic for managing drawer heights
 * Handles all calculations, validation, and redistribution of drawer heights
 */

import { roundToDecimal, distributeHeightEqually, clamp } from '../utils/carcass-math-utils';

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
      return distributeHeightEqually(carcassHeight, drawerQuantity);
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
        const heightPerDrawer = roundToDecimal(remainingHeight / remainingDrawers, this.DECIMAL_PRECISION);

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
     * Validate if total minimum height of drawers fits within carcass height
     */
    static validateTotalMinHeight(
        constraints: { min: number }[],
        carcassHeight: number
    ): boolean {
        const totalMin = constraints.reduce((sum, c) => sum + (c.min || this.MIN_DRAWER_HEIGHT), 0);
        return totalMin <= carcassHeight;
    }

    /**
     * Validate if total maximum height of drawers is at least the carcass height
     * (i.e. can the drawers expand to fill the carcass?)
     */
    static validateTotalMaxHeight(
        constraints: { max: number }[],
        carcassHeight: number
    ): boolean {
        const totalMax = constraints.reduce((sum, c) => sum + (c.max || Number.MAX_SAFE_INTEGER), 0);
        return totalMax >= carcassHeight;
    }
  
    /**
     * Scale drawer heights proportionally when carcass height changes
     * Handles minimum and maximum height constraints recursively
     */
    static scaleHeightsProportionally(
      currentHeights: number[],
      oldCarcassHeight: number,
      newCarcassHeight: number,
      constraints: { min: number; max: number }[] = []
    ): number[] {
      if (currentHeights.length === 0 || oldCarcassHeight <= 0) {
        return currentHeights;
      }
      
      const scaleRatio = newCarcassHeight / oldCarcassHeight;
      
      // Initial proportional scaling
      let newHeights = currentHeights.map(height =>
        roundToDecimal(height * scaleRatio, this.DECIMAL_PRECISION)
      );

      // If no constraints provided, just return scaled heights (with basic total check)
      if (constraints.length === 0) {
          const totalScaledHeight = newHeights.reduce((sum, height) => sum + height, 0);
          if (totalScaledHeight > newCarcassHeight) {
            return this.calculateOptimalHeights(newCarcassHeight, currentHeights.length);
          }
          return newHeights;
      }

      // Recursive redistribution to satisfy constraints
      let iterations = 0;
      const maxIterations = 10;
      let solved = false;

      while (!solved && iterations < maxIterations) {
        iterations++;
        let deficit = 0;
        let surplus = 0;
        const lockedIndices = new Set<number>();

        // 1. Identify violations and clamp
        for (let i = 0; i < newHeights.length; i++) {
            const h = newHeights[i];
            // Use provided constraints or defaults
            const min = constraints[i]?.min ?? this.MIN_DRAWER_HEIGHT;
            const max = constraints[i]?.max ?? newCarcassHeight;

            if (h < min) {
                deficit += (min - h);
                newHeights[i] = min;
                lockedIndices.add(i);
            } else if (h > max) {
                surplus += (h - max);
                newHeights[i] = max;
                lockedIndices.add(i);
            }
        }

        // Check if we need to redistribute
        const totalAdjustmentNeeded = deficit - surplus;
        
        if (Math.abs(totalAdjustmentNeeded) < 0.1) {
            solved = true;
            break;
        }

        // 2. Distribute the adjustment among unlocked drawers
        const amountToDistribute = surplus - deficit;
        const unlockedIndices = newHeights.map((_, i) => i).filter(i => !lockedIndices.has(i));
        
        if (unlockedIndices.length === 0) {
            console.warn("DrawerHeightManager: Cannot redistribute, all drawers are locked or constrained.");
            break; 
        }

        const totalUnlockedHeight = unlockedIndices.reduce((sum, i) => sum + newHeights[i], 0);

        if (totalUnlockedHeight <= 0) {
             // Fallback to equal distribution if weights are 0
             const perDrawer = amountToDistribute / unlockedIndices.length;
             unlockedIndices.forEach(i => {
                 newHeights[i] += perDrawer;
             });
        } else {
            // Proportional distribution
            unlockedIndices.forEach(i => {
                const weight = newHeights[i] / totalUnlockedHeight;
                const change = amountToDistribute * weight;
                newHeights[i] += change;
            });
        }
        
        // Round again
        newHeights = newHeights.map(h => roundToDecimal(h, this.DECIMAL_PRECISION));
      }

      // Final check to ensure total matches newCarcassHeight
      const finalTotal = newHeights.reduce((sum, h) => sum + h, 0);
      const diff = newCarcassHeight - finalTotal;
      if (Math.abs(diff) > 0.1) {
          // Distribute remainder to the largest drawer that isn't locked (or just largest)
          let maxH = -1;
          let maxIdx = -1;
          newHeights.forEach((h, i) => {
               if (h > maxH) {
                   maxH = h;
                   maxIdx = i;
               }
          });
          if (maxIdx !== -1) {
              newHeights[maxIdx] += diff;
              newHeights[maxIdx] = roundToDecimal(newHeights[maxIdx], this.DECIMAL_PRECISION);
          }
      }
      
      return newHeights;
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
      const roundedHeight = roundToDecimal(height, this.DECIMAL_PRECISION);

      // Ensure within valid range
      return clamp(roundedHeight, this.MIN_DRAWER_HEIGHT, maxHeight);
    }
  
    /**
     * Calculate the proportional height for a drawer based on cabinet height and quantity
     */
    static getProportionalHeight(carcassHeight: number, drawerQuantity: number): number {
      if (drawerQuantity <= 0) return 0;
      return roundToDecimal(carcassHeight / drawerQuantity, this.DECIMAL_PRECISION);
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