import React, { useState } from "react"
import {
  AlignHorizontalSpaceBetween,
  ArrowLeftToLine,
  ArrowRightToLine,
  AlignJustify,
} from "lucide-react"
import type { CabinetData } from "../types"
import type { FillGapsMode } from "../utils/handlers/fillGapsTypes"

interface MultiSelectToolbarProps {
  selectedCabinets: CabinetData[]
  onFillGaps: (mode: FillGapsMode) => void
}

const fillOptions: Array<{
  mode: FillGapsMode
  title: string
  icon: React.ComponentType<{ size?: number | string }>
}> = [
    {
      mode: "inside",
      title: "Fill between inside edges (keep outer cabinets fixed)",
      icon: AlignHorizontalSpaceBetween,
    },
    {
      mode: "to-right-wall",
      title: "Fill from left inside edge to the right wall",
      icon: ArrowRightToLine,
    },
    {
      mode: "to-left-wall",
      title: "Fill from the left wall to the right inside edge",
      icon: ArrowLeftToLine,
    },
    {
      mode: "full-width",
      title: "Fill from the left wall to the right wall",
      icon: AlignJustify,
    },
  ]

export const MultiSelectToolbar: React.FC<MultiSelectToolbarProps> = ({
  selectedCabinets,
  onFillGaps,
}) => {
  const [mode, setMode] = useState<FillGapsMode>("inside")

  if (selectedCabinets.length < 2) return null

  return (
    <div className="fixed top-[20px] left-[80px] z-50">
      <div className="flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-xl backdrop-blur">
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-inner">
          {fillOptions.map((option) => {
            const isActive = option.mode === mode
            const Icon = option.icon
            return (
              <button
                key={option.mode}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMode(option.mode)
                }}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150",
                  isActive
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/70",
                ].join(" ")}
                aria-pressed={isActive}
                title={option.title}
              >
                <Icon size={18} />
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onFillGaps(mode)
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg transition-colors duration-200 hover:bg-blue-700"
          title="Resize selected cabinets to fill the gaps"
        >
          Fill the gaps
        </button>
      </div>
    </div>
  )
}

export default MultiSelectToolbar
