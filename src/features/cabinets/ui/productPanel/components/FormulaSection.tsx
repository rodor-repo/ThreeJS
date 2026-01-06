import React, { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, ChevronRight, RefreshCw, X } from "lucide-react"
import { parse } from "mathjs"
import type { FormulaPiece } from "@/types/formulaTypes"
import { FormulaSearchDropdown } from "./FormulaSearchDropdown"
import { FormulaPieceExplorer } from "./FormulaPieceExplorer"
import {
  buildFormulaSegments,
  isInteractiveSegment,
  removeFormulaRange,
  replaceFormulaRange,
} from "./formulaExpressionUtils"
import { FormulaVisualExpression } from "./FormulaVisualExpression"

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

type FormulaStatus = "empty" | "valid" | "invalid"

type FormulaMeta = DimensionOption & {
  formula: string
  status: FormulaStatus
  error?: string
}

type PaletteToken = {
  label: string
  token: string
  hint?: string
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

const OPERATOR_TOKENS: PaletteToken[] = [
  { label: "+", token: " + " },
  { label: "-", token: " - " },
  { label: "*", token: " * " },
  { label: "/", token: " / " },
  { label: "(", token: "(" },
  { label: ")", token: ")" },
  { label: "%", token: " % " },
]

const COMPARISON_TOKENS: PaletteToken[] = [
  { label: ">", token: " > " },
  { label: ">=", token: " >= " },
  { label: "<", token: " < " },
  { label: "<=", token: " <= " },
  { label: "==", token: " == " },
  { label: "!=", token: " != " },
  { label: "and", token: " and " },
  { label: "or", token: " or " },
  { label: "not", token: "not(" },
]

const FUNCTION_TOKENS: PaletteToken[] = [
  { label: "if()", token: "if(condition, then, else)" },
  { label: "min()", token: "min(a, b)" },
  { label: "max()", token: "max(a, b)" },
  { label: "abs()", token: "abs(value)" },
  { label: "round()", token: "round(value, 0)" },
  { label: "floor()", token: "floor(value)" },
  { label: "ceil()", token: "ceil(value)" },
  { label: "pow()", token: "pow(a, b)" },
]

const parseFormulaStatus = (formula: string): { status: FormulaStatus; error?: string } => {
  const trimmed = formula.trim()
  if (!trimmed) {
    return { status: "empty" }
  }
  try {
    parse(trimmed)
    return { status: "valid" }
  } catch (error) {
    return {
      status: "invalid",
      error: error instanceof Error ? error.message : "Invalid formula",
    }
  }
}

const TokenButton: React.FC<{
  item: PaletteToken
  onInsert: (token: string) => void
}> = ({ item, onInsert }) => (
  <button
    type="button"
    className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
    onClick={() => onInsert(item.token)}
    title={item.hint || item.token}
  >
    {item.label}
  </button>
)

type FormulaEditorModalProps = {
  isOpen: boolean
  target?: FormulaMeta
  activeCabinetId?: string
  pieces: FormulaPiece[]
  draftValue: string
  draftStatus: FormulaStatus
  draftError?: string
  lastEvaluatedLabel?: string | null
  canSave: boolean
  onDraftChange: (value: string) => void
  onSave: () => void
  onClear: () => void
  onClose: () => void
}

const FormulaEditorModal: React.FC<FormulaEditorModalProps> = ({
  isOpen,
  target,
  activeCabinetId,
  pieces,
  draftValue,
  draftStatus,
  draftError,
  lastEvaluatedLabel,
  canSave,
  onDraftChange,
  onSave,
  onClear,
  onClose,
}) => {
  const [pieceQuery, setPieceQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPieceQuery("")
    }
  }, [isOpen])

  const statusStyle = target ? STATUS_STYLES[draftStatus] : STATUS_STYLES.empty
  const targetFormula = target?.formula ?? ""
  const formulaSegments = useMemo(
    () => buildFormulaSegments(draftValue, pieces),
    [draftValue, pieces]
  )
  const lastInteractiveIndex = useMemo(() => {
    for (let i = formulaSegments.length - 1; i >= 0; i -= 1) {
      if (isInteractiveSegment(formulaSegments[i])) {
        return i
      }
    }
    return null
  }, [formulaSegments])

  useEffect(() => {
    if (selectedSegmentIndex === null) return
    const segment = formulaSegments[selectedSegmentIndex]
    if (!segment || !isInteractiveSegment(segment)) {
      setSelectedSegmentIndex(null)
    }
  }, [formulaSegments, selectedSegmentIndex])

  const insertTokenAtCursor = (token: string) => {
    const textarea = editorRef.current
    if (!textarea) {
      onDraftChange(draftValue ? `${draftValue}${token}` : token)
      setSelectedSegmentIndex(null)
      return
    }
    const start = textarea.selectionStart ?? draftValue.length
    const end = textarea.selectionEnd ?? draftValue.length
    const nextValue = `${draftValue.slice(0, start)}${token}${draftValue.slice(end)}`
    onDraftChange(nextValue)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + token.length
      textarea.setSelectionRange(cursor, cursor)
    })
    setSelectedSegmentIndex(null)
  }

  const replaceSelectedToken = (token: string) => {
    if (selectedSegmentIndex === null) return false
    const segment = formulaSegments[selectedSegmentIndex]
    if (!segment || !isInteractiveSegment(segment)) return false
    const nextValue = replaceFormulaRange(draftValue, segment.start, segment.end, token)
    onDraftChange(nextValue)
    setSelectedSegmentIndex(null)
    return true
  }

  const handleTokenInsert = (token: string) => {
    if (replaceSelectedToken(token)) return
    insertTokenAtCursor(token)
  }

  return (
    <AnimatePresence>
      {isOpen && target && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 24, stiffness: 220 }}
            className="relative w-full max-w-5xl max-h-[85vh] bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/20 overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gray-900 text-white border-b border-gray-800/80">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-yellow-500 text-gray-900 flex items-center justify-center text-xs font-black tracking-wider shadow-lg shadow-yellow-500/20">
                    FX
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Formula Studio</div>
                    <div className="text-[12px] text-gray-300">
                      Target: <span className="font-semibold text-white">{target.label}</span>
                      <span className="text-gray-400"> ({target.id})</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lastEvaluatedLabel && (
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-300">
                      <RefreshCw size={12} className="text-yellow-400" />
                      Last evaluated {lastEvaluatedLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col gap-4 h-full">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      Find pieces
                    </label>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={pieceQuery}
                        onChange={(event) => setPieceQuery(event.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        placeholder="Search pieces and groups..."
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                      />
                      <FormulaSearchDropdown
                        query={pieceQuery}
                        pieces={pieces}
                        isOpen={isSearchFocused}
                        onSelect={(piece) => {
                          handleTokenInsert(piece.token)
                          setPieceQuery("")
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Operators
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {OPERATOR_TOKENS.map((item) => (
                        <TokenButton key={item.label} item={item} onInsert={handleTokenInsert} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Conditions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COMPARISON_TOKENS.map((item) => (
                        <TokenButton key={item.label} item={item} onInsert={handleTokenInsert} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Functions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {FUNCTION_TOKENS.map((item) => (
                        <TokenButton key={item.label} item={item} onInsert={handleTokenInsert} />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 min-h-[180px]">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      Puzzle piece builder
                    </div>
                    <div className="text-[10px] text-gray-400 mb-2">
                      Choose a cabinet, pick a type, then insert a piece.
                    </div>
                    <FormulaPieceExplorer
                      pieces={pieces}
                      defaultCabinetId={activeCabinetId}
                      onInsert={handleTokenInsert}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col gap-4 h-full">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      Formula editor
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyle.badge}`}
                    >
                      {draftStatus === "valid" && <CheckCircle2 size={12} />}
                      {draftStatus === "invalid" && <AlertCircle size={12} />}
                      {statusStyle.label}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                          Visual formula
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedSegmentIndex !== null && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const segment = formulaSegments[selectedSegmentIndex]
                                  if (!segment || !isInteractiveSegment(segment)) {
                                    setSelectedSegmentIndex(null)
                                    return
                                  }
                                  const nextValue = removeFormulaRange(
                                    draftValue,
                                    segment.start,
                                    segment.end
                                  )
                                  onDraftChange(nextValue)
                                  setSelectedSegmentIndex(null)
                                }}
                                className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSegmentIndex(null)}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (lastInteractiveIndex === null) return
                              const segment = formulaSegments[lastInteractiveIndex]
                              if (!segment || !isInteractiveSegment(segment)) return
                              const nextValue = removeFormulaRange(
                                draftValue,
                                segment.start,
                                segment.end
                              )
                              onDraftChange(nextValue)
                              setSelectedSegmentIndex(null)
                            }}
                            className="text-[11px] font-semibold text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={lastInteractiveIndex === null}
                          >
                            Backspace
                          </button>
                        </div>
                      </div>
                      <FormulaVisualExpression
                        formula={draftValue}
                        pieces={pieces}
                        segments={formulaSegments}
                        selectedIndex={selectedSegmentIndex}
                        onSelect={setSelectedSegmentIndex}
                      />
                    </div>
                    <textarea
                      ref={editorRef}
                      value={draftValue}
                      onChange={(event) => onDraftChange(event.target.value)}
                      placeholder='e.g. cab("cabinet-1","height") + 200'
                      className={`w-full min-h-[200px] rounded-xl border px-3 py-3 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 ${draftStatus === "invalid"
                        ? "border-red-300 focus:ring-red-200"
                        : "border-gray-200 focus:ring-yellow-300"
                        }`}
                      spellCheck={false}
                    />
                    {draftStatus === "invalid" && draftError && (
                      <div className="flex items-start gap-2 text-xs text-red-600">
                        <AlertCircle size={14} className="mt-0.5" />
                        <span>Formula error: {draftError}</span>
                      </div>
                    )}
                    {draftStatus === "empty" && (
                      <div className="text-xs text-gray-400">
                        Enter a formula to enable saving.
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-600 space-y-2">
                    <div className="font-bold uppercase tracking-widest text-gray-500">
                      Tips
                    </div>
                    <div>
                      Use puzzle pieces to insert cabinet values, then combine with operators.
                    </div>
                    <div>
                      For logic, use <span className="font-semibold text-gray-700">if(condition, then, else)</span>.
                    </div>
                    <div>
                      Values are in millimeters unless the piece says otherwise.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] text-gray-500">
                  Formulas are validated before saving. Invalid formulas cannot be applied.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onClear}
                    disabled={!targetFormula.trim() && !draftValue.trim()}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear formula
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={!canSave}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    Save formula
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
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
