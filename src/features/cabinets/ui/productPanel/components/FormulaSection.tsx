import React, { useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronRight, RefreshCw } from "lucide-react"
import type { FormulaPiece } from "@/types/formulaTypes"
import {
  FormulaEditorModal,
  type FormulaTargetMeta,
} from "./FormulaEditorModal"
import { parseFormulaStatus, type FormulaStatus } from "./formulaStatusUtils"

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

type FormulaMeta = FormulaTargetMeta & {
  status: FormulaStatus
  error?: string
}

const STATUS_STYLES: Record<
  FormulaStatus,
  { label: string; dot: string; badge: string; text: string }
> = {
  empty: {
    label: "No formula",
    dot: "bg-gray-300",
    badge: "bg-gray-100 text-gray-600",
    text: "text-gray-500",
  },
  valid: {
    label: "Formula set",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  invalid: {
    label: "Invalid formula",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700",
    text: "text-red-600",
  },
}

export const FormulaSection: React.FC<FormulaSectionProps> = ({
  cabinetId,
  dimensions,
  pieces,
  getFormula,
  onFormulaChange,
  lastEvaluatedAt,
}) => {
  const [activeDimId, setActiveDimId] = useState(dimensions[0]?.id ?? "")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("")
  const [formulaVersion, setFormulaVersion] = useState(0)

  useEffect(() => {
    if (!dimensions.length) return
    if (!dimensions.some((dim) => dim.id === activeDimId)) {
      setActiveDimId(dimensions[0].id)
    }
  }, [activeDimId, dimensions])

  const formulaMeta = useMemo<FormulaMeta[]>(
    () =>
      dimensions.map((dim) => {
        const formula = getFormula?.(cabinetId, dim.id) || ""
        const statusInfo = parseFormulaStatus(formula)
        return {
          ...dim,
          formula,
          status: statusInfo.status,
          error: statusInfo.error,
        }
      }),
    [cabinetId, dimensions, getFormula, formulaVersion]
  )

  const formulaMetaById = useMemo(
    () => new Map(formulaMeta.map((meta) => [meta.id, meta])),
    [formulaMeta]
  )

  const activeMeta = formulaMetaById.get(activeDimId)

  useEffect(() => {
    if (!isModalOpen) return
    setFormulaDraft(activeMeta?.formula || "")
  }, [activeMeta, isModalOpen])

  const filteredMeta = useMemo(() => {
    const query = dimensionFilter.trim().toLowerCase()
    if (!query) {
      return formulaMeta
    }
    return formulaMeta.filter((meta) => meta.label.toLowerCase().includes(query))
  }, [dimensionFilter, formulaMeta])

  const { status: draftStatus, error: draftError } = useMemo(
    () => parseFormulaStatus(formulaDraft),
    [formulaDraft]
  )

  const canSave = draftStatus === "valid" && formulaDraft.trim().length > 0

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Target dimensions
            </div>
            <div className="text-[11px] text-gray-500">
              Select a dimension to build or edit its formula.
            </div>
          </div>
          {lastEvaluatedLabel && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              <RefreshCw size={12} />
              Last evaluated {lastEvaluatedLabel}
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <input
            type="text"
            value={dimensionFilter}
            onChange={(event) => setDimensionFilter(event.target.value)}
            placeholder="Filter dimensions..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />

          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white custom-scrollbar">
            {filteredMeta.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-gray-400">
                No dimensions match that filter.
              </li>
            ) : (
              filteredMeta.map((meta) => {
                const statusStyle = STATUS_STYLES[meta.status]
                const isInvalid = meta.status === "invalid"
                return (
                  <li key={meta.id}>
                    <button
                      type="button"
                      className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-3 ${isInvalid
                        ? "bg-red-50/30 hover:bg-red-50"
                        : "hover:bg-gray-50"
                        }`}
                      onClick={() => {
                        setActiveDimId(meta.id)
                        setIsModalOpen(true)
                      }}
                    >
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 rounded-full ${statusStyle.dot}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {meta.label}
                          </div>
                          {isInvalid && (
                            <div
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyle.badge}`}
                            >
                              <AlertCircle size={12} />
                              Invalid
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {meta.formula.trim() || "No formula yet"}
                        </div>
                        {meta.status === "invalid" && meta.error && (
                          <div className="text-[10px] text-red-500 truncate">
                            {meta.error}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300 mt-1.5" />
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          <div className="text-[11px] text-gray-500">
            Use the modal to build formulas with puzzle pieces and operators.
          </div>
        </div>
      </div>

      <FormulaEditorModal
        isOpen={isModalOpen}
        target={activeMeta}
        activeCabinetId={cabinetId}
        pieces={pieces}
        draftValue={formulaDraft}
        draftStatus={draftStatus}
        draftError={draftError}
        lastEvaluatedLabel={lastEvaluatedLabel}
        canSave={canSave}
        onDraftChange={setFormulaDraft}
        onSave={() => {
          if (!activeMeta) return
          if (!canSave) return
          onFormulaChange?.(cabinetId, activeMeta.id, formulaDraft.trim())
          setFormulaVersion((version) => version + 1)
          setIsModalOpen(false)
        }}
        onClear={() => {
          if (!activeMeta) return
          onFormulaChange?.(cabinetId, activeMeta.id, null)
          setFormulaVersion((version) => version + 1)
          setFormulaDraft("")
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
