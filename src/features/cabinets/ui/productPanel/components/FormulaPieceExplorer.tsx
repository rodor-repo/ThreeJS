import React, { useEffect, useMemo, useState } from "react"
import type { FormulaPiece } from "@/types/formulaTypes"
import { buildCabinetBuckets } from "./formulaPieceUtils"

type FormulaPieceExplorerProps = {
  pieces: FormulaPiece[]
  defaultCabinetId?: string
  onInsert: (token: string) => void
}

type CategoryTile = {
  id: string
  label: string
  count: number
  description: string
}

type CabinetTileMeta = {
  numberLabel: string
  subtitle: string
}

const CATEGORY_ORDER = ["Geometry", "Dimensions", "Appliance", "General"]

const CATEGORY_DETAILS: Record<string, { description: string }> = {
  Geometry: {
    description: "Position, edges, and carcass sizes.",
  },
  Dimensions: {
    description: "Product dimension values from the catalog.",
  },
  Appliance: {
    description: "Appliance visuals and gap offsets.",
  },
  General: {
    description: "Shared or uncategorized puzzle pieces.",
  },
}

const getCategoryIndex = (category: string) => {
  const index = CATEGORY_ORDER.indexOf(category)
  return index === -1 ? CATEGORY_ORDER.length : index
}

const getCategoryDetails = (category: string) =>
  CATEGORY_DETAILS[category] || { description: "Pieces grouped for this cabinet." }

