'use client'

import React from 'react'
import { X, AlertTriangle } from 'lucide-react'

export type MergeItemType = 'benchtop' | 'kicker'

export interface MergeWarning {
  type: 'height' | 'depth' | 'thickness' | 'material'
  message: string
  cabinetNumbers: string[]
}

interface MergeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  warnings: MergeWarning[]
  itemCount: number
  itemType: MergeItemType
}

export const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  warnings,
  itemCount,
  itemType,
}) => {
  if (!isOpen) return null

  const hasWarnings = warnings.length > 0
  const itemLabel = itemType === 'benchtop' ? 'Benchtops' : 'Kickers'
  const itemLabelSingular = itemType === 'benchtop' ? 'benchtops' : 'kickers'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle size={24} />
              Merge {itemCount} {itemLabel}
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {hasWarnings ? (
              <div className="space-y-4">
                <p className="text-gray-600 font-medium">
                  The following differences were detected:
                </p>

                {warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="text-gray-800">{warning.message}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <p className="text-gray-600 mt-4">
                  Do you want to proceed with the merge?
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600">
                  Are you sure you want to merge {itemCount} {itemLabelSingular} into one?
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Confirm Merge
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Backward compatibility alias
export const MergeBenchtopsModal = MergeModal
