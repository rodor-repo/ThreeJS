import { CabinetData, CabinetType } from "../../types"
import { DEFAULT_BENCHTOP_THICKNESS } from "@/features/carcass/builders/builder-constants"
import type { MergeWarning } from "../../ui/MergeBenchtopsModal"

type CreateCabinetFn = (
  cabinetType: CabinetType,
  subcategoryId: string,
  options: {
    productId: string
    customDimensions?: {
      width?: number
      height?: number
      depth?: number
    }
    additionalProps?: Record<string, unknown>
  }
) => CabinetData | null | undefined

interface MergeBenchtopsParams {
  selectedBenchtops: CabinetData[]
  createCabinet: CreateCabinetFn
  deleteCabinet: (id: string) => void
}

/**
 * Gets cabinet number for display (based on sortNumber or cabinetId)
 */
function getCabinetNumber(cabinet: CabinetData): string {
  if (cabinet.sortNumber !== undefined) {
    return `#${cabinet.sortNumber}`
  }
  // Extract number from cabinetId if available
  const match = cabinet.cabinetId.match(/\d+/)
  return match ? `#${match[0]}` : cabinet.cabinetId
}

/**
 * Analyzes selected benchtops for differences and generates warnings
 */
export function analyzeBenchtopsForMerge(
  selectedBenchtops: CabinetData[]
): MergeWarning[] {
  const warnings: MergeWarning[] = []

  if (selectedBenchtops.length < 2) return warnings

  // Get Y positions (height from floor), depths, thicknesses, and materials
  const benchtopData = selectedBenchtops.map((b) => ({
    cabinet: b,
    number: getCabinetNumber(b),
    yPosition: b.group.position.y,
    depth: b.carcass.dimensions.depth,
    thickness: b.carcass.dimensions.height, // Height is thickness for benchtops
    material: b.carcass?.config?.material,
    materialName: b.carcass?.config?.material?.getColour?.() || "Unknown",
  }))

  // 1. Check for different Y positions (height from floor)
  const yPositions = benchtopData.map((d) => d.yPosition)
  const minY = Math.min(...yPositions)
  const maxY = Math.max(...yPositions)
  
  if (Math.abs(maxY - minY) > 0.5) {
    // Find benchtops that are higher/lower
    const highestBenchtops = benchtopData
      .filter((d) => Math.abs(d.yPosition - maxY) < 0.5)
      .map((d) => d.number)
    const lowestBenchtops = benchtopData
      .filter((d) => Math.abs(d.yPosition - minY) < 0.5)
      .map((d) => d.number)

    if (highestBenchtops.length < lowestBenchtops.length) {
      warnings.push({
        type: "height",
        message: `Alert: Your Cabinet(s) ${highestBenchtops.join(", ")} is taller than others. Do you want to proceed with Merge?`,
        cabinetNumbers: highestBenchtops,
      })
    } else {
      warnings.push({
        type: "height",
        message: `Alert: Your Cabinet(s) ${lowestBenchtops.join(", ")} is shorter than others. Do you want to proceed with Merge?`,
        cabinetNumbers: lowestBenchtops,
      })
    }
  }

  // 2. Check for different depths
  const depths = benchtopData.map((d) => d.depth)
  const minDepth = Math.min(...depths)
  const maxDepth = Math.max(...depths)

  if (Math.abs(maxDepth - minDepth) > 0.5) {
    const deeperBenchtops = benchtopData
      .filter((d) => Math.abs(d.depth - maxDepth) < 0.5)
      .map((d) => d.number)

    warnings.push({
      type: "depth",
      message: `Alert: Your Cabinet(s) ${deeperBenchtops.join(", ")} has deeper Benchtop. Do you want to proceed with Merge? It will extend all other Benchtop Depth.`,
      cabinetNumbers: deeperBenchtops,
    })
  }

  // 3. Check for different thicknesses
  const thicknesses = benchtopData.map((d) => d.thickness)
  const minThickness = Math.min(...thicknesses)
  const maxThickness = Math.max(...thicknesses)

  if (Math.abs(maxThickness - minThickness) > 0.5) {
    const thickestBenchtops = benchtopData
      .filter((d) => Math.abs(d.thickness - maxThickness) < 0.5)
      .map((d) => d.number)

    warnings.push({
      type: "thickness",
      message: `Alert: Your Cabinet(s) ${thickestBenchtops.join(", ")} has different Thickness to others. Merging will increase all other thickness to the highest Thickness. Do you confirm?`,
      cabinetNumbers: thickestBenchtops,
    })
  }

  // 4. Check for different materials
  const uniqueMaterials = new Set(benchtopData.map((d) => d.materialName))
  
  if (uniqueMaterials.size > 1) {
    // Find the benchtop with lowest sort number to use as reference material
    const sortedBenchtops = [...benchtopData].sort((a, b) => {
      const numA = parseInt(a.number.replace("#", "")) || 0
      const numB = parseInt(b.number.replace("#", "")) || 0
      return numA - numB
    })
    
    const lowestNumberBenchtop = sortedBenchtops[0]
    
    warnings.push({
      type: "material",
      message: `Alert: Your Cabinet ${lowestNumberBenchtop.number} material is "${lowestNumberBenchtop.materialName}". By proceeding with Merge, all Benchtop materials will be changed to this material.`,
      cabinetNumbers: [lowestNumberBenchtop.number],
    })
  }

  return warnings
}

