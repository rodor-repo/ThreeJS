import type { CarcassAssembly } from "../CarcassAssembly"

export interface PartDimension {
  partName: string
  dimX: number // X dimension (width/thickness)
  dimY: number // Y dimension (height)
  dimZ: number // Z dimension (depth/thickness)
}

export interface CabinetBuilder {
  /**
   * Build the initial carcass structure
   */
  build(assembly: CarcassAssembly): void

  /**
   * Update the dimensions of existing carcass parts
   */
  updateDimensions(assembly: CarcassAssembly): void

  /**
   * Get dimensions of all parts for export/nesting
   */
  getPartDimensions(assembly: CarcassAssembly): PartDimension[]
}

