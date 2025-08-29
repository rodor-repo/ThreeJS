import React from 'react'

type DebugBalanceButtonProps = {
  onClick?: () => void
  className?: string
}

const DebugBalanceButton: React.FC<DebugBalanceButtonProps> = ({ onClick, className }) => (
  <button
    onClick={e => { e.stopPropagation(); onClick?.() }}
    className={`text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors ${className || ''}`}
    title="Runs a debug balance pass and logs the result"
  >
    Debug Balance
  </button>
)

export default DebugBalanceButton
