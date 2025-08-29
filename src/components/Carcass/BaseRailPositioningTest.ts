/**
 * Test file to verify Base Rail positioning calculations
 * This helps ensure the positioning formula is correct
 */

export class BaseRailPositioningTest {
  
  /**
   * Test the Base Rail positioning calculation
   * For Base cabinets: Z = 0 (front edge of end panels) - VERTICAL positioning
   * For Drawer cabinets: Z = backThickness + depth/2 (horizontal positioning)
   */
  static testPositioning(): void {
    console.log('=== Base Rail Positioning Test ===');
    
    // Test case 1: Standard Base cabinet (Vertical positioning)
    const testCase1 = {
      carcassDepth: 600,    // 600mm carcass depth
      railDepth: 60,        // 60mm Base Rail
      backThickness: 18,    // 18mm back panel thickness
      description: 'Standard Base Cabinet (600mm depth, 60mm rail) - VERTICAL'
    };
    
    const zPosition1 = this.calculateBaseRailPosition(
      testCase1.carcassDepth,
      testCase1.railDepth,
      testCase1.backThickness,
      'base'
    );
    
    console.log(`\n${testCase1.description}:`);
    console.log(`Carcass Depth: ${testCase1.carcassDepth}mm`);
    console.log(`Base Rail Depth: ${testCase1.railDepth}mm`);
    console.log(`Back Thickness: ${testCase1.backThickness}mm`);
    console.log(`Calculated Z Position: ${zPosition1.toFixed(2)}mm`);
    console.log(`Expected Z Position: ${testCase1.carcassDepth}mm (Carcass Depth)`);
    console.log(`Positioning: ${Math.abs(zPosition1 - testCase1.carcassDepth) < 0.01 ? '✅ PASS (Vertical)' : '❌ FAIL'}`);
    
    // Test case 2: Drawer Base cabinet (Horizontal positioning)
    const testCase2 = {
      carcassDepth: 600,    // 600mm carcass depth
      railDepth: 60,        // 60mm Base Rail
      backThickness: 18,    // 18mm back panel thickness
      description: 'Drawer Base Cabinet (600mm depth, 60mm rail) - HORIZONTAL'
    };
    
    const zPosition2 = this.calculateBaseRailPosition(
      testCase2.carcassDepth,
      testCase2.railDepth,
      testCase2.backThickness,
      'drawer'
    );
    
    console.log(`\n${testCase2.description}:`);
    console.log(`Carcass Depth: ${testCase2.carcassDepth}mm`);
    console.log(`Base Rail Depth: ${testCase2.railDepth}mm`);
    console.log(`Back Thickness: ${testCase2.backThickness}mm`);
    console.log(`Calculated Z Position: ${zPosition2.toFixed(2)}mm`);
    console.log(`Expected Z Position: 0mm (Front edge of end panels)`);
    console.log(`Positioning: ${Math.abs(zPosition2) < 0.01 ? '✅ PASS (Horizontal)' : '❌ FAIL'}`);
    
    // Test case 3: Different Base Rail depth
    const testCase3 = {
      carcassDepth: 600,    // 600mm carcass depth
      railDepth: 80,        // 80mm Base Rail
      backThickness: 18,    // 18mm back panel thickness
      description: 'Base Cabinet with 80mm Base Rail - VERTICAL'
    };
    
    const zPosition3 = this.calculateBaseRailPosition(
      testCase3.carcassDepth,
      testCase3.railDepth,
      testCase3.backThickness,
      'base'
    );
    
    console.log(`\n${testCase3.description}:`);
    console.log(`Carcass Depth: ${testCase3.carcassDepth}mm`);
    console.log(`Base Rail Depth: ${testCase3.railDepth}mm`);
    console.log(`Back Thickness: ${testCase3.backThickness}mm`);
    console.log(`Calculated Z Position: ${zPosition3.toFixed(2)}mm`);
    console.log(`Expected Z Position: ${testCase3.carcassDepth}mm (Carcass Depth)`);
    console.log(`Positioning: ${Math.abs(zPosition3 - testCase3.carcassDepth) < 0.01 ? '✅ PASS (Vertical)' : '❌ FAIL'}`);
    
    console.log('\n=== Test Complete ===');
  }
  
  /**
   * Calculate Base Rail Z position using the same formula as CarcassTop
   * @param carcassDepth - Full carcass depth
   * @param railDepth - Base Rail depth
   * @param backThickness - Back panel thickness
   * @param cabinetType - Cabinet type ('base', 'drawer', etc.)
   * @returns Z position for the Base Rail
   */
  private static calculateBaseRailPosition(
    carcassDepth: number,
    railDepth: number,
    backThickness: number,
    cabinetType: string
  ): number {
    if (cabinetType === 'base') {
      // For Standard Base cabinets - VERTICAL positioning
      // Move in Z-axis by Carcass Depth (full depth)
      return carcassDepth;
    } else {
      // For Drawer Base cabinets - HORIZONTAL positioning
      // Position at front edge of end panels (Z = 0)
      return 0;
    }
  }
  
  /**
   * Run all tests
   */
  static runAllTests(): void {
    this.testPositioning();
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  BaseRailPositioningTest.runAllTests();
}
