import React, { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useCollapsibleSections } from '../hooks/useCollapsibleSections'

export interface CollapsibleSectionProps {
  /** Unique ID for persistence */
  id: string
  /** Section title */
  title: string
  /** Optional icon (React node) */
  icon?: ReactNode
  /** Section content */
  children: ReactNode
  /** Optional additional class names */
  className?: string
}

/**
 * Collapsible card section with chevron toggle.
 * 
 * Features:
 * - Card styling matching existing ProductPanel sections
 * - Chevron icon in top-right that rotates on collapse
 * - Smooth animation for expand/collapse
 * - State persists via useCollapsibleSections hook
 * - All sections collapsed by default
 * 
 * @example
 * ```tsx
 * <CollapsibleSection id="dimensions" title="Dimensions" icon={<RulerIcon />}>
 *   <DimensionsSection noWrapper ... />
 * </CollapsibleSection>
 * ```
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  children,
  className = '',
}) => {
  const { isExpanded, toggleSection } = useCollapsibleSections()
  const expanded = isExpanded(id)

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header - always visible, clickable to toggle */}
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-2 text-gray-700 font-medium">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <h3>{title}</h3>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : 'rotate-0'
            }`}
        />
      </button>

      {/* Content - animated expand/collapse */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="px-3 pb-3 pt-0">
          {children}
        </div>
      </div>
    </div>
  )
}

export default CollapsibleSection
