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

export type CabinetType = "base" | "top" | "tall" | "panel" | "filler"

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
}
