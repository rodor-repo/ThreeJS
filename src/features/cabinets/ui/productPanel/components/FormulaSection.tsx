import React, { useEffect, useMemo, useState } from "react"
import type { FormulaPiece } from "@/types/formulaTypes"

type DimensionOption = {
  id: string
  label: string
}

type FormulaSectionProps = {
  cabinetId: string
  dimensions: DimensionOption[]
  pieces: FormulaPiece[]
  getFormula?: (cabinetId: string, dimId: string) => string | undefined
  onFormulaChange?: (
    cabinetId: string,
    dimId: string,
    formula: string | null
  ) => void
  lastEvaluatedAt?: number
}

export const FormulaSection: React.FC<FormulaSectionProps> = ({
  cabinetId,
  dimensions,
  pieces,
  getFormula,
  onFormulaChange,
  lastEvaluatedAt,
}) => {
  const [selectedDimId, setSelectedDimId] = useState(
    dimensions[0]?.id ?? ""
  )
  const [formulaText, setFormulaText] = useState("")

  useEffect(() => {
    if (!selectedDimId) return
    const existing = getFormula?.(cabinetId, selectedDimId) || ""
    setFormulaText(existing)
  }, [cabinetId, getFormula, selectedDimId])

  const groupedPieces = useMemo(() => {
    const map = new Map<string, FormulaPiece[]>()
    pieces.forEach((piece) => {
      const list = map.get(piece.group) || []
      list.push(piece)
      map.set(piece.group, list)
    })
    return Array.from(map.entries())
  }, [pieces])

  if (dimensions.length === 0) {
    return (
      <div className="text-xs text-gray-500">
        No formula-capable dimensions available.
      </div>
    )
  }

  const lastEvaluatedLabel = lastEvaluatedAt
    ? new Date(lastEvaluatedAt).toLocaleTimeString("en-US")
    : null

  return (
    <div className="space-y-3">
      {lastEvaluatedLabel && (
        <div className="text-[11px] text-gray-500">
          Last evaluated: {lastEvaluatedLabel}
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Target dimension</label>
        <select
          className="w-full text-sm border border-gray-200 rounded px-2 py-1"
          value={selectedDimId}
          onChange={(e) => setSelectedDimId(e.target.value)}
        >
          {dimensions.map((dim) => (
            <option key={dim.id} value={dim.id}>
              {dim.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Formula</label>
        <textarea
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 min-h-[72px]"
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          placeholder='e.g. cab("cabinet-1","width") + 100'
        />
        <div className="flex gap-2">
          <button
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              if (!selectedDimId) return
              onFormulaChange?.(cabinetId, selectedDimId, formulaText.trim())
            }}
          >
            Save
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-gray-200"
            onClick={() => {
              if (!selectedDimId) return
              setFormulaText("")
              onFormulaChange?.(cabinetId, selectedDimId, null)
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-500">Puzzle pieces</p>
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded">
          {groupedPieces.map(([group, groupPieces]) => (
            <div key={group} className="border-b border-gray-100 last:border-b-0">
              <div className="bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600">
                {group}
              </div>
              <div className="p-2 space-y-1">
                {groupPieces.map((piece) => (
                  <div key={piece.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-700">{piece.label}</span>
                    <button
                      className="text-[11px] text-blue-600 hover:text-blue-700"
                      onClick={() => {
                        setFormulaText((prev) =>
                          prev ? `${prev} ${piece.token}` : piece.token
                        )
                      }}
                    >
                      Insert
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