const getCabinetTileMeta = (label: string): CabinetTileMeta => {
  const numberMatch = label.match(/\d+/)
  const numberLabel = numberMatch ? numberMatch[0] : "?"
  const cleaned = label.replace(/#/g, "")
  const withoutNumber = numberMatch
    ? cleaned.replace(numberMatch[0], "")
    : cleaned
  const subtitle = withoutNumber.replace(/-+/g, " ").trim()
  return {
    numberLabel,
    subtitle: subtitle || label,
  }
}

export const FormulaPieceExplorer: React.FC<FormulaPieceExplorerProps> = ({
  pieces,
  defaultCabinetId,
  onInsert,
}) => {
  const cabinetBuckets = useMemo(() => buildCabinetBuckets(pieces), [pieces])
  const [selectedCabinetId, setSelectedCabinetId] = useState(
    defaultCabinetId || cabinetBuckets[0]?.id || ""
  )
  const [cabinetFilter, setCabinetFilter] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [pieceFilter, setPieceFilter] = useState("")

  useEffect(() => {
    if (!cabinetBuckets.length) return
    const hasSelected = selectedCabinetId
      ? cabinetBuckets.some((bucket) => bucket.id === selectedCabinetId)
      : false
    if (hasSelected) return
    const hasDefault = defaultCabinetId
      ? cabinetBuckets.some((bucket) => bucket.id === defaultCabinetId)
      : false
    const nextSelection = hasDefault
      ? defaultCabinetId || cabinetBuckets[0].id
      : cabinetBuckets[0].id
    if (nextSelection) {
      setSelectedCabinetId(nextSelection)
    }
  }, [cabinetBuckets, defaultCabinetId, selectedCabinetId])

  useEffect(() => {
    setActiveCategory(null)
    setPieceFilter("")
  }, [selectedCabinetId])

  useEffect(() => {
    setPieceFilter("")
  }, [activeCategory])

  const activeBucket = useMemo(
    () => cabinetBuckets.find((bucket) => bucket.id === selectedCabinetId),
    [cabinetBuckets, selectedCabinetId]
  )

  const filteredCabinets = useMemo(() => {
    const query = cabinetFilter.trim().toLowerCase()
    if (!query) return cabinetBuckets
    return cabinetBuckets.filter((bucket) =>
      bucket.label.toLowerCase().includes(query)
    )
  }, [cabinetBuckets, cabinetFilter])

  const categoryEntries = useMemo(() => {
    if (!activeBucket) return []
    return Array.from(activeBucket.categories.entries()).sort((a, b) => {
      const orderDiff = getCategoryIndex(a[0]) - getCategoryIndex(b[0])
      if (orderDiff !== 0) return orderDiff
      return a[0].localeCompare(b[0])
    })
  }, [activeBucket])

  useEffect(() => {
    if (!activeBucket) return
    const categories = Array.from(activeBucket.categories.keys())
    if (!categories.length) {
      setActiveCategory(null)
      return
    }
    if (activeCategory && categories.includes(activeCategory)) return
    if (categories.length === 1) {
      setActiveCategory(categories[0])
      return
    }
    setActiveCategory(null)
  }, [activeBucket, activeCategory])

  const categoryTiles = useMemo<CategoryTile[]>(
    () =>
      categoryEntries.map(([category, list]) => {
        const details = getCategoryDetails(category)
        return {
          id: category,
          label: category,
          count: list.length,
          description: details.description,
        }
      }),
    [categoryEntries]
  )

  const activeCategoryList = useMemo(() => {
    if (!activeBucket || !activeCategory) return []
    return activeBucket.categories.get(activeCategory) || []
  }, [activeBucket, activeCategory])

  const filteredPieces = useMemo(() => {
    if (!activeCategory) return []
    const query = pieceFilter.trim().toLowerCase()
    if (!query) return activeCategoryList
    return activeCategoryList.filter((piece) => {
      const label = piece.label.toLowerCase()
      const token = piece.token.toLowerCase()
      return label.includes(query) || token.includes(query)
    })
  }, [activeCategory, activeCategoryList, pieceFilter])

  if (!cabinetBuckets.length) {
    return (
      <div className="text-xs text-gray-400 py-6 text-center">
        No puzzle pieces available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Step 1 - Cabinet
          </div>
          <div className="text-[10px] text-gray-400">
            {cabinetBuckets.length} cabinets
          </div>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={cabinetFilter}
            onChange={(event) => setCabinetFilter(event.target.value)}
            placeholder="Search cabinets..."
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          />
        </div>
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-white custom-scrollbar p-2">
          {filteredCabinets.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-gray-400">
              No cabinets match that search.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredCabinets.map((bucket) => {
                const isActive = bucket.id === selectedCabinetId
                const meta = getCabinetTileMeta(bucket.label)
                return (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => {
                      setSelectedCabinetId(bucket.id)
                      setCabinetFilter("")
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "border-yellow-400 bg-yellow-50 text-gray-900"
                        : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="text-[18px] font-bold leading-none">
                      {meta.numberLabel}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {meta.subtitle}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {activeBucket && (
          <div className="mt-2 text-[10px] text-gray-400">
            Selected: <span className="font-semibold text-gray-600">{activeBucket.label}</span> -{" "}
            {activeBucket.totalCount} pieces
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Step 2 - Piece type
          </div>
          <div className="text-[10px] text-gray-400">
            {categoryTiles.length} types
          </div>
        </div>
        {categoryTiles.length === 0 ? (
          <div className="mt-3 text-[11px] text-gray-400">
            No categories available for this cabinet.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {categoryTiles.map((tile) => {
              const isActive = tile.id === activeCategory
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setActiveCategory(tile.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-[12px] font-semibold text-gray-800">
                    {tile.label}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {tile.description}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {tile.count} pieces
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Step 3 - Pick a piece
          </div>
          <div className="text-[10px] text-gray-400">
            {activeCategory ? activeCategory : "Select a type"}
          </div>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={pieceFilter}
            onChange={(event) => setPieceFilter(event.target.value)}
            placeholder={
              activeCategory
                ? `Search ${activeCategory.toLowerCase()} pieces...`
                : "Choose a type to search"
            }
            disabled={!activeCategory}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-gray-100 bg-white custom-scrollbar">
          {!activeCategory ? (
            <div className="px-3 py-6 text-center text-[11px] text-gray-400">
              Pick a piece type to see the options.
            </div>
          ) : filteredPieces.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-gray-400">
              No pieces match that filter.
            </div>
          ) : (
            <div className="p-2 grid grid-cols-2 gap-2">
              {filteredPieces.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left text-[12px] font-semibold text-gray-800 hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                  onClick={() => onInsert(piece.token)}
                >
                  <div className="truncate">{piece.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
