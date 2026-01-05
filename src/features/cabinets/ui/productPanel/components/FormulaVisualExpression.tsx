import React from "react"
import type { FormulaPiece } from "@/types/formulaTypes"
import { buildFormulaSegments, type FormulaSegment } from "./formulaExpressionUtils"

type FormulaVisualExpressionProps = {
  formula: string
  pieces: FormulaPiece[]
  segments?: FormulaSegment[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
}

export const FormulaVisualExpression: React.FC<FormulaVisualExpressionProps> = ({
  formula,
  pieces,
  segments: providedSegments,
  selectedIndex,
  onSelect,
}) => {
  const segments = providedSegments ?? buildFormulaSegments(formula, pieces)
  const hasPieces = segments.some((segment) => segment.type === "piece")

  if (!formula.trim()) {
    return (
      <div className="text-xs text-gray-400">
        No formula yet. Use puzzle pieces or operators to build one.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap items-center text-xs text-gray-600 font-mono leading-relaxed">
        {segments.map((segment, index) => {
          if (segment.type === "whitespace") {
            return (
              <span key={`${segment.start}-${segment.end}`} className="whitespace-pre-wrap">
                {segment.value}
              </span>
            )
          }

          const isActive = selectedIndex === index
          if (segment.type === "piece") {
            const tokenValue = segment.label
            const baseStyle = "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            return (
              <button
                key={`${segment.start}-${segment.end}`}
                type="button"
                onClick={() => onSelect(isActive ? null : index)}
                className={`mx-1 inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${isActive
                  ? "border-yellow-500 bg-yellow-100 text-yellow-900"
                  : baseStyle
                  }`}
                title={segment.token}
              >
                {tokenValue}
              </button>
            )
          }

          if (segment.type === "token") {
            const tokenValue = segment.value
            let baseStyle = "border-gray-200 bg-white text-gray-700 hover:border-gray-300"

            switch (segment.kind) {
              case "operator":
                baseStyle = "border-gray-300 bg-gray-900 text-white hover:bg-gray-800"
                break
              case "punctuation":
                baseStyle = "border-gray-200 bg-gray-100 text-gray-600 hover:border-gray-300"
                break
              case "number":
                baseStyle = "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                break
              case "identifier":
              case "unknown":
              default:
                baseStyle = "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }

            return (
              <button
                key={`${segment.start}-${segment.end}`}
                type="button"
                onClick={() => onSelect(isActive ? null : index)}
                className={`mx-1 inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${isActive
                  ? "border-yellow-500 bg-yellow-100 text-yellow-900"
                  : baseStyle
                  }`}
                title={segment.value}
              >
                {tokenValue}
              </button>
            )
          }

          return null
        })}
      </div>
      {!hasPieces && (
        <div className="mt-2 text-[11px] text-gray-400">
          This formula has no puzzle pieces yet.
        </div>
      )}
    </div>
  )
}
