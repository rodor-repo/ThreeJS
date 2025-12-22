import React from 'react'

export interface SimpleColorPickerProps {
  /** Current color value (hex) */
  color: string
  /** Color change callback */
  onChange: (color: string) => void
  /** If true, renders only inner content without card wrapper */
  noWrapper?: boolean
}

/**
 * Simple color picker with input and text field
 */
export const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({
  color,
  onChange,
  noWrapper = false,
}) => {
  const content = (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        className="w-10 h-8 border border-gray-300 rounded-md cursor-pointer"
        value={color}
        onChange={e => onChange(e.target.value)}
      />
      <input
        type="text"
        className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
        value={color}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )

  if (noWrapper) {
    return content
  }

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
          <circle cx="12" cy="12" r="10" />
          <path d="M14.31 8l5.74 9.94" />
          <path d="M9.69 8h11.48" />
          <path d="M7.38 12l5.74-9.94" />
          <path d="M9.69 16L3.95 6.06" />
          <path d="M14.31 16H2.83" />
        </svg>
        <h3>Material</h3>
      </div>
      {content}
    </div>
  )
}

export default SimpleColorPicker
