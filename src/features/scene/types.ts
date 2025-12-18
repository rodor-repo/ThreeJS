import * as THREE from "three"
import { CarcassAssembly } from "@/features/carcass"

export type WallDimensions = {
  height: number
  length: number // Back wall length (for backward compatibility)
  // Back wall length (renamed from length for clarity)
  backWallLength?: number
  // Left and right wall settings
  leftWallLength?: number
  rightWallLength?: number
  leftWallVisible?: boolean
  rightWallVisible?: boolean
  // Right wall view association
  rightWallViewId?: string // ViewId for right wall positioning
  // Additional walls (perpendicular to back wall, in Z-axis)
  additionalWalls?: Array<{
    id: string
    length: number
    distanceFromLeft: number // Distance from origin (X=0) in X direction
    thickness?: number // Wall thickness (defaults to back wall thickness)
    viewId?: string // ViewId for internal wall positioning
  }>
}

export type Category = {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

export type CabinetType =
  | "base"
  | "top"
  | "tall"
  | "panel"
  | "filler"
  | "wardrobe"
  | "kicker"
  | "bulkhead"
  | "benchtop"
  | "underPanel"
  | "appliance"

export type CabinetData = {
  group: THREE.Group
  carcass: CarcassAssembly
  cabinetType: CabinetType
  subcategoryId: string
  /** Optional webshop productId associated with this 3D object */
  productId?: string
  cabinetId: string
  /** View ID this cabinet belongs to (A, B, C, etc.) or undefined for no view */
  viewId?: string
  /** Lock states for width resizing */
  leftLock?: boolean // When locked, left edge is frozen - cabinet can only extend to the right
  rightLock?: boolean // When locked, right edge is frozen - cabinet can only extend to the left
  /** Sort number based on order cabinets were added to the scene */
  sortNumber?: number
  /** Flag to hide lock icons - used for fillers/panels added from modal */
  hideLockIcons?: boolean
  /** Parent cabinet ID - used for fillers/panels added from modal to track parent-child relationship */
  parentCabinetId?: string
  /** Side relative to parent ('left' | 'right') - used for fillers/panels added from modal */
  parentSide?: "left" | "right"
  /** For kicker type: parent cabinet ID that this kicker belongs to */
  kickerParentCabinetId?: string
  /** For bulkhead type: parent cabinet ID that this bulkhead belongs to */
  bulkheadParentCabinetId?: string
  /** For underPanel type: parent cabinet ID that this under panel belongs to */
  underPanelParentCabinetId?: string
  /** For benchtop type: parent cabinet ID that this benchtop belongs to */
  benchtopParentCabinetId?: string
  /** Benchtop overhangs - only for child benchtops */
  benchtopFrontOverhang?: number  // Extends depth toward +Z, default 20mm
  benchtopLeftOverhang?: number   // Extends from left edge toward -X, default 0
  benchtopRightOverhang?: number  // Extends from right edge toward +X, default 0
  /** Benchtop height from floor - only for independent benchtops (Y position) */
  benchtopHeightFromFloor?: number  // Default 740mm, min 0, max 1200mm
}
