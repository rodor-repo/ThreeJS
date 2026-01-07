import React, { useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import type { FormulaPiece } from "@/types/formulaTypes"
import type { ViewId } from "@/features/cabinets/ViewManager"
import {
  FormulaEditorModal,
  type FormulaTargetMeta,
} from "@/features/cabinets/ui/productPanel/components/FormulaEditorModal"
import {
  parseFormulaStatus,
  type FormulaStatus,
} from "@/features/cabinets/ui/productPanel/components/formulaStatusUtils"

type GDFormulaItem = {
  gdId: string
  name: string
}

type GDFormulaSectionProps = {
  viewId: ViewId
  gdList: GDFormulaItem[]
  pieces: FormulaPiece[]
  getGDFormula: (viewId: ViewId, gdId: string) => string | undefined
  onGDFormulaChange: (
    viewId: ViewId,
    gdId: string,
    formula: string | null
  ) => void
  getGDFormulaLastEvaluatedAt?: (
    viewId: ViewId,
    gdId: string
  ) => number | undefined
  activeCabinetId?: string
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

export const GDFormulaSection: React.FC<GDFormulaSectionProps> = ({
  viewId,
  gdList,
  pieces,
  getGDFormula,
  onGDFormulaChange,
  getGDFormulaLastEvaluatedAt,
  activeCabinetId,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeGdId, setActiveGdId] = useState(gdList[0]?.gdId ?? "")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState("")
  const [dimensionFilter, setDimensionFilter] = useState("")
  const [formulaVersion, setFormulaVersion] = useState(0)

  useEffect(() => {
    if (!gdList.length) return
    if (!gdList.some((gd) => gd.gdId === activeGdId)) {
      setActiveGdId(gdList[0].gdId)
    }
  }, [activeGdId, gdList])

  const formulaMeta = useMemo<FormulaMeta[]>(
    () =>
      gdList.map((gd) => {
        const formula = getGDFormula(viewId, gd.gdId) || ""
        const statusInfo = parseFormulaStatus(formula)
        return {
          id: gd.gdId,
          label: gd.name,
          formula,
          status: statusInfo.status,
          error: statusInfo.error,
        }
      }),
    [gdList, getGDFormula, viewId, formulaVersion]
  )

  const formulaMetaById = useMemo(
    () => new Map(formulaMeta.map((meta) => [meta.id, meta])),
    [formulaMeta]
  )

  const activeMeta = formulaMetaById.get(activeGdId)

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

  const lastEvaluatedAt = activeMeta
    ? getGDFormulaLastEvaluatedAt?.(viewId, activeMeta.id)
    : undefined
  const lastEvaluatedLabel = lastEvaluatedAt
    ? new Date(lastEvaluatedAt).toLocaleTimeString("en-US")
    : null

  return (
    <div className="mb-6">
      <div className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-4"
        >
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">
              Global Dimension Formulas
            </div>
            <div className="text-[11px] text-gray-500">
              Attach formulas to view-level GDs.
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform ${
              isExpanded ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        {isExpanded && (
          <div className="p-4 space-y-3">
            {gdList.length === 0 ? (
              <div className="text-xs text-gray-500">
                No formula-capable GDs available for this view.
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={dimensionFilter}
                  onChange={(event) => setDimensionFilter(event.target.value)}
                  placeholder="Filter GDs..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />

                <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white custom-scrollbar">
                  {filteredMeta.length === 0 ? (
                    <li className="px-4 py-6 text-center text-xs text-gray-400">
                      No GDs match that filter.
                    </li>
                  ) : (
                    filteredMeta.map((meta) => {
                      const statusStyle = STATUS_STYLES[meta.status]
                      const isInvalid = meta.status === "invalid"
                      return (
                        <li key={meta.id}>
                          <button
                            type="button"
                            className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-3 ${
                              isInvalid
                                ? "bg-red-50/30 hover:bg-red-50"
                                : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setActiveGdId(meta.id)
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
                            <ChevronRight
                              size={16}
                              className="text-gray-300 mt-1.5"
                            />
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>

                {lastEvaluatedLabel && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    <RefreshCw size={12} />
                    Last evaluated {lastEvaluatedLabel}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {activeMeta && (
        <FormulaEditorModal
          isOpen={isModalOpen}
          target={activeMeta}
          activeCabinetId={activeCabinetId}
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
            onGDFormulaChange(viewId, activeMeta.id, formulaDraft.trim())
            setFormulaVersion((version) => version + 1)
            setIsModalOpen(false)
          }}
          onClear={() => {
            if (!activeMeta) return
            onGDFormulaChange(viewId, activeMeta.id, null)
            setFormulaVersion((version) => version + 1)
            setFormulaDraft("")
          }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}
