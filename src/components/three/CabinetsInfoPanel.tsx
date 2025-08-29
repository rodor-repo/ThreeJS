import React from 'react'
import type { CabinetData } from './types'

type Props = {
  cabinets: CabinetData[]
}

export const CabinetsInfoPanel: React.FC<Props> = ({ cabinets }) => {
  if (cabinets.length === 0) return null
  return (
    <div className="absolute top-16 right-4 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg text-sm z-10 max-w-xs">
      <div className="font-semibold mb-2">Cabinets in Scene:</div>
      <div className="space-y-1">
        {cabinets.map((cabinet, index) => (
          <div key={index} className="text-xs">
            Cabinet {index + 1}: {cabinet.carcass.group.name || 'Unknown Type'}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-600">
        Total: {cabinets.length} cabinet{cabinets.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
