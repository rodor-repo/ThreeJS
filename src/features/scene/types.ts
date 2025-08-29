import * as THREE from "three"
import { CarcassAssembly } from "@/features/carcass"

export type WallDimensions = {
  height: number
  length: number
}

export type Category = {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

export type CabinetData = {
  group: THREE.Group
  carcass: CarcassAssembly
  cabinetType: "base" | "top" | "tall"
  subcategoryId: string
}
