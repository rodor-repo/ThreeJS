import React, { useEffect, useMemo, useState } from "react"
import type { FormulaPiece } from "@/types/formulaTypes"
import { buildCabinetBuckets } from "./formulaPieceUtils"

type FormulaPieceExplorerProps = {
  pieces: FormulaPiece[]
  defaultCabinetId?: string
  onInsert: (token: string) => void
}

const CATEGORY_ORDER = ["Geometry", "Dimensions", "Appliance", "General"]

const getCategoryIndex = (category: string) => {
  const index = CATEGORY_ORDER.indexOf(category)
  return index === -1 ? CATEGORY_ORDER.length : index
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
  const [activeCategory, setActiveCategory] = useState("All")

  useEffect(() => {
    if (!cabinetBuckets.length) return
    const hasDefault = defaultCabinetId
      ? cabinetBuckets.some((bucket) => bucket.id === defaultCabinetId)
      : false
    const nextSelection = hasDefault
      ? defaultCabinetId || cabinetBuckets[0].id
      : cabinetBuckets[0].id
    if (nextSelection && nextSelection !== selectedCabinetId) {
      setSelectedCabinetId(nextSelection)
    }
  }, [cabinetBuckets, defaultCabinetId, selectedCabinetId])

  useEffect(() => {
    setActiveCategory("All")
  }, [selectedCabinetId])

  const activeBucket = useMemo(
    () => cabinetBuckets.find((bucket) => bucket.id === selectedCabinetId),
    [cabinetBuckets, selectedCabinetId]
  )

  const categoryEntries = useMemo(() => {
    if (!activeBucket) return []
    return Array.from(activeBucket.categories.entries()).sort((a, b) => {
      const orderDiff = getCategoryIndex(a[0]) - getCategoryIndex(b[0])
      if (orderDiff !== 0) return orderDiff
      return a[0].localeCompare(b[0])
    })
  }, [activeBucket])

  const activeCategoryList = useMemo(() => {
    if (!activeBucket) return []
    if (activeCategory === "All") {
      return categoryEntries.reduce<FormulaPiece[]>((acc, [, list]) => {
        acc.push(...list)
        return acc
      }, [])
    }
    return activeBucket.categories.get(activeCategory) || []
  }, [activeBucket, activeCategory, categoryEntries])

  const totalCount = activeBucket?.totalCount ?? 0

  const categoryChips = useMemo(() => {
    const chips = [
      {
        id: "All",
        label: `All (${totalCount})`,
      },
    ]

    categoryEntries.forEach(([category, list]) => {
      chips.push({
        id: category,
        label: `${category} (${list.length})`,
      })
    })

    return chips
  }, [categoryEntries, totalCount])

  if (!cabinetBuckets.length) {
    return (
      <div className="text-xs text-gray-400 py-6 text-center">
        No puzzle pieces available.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Cabinet focus
        </div>
        <div className="text-[10px] text-gray-400">
          {cabinetBuckets.length} cabinets
        </div>
      </div>

      <div className="max-h-28 overflow-y-auto rounded-xl border border-gray-100 bg-white custom-scrollbar">
        {cabinetBuckets.map((bucket) => {
          const isActive = bucket.id === selectedCabinetId
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => setSelectedCabinetId(bucket.id)}
              className={`w-full px-3 py-2 text-left border-b border-gray-100 last:border-b-0 transition-colors ${isActive
                ? "bg-gray-900 text-white"
                : "hover:bg-gray-50 text-gray-700"
                }`}
            >
              <div className="text-[12px] font-semibold truncate">
                {bucket.label}
              </div>
              <div className={`text-[10px] ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                {bucket.totalCount} pieces
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {categoryChips.map((chip) => {
          const isActive = chip.id === activeCategory
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveCategory(chip.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${isActive
                ? "bg-yellow-500 text-gray-900 border-yellow-400"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="max-h-[260px] overflow-y-auto rounded-xl border border-gray-100 bg-white custom-scrollbar">
        {activeCategory === "All" ? (
          categoryEntries.map(([category, list]) => (
            <div key={category} className="border-b border-gray-100 last:border-b-0">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 border-b border-gray-100">
                {category}
              </div>
              <div className="p-3 space-y-2">
                {list.map((piece) => (
                  <div key={piece.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-gray-800 truncate">
                        {piece.label}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {piece.token}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-yellow-700 hover:text-yellow-800"
                      onClick={() => onInsert(piece.token)}
                    >
                      Insert
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="p-3 space-y-2">
            {activeCategoryList.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">
                No pieces in this category.
              </div>
            ) : (
              activeCategoryList.map((piece) => (
                <div key={piece.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-gray-800 truncate">
                      {piece.label}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {piece.token}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-yellow-700 hover:text-yellow-800"
                    onClick={() => onInsert(piece.token)}
                  >
                    Insert
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
