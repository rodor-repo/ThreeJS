import React from 'react'
import type { WsProduct } from '@/types/erpTypes'
import type { PriceData } from '../hooks/usePriceQuery'

export interface PanelHeaderProps {
  /** Product data */
  wsProduct?: WsProduct
  /** Cabinet sort number for display */
  sortNumber?: number
  /** Whether product is loading */
  loading: boolean
  /** Whether product load errored */
  error: boolean
  /** Current price data */
  priceData?: PriceData
  /** Whether price is currently fetching */
  isPriceFetching: boolean
  /** Whether price query errored */
  isPriceError: boolean
  /** Query status */
  queryStatus: 'pending' | 'error' | 'success'
  /** Close panel callback */
  onClose: () => void
}

/**
 * Panel header component with title, price display, and close button
 */
export const PanelHeader: React.FC<PanelHeaderProps> = ({
  wsProduct,
  sortNumber,
  loading,
  error,
  priceData,
  isPriceFetching,
  isPriceError,
  queryStatus,
  onClose
}) => {
  const renderPriceDisplay = () => {
    if (loading) {
      return (
        <span className="text-blue-600 text-xs uppercase font-medium tracking-wide animate-pulse">
          Loading Product...
        </span>
      )
    }

    if (error) {
      return <span className="text-red-600 font-medium">Product Error</span>
    }

    if (!wsProduct) {
      return <span className="text-amber-600 font-medium">No Product Data</span>
    }

    if (isPriceFetching) {
      return (
        <span className="text-gray-500 text-xs uppercase font-medium tracking-wide">
          Updating Price…
        </span>
      )
    }

    if (isPriceError) {
      return <span className="text-red-600 font-medium">Price N/A</span>
    }

    if (priceData && queryStatus === 'success' && priceData.amount > 0) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
          {`$${priceData.amount.toFixed(2)}`}
        </span>
      )
    }

    return <span className="text-gray-400 italic text-xs">Calculating...</span>
  }

  return (
    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {sortNumber && (
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-400 shadow-sm flex-shrink-0 mt-1">
              <span className="text-lg font-extrabold text-amber-700">
                #{sortNumber}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-800 leading-tight">
              Product Panel
            </h2>
            {wsProduct && (
              <p
                className="text-sm text-gray-600 mt-1 break-words leading-snug"
                title={wsProduct.product}
              >
                {wsProduct.product}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              {renderPriceDisplay()}
            </div>
          </div>
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            onClose()
          }}
          className="text-gray-500 hover:text-gray-700 transition-colors text-xl leading-none px-2 py-1 -mr-2 -mt-1"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default PanelHeader
