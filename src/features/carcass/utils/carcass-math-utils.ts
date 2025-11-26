/**
 * Rounds a number to a specified number of decimal places
 * Default: 1 decimal place for dimensions in millimeters
 */
export function roundToDecimal(value: number, decimals: number = 1): number {
  const multiplier = Math.pow(10, decimals)
  return Math.round(value * multiplier) / multiplier
}

/**
 * Distributes a total height equally among a count of items
 * Returns an array of equal heights rounded to 1 decimal place
 */
export function distributeHeightEqually(
  totalHeight: number,
  count: number
): number[] {
  if (count <= 0) {
    return []
  }

  const heightPerItem = roundToDecimal(totalHeight / count)
  return Array(count).fill(heightPerItem)
}

/**
 * Validates that total height of an array doesn't exceed max height
 */
export function validateTotalHeight(
  heights: number[],
  maxHeight: number,
  tolerance: number = 0.1
): {
  isValid: boolean
  totalHeight: number
  remainingHeight: number
} {
  const totalHeight = heights.reduce((sum, height) => sum + height, 0)
  const remainingHeight = maxHeight - totalHeight
  const isValid = totalHeight <= maxHeight + tolerance

  return { isValid, totalHeight, remainingHeight }
}

/**
 * Calculates proportional scaling of heights based on a new total
 * Useful when cabinet height changes and drawer heights need to scale
 */
export function scaleHeightsProportionally(
  heights: number[],
  newTotalHeight: number
): number[] {
  const currentTotal = heights.reduce((sum, h) => sum + h, 0)
  if (currentTotal === 0) return heights

  const ratio = newTotalHeight / currentTotal
  return heights.map((height) => roundToDecimal(height * ratio))
}

/**
 * Redistributes remaining height among specified indices
 * Used when one drawer height changes and others need adjustment
 */
export function redistributeRemainingHeight(
  heights: number[],
  unchangedIndices: number[],
  remainingHeight: number
): number[] {
  if (unchangedIndices.length === 0 || remainingHeight <= 0) {
    return heights
  }

  const heightPerIndex = roundToDecimal(remainingHeight / unchangedIndices.length)
  const newHeights = [...heights]

  unchangedIndices.forEach((index) => {
    newHeights[index] = heightPerIndex
  })

  return newHeights
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Checks if two numbers are approximately equal within a tolerance
 */
export function approximatelyEqual(
  a: number,
  b: number,
  tolerance: number = 0.01
): boolean {
  return Math.abs(a - b) <= tolerance
}

/**
 * Calculates the ratio between two values
 * Returns 1 if denominator is 0 to avoid division by zero
 */
export function calculateRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator
}
