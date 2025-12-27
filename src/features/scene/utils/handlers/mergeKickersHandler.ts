import { CabinetData, CabinetType } from "../../types"
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

interface MergeKickersParams {
  selectedKickers: CabinetData[]
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
 * Analyzes selected kickers for differences and generates warnings
 */
export function analyzeKickersForMerge(
  selectedKickers: CabinetData[]
): MergeWarning[] {
  const warnings: MergeWarning[] = []

  if (selectedKickers.length < 2) return warnings

  // Get heights (Y axis size) and Z positions
  const kickerData = selectedKickers.map((k) => ({
    cabinet: k,
    number: getCabinetNumber(k),
    height: k.carcass.dimensions.height,
    zPosition: k.group.position.z,
    depth: k.carcass.dimensions.depth,
  }))

  // 1. Check for different heights (Y axis size)
  const heights = kickerData.map((d) => d.height)
  const minHeight = Math.min(...heights)
  const maxHeight = Math.max(...heights)

  if (Math.abs(maxHeight - minHeight) > 0.5) {
    const tallestKickers = kickerData
      .filter((d) => Math.abs(d.height - maxHeight) < 0.5)
      .map((d) => d.number)

    warnings.push({
      type: "height",
      message: `Alert: The Kicker height will be according to the tallest Kicker (${tallestKickers.join(", ")}). Are you sure to proceed?`,
      cabinetNumbers: tallestKickers,
    })
  }

  // 2. Check for different Z positions (set back)
  const zPositions = kickerData.map((d) => d.zPosition)
  const minZ = Math.min(...zPositions)
  const maxZ = Math.max(...zPositions)

  if (Math.abs(maxZ - minZ) > 0.5) {
    // Find the outermost kicker (furthest from back wall = highest Z + depth)
    const kickerFronts = kickerData.map((d) => ({
      ...d,
      frontZ: d.zPosition + d.depth,
    }))
    const maxFrontZ = Math.max(...kickerFronts.map((k) => k.frontZ))
    const outermostKickers = kickerFronts
      .filter((d) => Math.abs(d.frontZ - maxFrontZ) < 0.5)
      .map((d) => d.number)

    warnings.push({
      type: "depth",
      message: `Alert: Kicker set backs are not matching. We will merge the Kickers based on the outer Kicker (${outermostKickers.join(", ")}). Do you want to proceed?`,
      cabinetNumbers: outermostKickers,
    })
  }

  return warnings
}

/**
 * Merges multiple kickers into a single independent kicker.
 * 
 * The new kicker will:
 * - Start at the lowest X value from all selected kickers
 * - Extend to the highest X value from all selected kickers
 * - Use the tallest height
 * - Use the outermost Z position
 * - Be an independent kicker (no parent cabinet)
 */
export const mergeKickers = (params: MergeKickersParams): CabinetData | null => {
  const { selectedKickers, createCabinet, deleteCabinet } = params

  if (selectedKickers.length < 2) {
    console.warn("Need at least 2 kickers to merge")
    return null
  }

  // Verify all selected cabinets are kickers
  const allAreKickers = selectedKickers.every(c => c.cabinetType === "kicker")
  if (!allAreKickers) {
    console.warn("All selected cabinets must be kickers")
    return null
  }

  // Find the reference kicker (leftmost = lowest X)
  let referenceKicker = selectedKickers[0]
  selectedKickers.forEach(kicker => {
    if (kicker.group.position.x < referenceKicker.group.position.x) {
      referenceKicker = kicker
    }
  })

  // Calculate bounding box from all selected kickers
  let minX = Infinity
  let maxX = -Infinity
  let maxHeight = 0
  let minZ = Infinity
  let maxFrontZ = -Infinity

  selectedKickers.forEach(kicker => {
    const pos = kicker.group.position
    const dims = kicker.carcass.dimensions

    // Calculate kicker bounds
    const leftX = pos.x
    const rightX = pos.x + dims.width
    const frontZ = pos.z + dims.depth

    // Update min/max values
    if (leftX < minX) minX = leftX
    if (rightX > maxX) maxX = rightX
    if (dims.height > maxHeight) maxHeight = dims.height
    if (pos.z < minZ) minZ = pos.z
    if (frontZ > maxFrontZ) maxFrontZ = frontZ
  })

  // Calculate merged dimensions
  const mergedWidth = maxX - minX
  const mergedDepth = maxFrontZ - minZ

  // Use the reference kicker's (leftmost) product info and Y position
  const referenceY = referenceKicker.group.position.y
  const productId = referenceKicker.productId || ""
  const subcategoryId = referenceKicker.subcategoryId || ""

  // Delete all selected kickers
  selectedKickers.forEach(kicker => {
    kicker.carcass?.dispose()
    deleteCabinet(kicker.cabinetId)
  })

  // Create new merged independent kicker
  const mergedKicker = createCabinet("kicker", subcategoryId, {
    productId,
    customDimensions: {
      width: mergedWidth,
      height: maxHeight,
      depth: mergedDepth,
    },
    additionalProps: {
      // No parent - this is an independent kicker
      hideLockIcons: false,
      leftLock: true,
      rightLock: false,
    },
  })

  if (!mergedKicker) {
    console.error("Failed to create merged kicker")
    return null
  }

  // Position the merged kicker at the reference kicker's X and Y, with minimum Z
  mergedKicker.group.position.set(minX, referenceY, minZ)

  return mergedKicker
}

/**
 * Checks if the selection contains 2 or more kickers
 */
export const canMergeKickers = (selectedCabinets: CabinetData[]): boolean => {
  const kickers = selectedCabinets.filter(c => c.cabinetType === "kicker")
  return kickers.length >= 2
}

/**
 * Gets only the kickers from a selection
 */
export const getSelectedKickers = (selectedCabinets: CabinetData[]): CabinetData[] => {
  return selectedCabinets.filter(c => c.cabinetType === "kicker")
}