/**
 * Merges multiple benchtops into a single independent benchtop.
 * 
 * The new benchtop will:
 * - Start at the lowest X, Y, Z values from all selected benchtops
 * - Extend to the highest X, Y, Z values from all selected benchtops
 * - Be an independent benchtop (no parent cabinet)
 */
export const mergeBenchtops = (params: MergeBenchtopsParams): CabinetData | null => {
  const { selectedBenchtops, createCabinet, deleteCabinet } = params

  if (selectedBenchtops.length < 2) {
    console.warn("Need at least 2 benchtops to merge")
    return null
  }

  // Verify all selected cabinets are benchtops
  const allAreBenchtops = selectedBenchtops.every(c => c.cabinetType === "benchtop")
  if (!allAreBenchtops) {
    console.warn("All selected cabinets must be benchtops")
    return null
  }

  // Calculate bounding box from all selected benchtops
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  selectedBenchtops.forEach(benchtop => {
    const pos = benchtop.group.position
    const dims = benchtop.carcass.dimensions

    // Calculate benchtop bounds
    const leftX = pos.x
    const rightX = pos.x + dims.width
    const bottomY = pos.y
    const topY = pos.y + dims.height
    const backZ = pos.z
    const frontZ = pos.z + dims.depth

    // Update min/max values
    if (leftX < minX) minX = leftX
    if (rightX > maxX) maxX = rightX
    if (bottomY < minY) minY = bottomY
    if (topY > maxY) maxY = topY
    if (backZ < minZ) minZ = backZ
    if (frontZ > maxZ) maxZ = frontZ
  })

  // Calculate merged dimensions
  const mergedWidth = maxX - minX
  const mergedHeight = maxY - minY // This is the thickness
  const mergedDepth = maxZ - minZ

  // Use the first benchtop's product info for the new one
  const firstBenchtop = selectedBenchtops[0]
  const productId = firstBenchtop.productId || ""
  const subcategoryId = firstBenchtop.subcategoryId || ""

  // Delete all selected benchtops
  selectedBenchtops.forEach(benchtop => {
    benchtop.carcass?.dispose()
    deleteCabinet(benchtop.cabinetId)
  })

  // Create new merged independent benchtop
  const mergedBenchtop = createCabinet("benchtop", subcategoryId, {
    productId,
    customDimensions: {
      width: mergedWidth,
      height: mergedHeight > 0 ? mergedHeight : DEFAULT_BENCHTOP_THICKNESS,
      depth: mergedDepth,
    },
    additionalProps: {
      // No parent - this is an independent benchtop
      hideLockIcons: false,
      leftLock: true,
      rightLock: false,
      benchtopHeightFromFloor: minY,
    },
  })

  if (!mergedBenchtop) {
    console.error("Failed to create merged benchtop")
    return null
  }

  // Position the merged benchtop at the minimum X, Y, Z
  mergedBenchtop.group.position.set(minX, minY, minZ)

  return mergedBenchtop
}

/**
 * Checks if the selection contains 2 or more benchtops
 */
export const canMergeBenchtops = (selectedCabinets: CabinetData[]): boolean => {
  const benchtops = selectedCabinets.filter(c => c.cabinetType === "benchtop")
  return benchtops.length >= 2
}

/**
 * Gets only the benchtops from a selection
 */
export const getSelectedBenchtops = (selectedCabinets: CabinetData[]): CabinetData[] => {
  return selectedCabinets.filter(c => c.cabinetType === "benchtop")
}

