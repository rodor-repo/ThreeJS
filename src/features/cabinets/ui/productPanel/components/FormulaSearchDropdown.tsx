import React, { useMemo } from "react"
import type { FormulaPiece } from "@/types/formulaTypes"
import { parsePieceGroup } from "./formulaPieceUtils"

type FormulaSearchDropdownProps = {
  query: string
  pieces: FormulaPiece[]
  isOpen: boolean
  onSelect: (piece: FormulaPiece) => void
  maxResults?: number
}

type SearchResult = {
  piece: FormulaPiece
  cabinetLabel: string
  category: string
}

const highlightMatches = (text: string, query: string) => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = trimmedQuery.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let matchIndex = lowerText.indexOf(lowerQuery)

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex))
    }
    const matchText = text.slice(matchIndex, matchIndex + trimmedQuery.length)
    parts.push(
      <span
        key={`${matchIndex}-${matchText}`}
        className="bg-yellow-200/70 text-yellow-900 rounded px-0.5"
      >
        {matchText}
      </span>
    )
    lastIndex = matchIndex + trimmedQuery.length
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export const FormulaSearchDropdown: React.FC<FormulaSearchDropdownProps> = ({
  query,
  pieces,
  isOpen,
  onSelect,
  maxResults = 10,
}) => {
  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) return []
    return pieces
      .map((piece) => {
        const { cabinetLabel, category } = parsePieceGroup(piece.group)
        return { piece, cabinetLabel, category }
      })
      .filter(({ piece, cabinetLabel, category }) => {
        const label = piece.label.toLowerCase()
        const token = piece.token.toLowerCase()
        const group = piece.group.toLowerCase()
        const cab = cabinetLabel.toLowerCase()
        const cat = category.toLowerCase()
        return (
          label.includes(normalizedQuery) ||
          token.includes(normalizedQuery) ||
          group.includes(normalizedQuery) ||
          cab.includes(normalizedQuery) ||
          cat.includes(normalizedQuery)
        )
      })
      .slice(0, maxResults)
  }, [maxResults, normalizedQuery, pieces])

  if (!isOpen) return null

  return (
    <div
      className="absolute left-0 right-0 top-full mt-2 z-20"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {normalizedQuery ? `${results.length} results` : "Search tips"}
        </div>
        {!normalizedQuery ? (
          <div className="px-3 py-4 text-xs text-gray-400">
            Start typing to search puzzle pieces by cabinet, category, or token.
          </div>
        ) : results.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400">
            No puzzle pieces match your search.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {results.map(({ piece, cabinetLabel, category }) => (
              <button
                key={piece.id}
                type="button"
                className="w-full px-3 py-2 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
                onClick={() => onSelect(piece)}
              >
                <div className="text-[12px] font-semibold text-gray-800 truncate">
                  {highlightMatches(piece.label, query)}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {highlightMatches(`${cabinetLabel} - ${category}`, query)}
                </div>
                <div className="text-[10px] text-gray-400 truncate font-mono">
                  {highlightMatches(piece.token, query)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
