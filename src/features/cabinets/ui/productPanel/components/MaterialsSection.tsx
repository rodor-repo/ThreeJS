import React from 'react'
import _ from 'lodash'
import type { WsProduct } from '@/types/erpTypes'
import type { MaterialOptionsResponse } from '@/server/getProductData'
import type { MaterialSelection, MaterialSelections } from '../utils/materialUtils'
import { updateSelectionForPriceRange } from '../utils/materialUtils'
import MaterialCard from './MaterialCard'

export interface MaterialsSectionProps {
  /** WsProduct with materials */
  wsProduct: WsProduct
  /** Material options from API */
  materialOptions?: MaterialOptionsResponse
  /** Current material selections */
  materialSelections: MaterialSelections
  /** Selection change callback */
  onSelectionChange: (materialId: string, selection: MaterialSelection) => void
  /** Open color picker callback */
  onOpenColorPicker: (materialId: string) => void
}

/**
 * Materials section component with list of material cards
 */
export const MaterialsSection: React.FC<MaterialsSectionProps> = ({
  wsProduct,
  materialOptions,
  materialSelections,
  onSelectionChange,
  onOpenColorPicker
}) => {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
      <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <h3>Materials</h3>
      </div>
      <div className="space-y-4">
        {_(wsProduct.materials)
          .toPairs()
          .filter(([, m]) => m.visible !== false)
          .sortBy(([, m]) => Number(m.sortNum))
          .map(([materialId, material]) => {
            const mOpts = materialOptions?.[materialId]
            const selection = materialSelections[materialId]

            const handlePriceRangeChange = (newPriceRangeId: string) => {
              const newSelection = updateSelectionForPriceRange(newPriceRangeId, mOpts)
              onSelectionChange(materialId, newSelection)
            }

            return (
              <MaterialCard
                key={materialId}
                materialId={materialId}
                material={material}
                materialOptions={mOpts}
                selection={selection}
                onPriceRangeChange={handlePriceRangeChange}
                onOpenColorPicker={() => onOpenColorPicker(materialId)}
              />
            )
          })
          .value()}
      </div>
    </div>
  )
}

export default MaterialsSection
