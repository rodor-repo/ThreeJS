import React from 'react'
import type { WsProduct } from '@/types/erpTypes'
import type { MaterialOptionsResponse } from '@/server/getProductData'
import type { MaterialSelection } from '../utils/materialUtils'
import { getMaterialDisplayInfo } from '../utils/materialUtils'

export interface MaterialCardProps {
  /** Material ID */
  materialId: string
  /** Material object from WsProduct */
  material: WsProduct['materials'][string]
  /** Material options from API */
  materialOptions?: MaterialOptionsResponse[string]
  /** Current selection for this material */
  selection?: MaterialSelection
  /** Price range change callback */
  onPriceRangeChange: (priceRangeId: string) => void
  /** Open color picker callback */
  onOpenColorPicker: () => void
}

/**
 * Single material card with price range selector and color picker button
 */
export const MaterialCard: React.FC<MaterialCardProps> = ({
  materialId: _materialId,
  material,
  materialOptions,
  selection,
  onPriceRangeChange,
  onOpenColorPicker
}) => {
  const prPairs = materialOptions ? Object.entries(materialOptions.priceRanges) : []
  const selectedPriceRangeId = selection?.priceRangeId ||
    material.priceRangeIds?.[0] ||
    prPairs?.[0]?.[0]

  const displayInfo = getMaterialDisplayInfo(selection, materialOptions)

  return (
    <div className="border border-gray-200 rounded-md p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-800 capitalize">
            {material.material}
          </div>
          <div className="mt-2">
            <label className="block text-xs text-gray-600 mb-1">Price range</label>
            <select
              className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
              value={selectedPriceRangeId || ''}
              onChange={e => onPriceRangeChange(e.target.value)}
            >
              {prPairs.map(([prId, pr]) => (
                <option key={prId} value={prId}>{pr.priceRange}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="min-w-[140px] text-right">
          <button
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
            disabled={!materialOptions || prPairs.length === 0}
            onClick={onOpenColorPicker}
          >
            <span>Select Colour</span>
          </button>
          <div className="mt-2 text-xs text-gray-600 truncate">
            {displayInfo.colorName ? (
              <div className="flex items-center justify-end gap-2">
                <div className="w-6 h-6 rounded bg-gray-100 overflow-hidden border border-gray-200">
                  {displayInfo.colorImageUrl ? (
                    <img
                      src={displayInfo.colorImageUrl}
                      alt={displayInfo.colorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>
                <div className="max-w-[120px] text-right">
                  <div className="text-gray-800">{displayInfo.colorName}</div>
                  {displayInfo.finishName && (
                    <div className="text-gray-500">{displayInfo.finishName}</div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-500">No color selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MaterialCard
