/**
 * Shared utility functions used across cabinet dimension handlers
 */

/**
 * Helper function to check if two cabinets are paired
 * Checks bidirectionally in the cabinetGroups map
 */
export function areCabinetsPaired(
  cabinetId1: string,
  cabinetId2: string,
  cabinetGroups: Map<string, Array<{ cabinetId: string; percentage: number }>>
): boolean {
  // Check if cabinetId2 is in cabinetId1's group
  const group1 = cabinetGroups.get(cabinetId1)
  if (group1 && group1.some((c) => c.cabinetId === cabinetId2)) {
    return true
  }
  // Check if cabinetId1 is in cabinetId2's group
  const group2 = cabinetGroups.get(cabinetId2)
  if (group2 && group2.some((c) => c.cabinetId === cabinetId1)) {
    return true
  }
  return false
}

/**
 * Clamps a cabinet's X position to ensure it stays within the left wall boundary
 * Right wall can be penetrated (handled by auto-adjust)
 */
export function clampPositionX(x: number): number {
  return Math.max(0, x)
}

