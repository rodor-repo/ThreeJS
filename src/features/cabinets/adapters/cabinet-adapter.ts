import {
  CarcassAssembly,
  CarcassDimensions,
  CarcassMaterial,
  DoorMaterial,
} from "@/features/carcass"

export const applyDimensions = (c: CarcassAssembly, dims: CarcassDimensions) =>
  c.updateDimensions(dims)
export const applyMaterialProps = (
  c: CarcassAssembly,
  changes: Partial<Parameters<CarcassMaterial["updateMaterial"]>[0]>
) => c.updateMaterialProperties(changes)
export const applyKicker = (c: CarcassAssembly, height: number) =>
  c.updateKickerHeight(height)
export const toggleDoors = (c: CarcassAssembly, enabled: boolean) =>
  c.toggleDoors(enabled)
export const setDoorMaterial = (c: CarcassAssembly, m: DoorMaterial) =>
  c.updateDoorMaterial(m)
export const setDoorCount = (c: CarcassAssembly, count: number) =>
  c.updateDoorConfiguration(count)
export const setOverhang = (c: CarcassAssembly, overhang: boolean) =>
  c.updateOverhangDoor(overhang)
export const toggleDrawers = (c: CarcassAssembly, enabled: boolean) =>
  c.updateDrawerEnabled(enabled)
export const setDrawerQty = (c: CarcassAssembly, qty: number) =>
  c.updateDrawerQuantity(qty)
export const setDrawerHeight = (
  c: CarcassAssembly,
  index: number,
  height: number
) => c.updateDrawerHeight(index, height)
export const balanceDrawerHeights = (c: CarcassAssembly) =>
  c.balanceDrawerHeights()
export const resetDrawerHeights = (c: CarcassAssembly) => {
  const heights = c.getDrawerHeights()
  c.config.drawerHeights = [...heights]
  const qty = c.config.drawerQuantity || heights.length
  c.updateDrawerQuantity(qty)
}
