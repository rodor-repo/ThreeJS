import type { FormulaPiece } from "@/types/formulaTypes"

export type ParsedPieceGroup = {
  cabinetLabel: string
  category: string
}

export const parsePieceGroup = (group: string): ParsedPieceGroup => {
  const separator = " - "
  const separatorIndex = group.lastIndexOf(separator)
  if (separatorIndex === -1) {
    return { cabinetLabel: group, category: "General" }
  }
  const cabinetLabel = group.slice(0, separatorIndex).trim() || group
  const category = group.slice(separatorIndex + separator.length).trim() || "General"
  return { cabinetLabel, category }
}

export const getCabinetIdFromToken = (token: string): string | null => {
  const cabMatch = token.match(/cab\("([^"]+)"/)
  if (cabMatch) return cabMatch[1]
  const dimMatch = token.match(/dim\("([^"]+)"/)
  if (dimMatch) return dimMatch[1]
  return null
}

export type CabinetPieceBucket = {
  id: string
  label: string
  categories: Map<string, FormulaPiece[]>
  totalCount: number
}

export const buildCabinetBuckets = (
  pieces: FormulaPiece[]
): CabinetPieceBucket[] => {
  const buckets = new Map<string, CabinetPieceBucket>()

  pieces.forEach((piece) => {
    const { cabinetLabel, category } = parsePieceGroup(piece.group)
    const cabinetId = getCabinetIdFromToken(piece.token) || cabinetLabel
    const key = cabinetId

    const existing = buckets.get(key) || {
      id: key,
      label: cabinetLabel,
      categories: new Map<string, FormulaPiece[]>(),
      totalCount: 0,
    }

    const list = existing.categories.get(category) || []
    list.push(piece)
    existing.categories.set(category, list)
    existing.totalCount += 1
    buckets.set(key, existing)
  })

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => {
    const aMatch = a.label.match(/\d+/)
    const bMatch = b.label.match(/\d+/)
    const aHasNumber = Boolean(aMatch)
    const bHasNumber = Boolean(bMatch)
    if (aHasNumber && bHasNumber) {
      const aNum = Number.parseInt(aMatch?.[0] || "0", 10)
      const bNum = Number.parseInt(bMatch?.[0] || "0", 10)
      if (aNum !== bNum) return aNum - bNum
    }
    if (aHasNumber !== bHasNumber) {
      return aHasNumber ? -1 : 1
    }
    return a.label.localeCompare(b.label)
  })

  sortedBuckets.forEach((bucket) => {
    bucket.categories.forEach((list, category) => {
      const sortedList = [...list].sort((a, b) => a.label.localeCompare(b.label))
      bucket.categories.set(category, sortedList)
    })
  })

  return sortedBuckets
}
