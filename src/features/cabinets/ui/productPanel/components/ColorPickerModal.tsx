import React from 'react'
import type { WsProduct } from '@/types/erpTypes'
import type { MaterialOptionsResponse } from '@/server/getProductData'
import type { MaterialSelection } from '../utils/materialUtils'
import type { PriceData } from '../hooks/usePriceQuery'
import {
  getFirstColorId,
  getFirstFinishId,
  getFirstPriceRangeId
} from '../utils/materialUtils'

export interface ColorPickerModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Material ID being edited */
  materialId: string
  /** Material object from WsProduct */
  material: WsProduct['materials'][string]
  /** Material options from API */
  materialOptions: MaterialOptionsResponse[string]
  /** Current selection */
  currentSelection?: MaterialSelection
  /** Whether the main panel is expanded */
  isExpanded: boolean
  /** Price data */
  priceData?: PriceData
  /** Whether price is fetching */
  isPriceFetching: boolean
  /** Whether price errored */
  isPriceError: boolean
  /** Selection change callback */
  onSelectionChange: (selection: MaterialSelection) => void
  /** Close modal callback */
  onClose: () => void
}

/**
 * Color picker modal component
 * Secondary side panel for selecting material colors and finishes
 */
export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  materialId,
  material,
  materialOptions,
  currentSelection,
  isExpanded,
  priceData,
  isPriceFetching,
  isPriceError,
  onSelectionChange,
  onClose
}) => {
  if (!isOpen || !materialOptions) return null

  const prPairs = Object.entries(materialOptions.priceRanges)

  // Resolved current values
  const priceRangeId = currentSelection?.priceRangeId ||
    material.priceRangeIds?.[0] ||
    getFirstPriceRangeId(materialOptions) ||
    ''
  const priceRange = priceRangeId ? materialOptions.priceRanges[priceRangeId] : undefined
  const colorPairs = priceRange ? Object.entries(priceRange.colorOptions) : []
  const colorId = currentSelection?.colorId || getFirstColorId(priceRange) || ''
  const selectedColor = colorId && priceRange ? priceRange.colorOptions[colorId] : undefined
  const finishId = currentSelection?.finishId ||
    (selectedColor ? getFirstFinishId(selectedColor) : undefined)

  const handlePriceRangeChange = (newPriceRangeId: string) => {
    const newPriceRange = materialOptions.priceRanges[newPriceRangeId]
    const firstColor = getFirstColorId(newPriceRange) || ''
    const firstFinish = firstColor && newPriceRange
      ? getFirstFinishId(newPriceRange.colorOptions[firstColor])
      : undefined

    onSelectionChange({
      priceRangeId: newPriceRangeId,
      colorId: firstColor,
      finishId: firstFinish
    })
  }

  const handleColorSelect = (newColorId: string) => {
    const colorOption = priceRange?.colorOptions[newColorId]
    const firstFinish = colorOption ? getFirstFinishId(colorOption) : undefined

    onSelectionChange({
      priceRangeId: priceRangeId,
      colorId: newColorId,
      finishId: firstFinish
    })
  }

  const handleFinishSelect = (newColorId: string, newFinishId: string) => {
    onSelectionChange({
      priceRangeId: priceRangeId,
      colorId: newColorId,
      finishId: newFinishId
    })
  }

  const renderPriceDisplay = () => {
    if (isPriceFetching) {
      return <span className="text-gray-500">Updating…</span>
    }
    if (isPriceError) {
      return <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">Price N/A</span>
    }
    if (priceData) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
          ${priceData.amount.toFixed(2)}
        </span>
      )
    }
    return null
  }

  return (
    <div
      className={`fixed top-0 h-full bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out z-[55] ${isExpanded ? 'right-80 sm:right-96' : 'right-0'
        } w-80 sm:w-96`}
      data-color-panel
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-base font-medium truncate">
            Select color – {material.material}
          </div>
          <div className="ml-2 text-sm flex items-center gap-2">
            {renderPriceDisplay()}
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Price range select */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-600">Price range</label>
            <select
              className="text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={priceRangeId}
              onChange={e => handlePriceRangeChange(e.target.value)}
            >
              {prPairs.map(([prId, pr]) => (
                <option key={prId} value={prId}>{pr.priceRange}</option>
              ))}
            </select>
          </div>

          {/* 2-column color grid */}
          <div className="grid grid-cols-2 gap-4">
            {colorPairs.map(([cId, c]) => {
              const isSelectedColor = cId === colorId
              const currentFinishId = currentSelection?.finishId

              return (
                <div
                  key={cId}
                  role="button"
                  tabIndex={0}
                  className={`group relative rounded-lg overflow-hidden border ${isSelectedColor
                      ? 'border-blue-600 ring-2 ring-blue-200'
                      : 'border-gray-200'
                    } hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300`}
                  onClick={() => handleColorSelect(cId)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleColorSelect(cId)
                    }
                  }}
                >
                  <div className="aspect-square w-full bg-gray-100">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.color}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="p-2 text-left">
                    <div className="text-sm text-gray-800 truncate">{c.color}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(c.finishes).map(([fId, f]) => {
                        const isSelectedFinish = isSelectedColor && fId === currentFinishId
                        return (
                          <button
                            key={fId}
                            className={`px-2 py-1 rounded border text-xs ${isSelectedFinish
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            onClick={e => {
                              e.stopPropagation()
                              handleFinishSelect(cId, fId)
                            }}
                          >
                            {f.finish}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-end">
          <button
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ColorPickerModal
