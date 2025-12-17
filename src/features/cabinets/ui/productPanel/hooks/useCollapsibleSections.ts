import { useState, useCallback } from "react"

/**
 * Module-level store for persisting expanded sections across:
 * - Component re-renders
 * - Cabinet selection changes
 * - Panel close/reopen within the same session
 *
 * Key format: sectionId (e.g., "grouping", "dimensions", "materials")
 * Value: boolean (true = expanded, false = collapsed)
 */
const expandedSectionsStore = new Map<string, boolean>()

/**
 * Hook for managing collapsible section state with persistence.
 *
 * Features:
 * - All sections collapsed by default
 * - State persists when selectedCabinet changes
 * - State persists when panel closes/reopens
 * - State resets on page refresh
 *
 * @example
 * ```tsx
 * const { isExpanded, toggleSection } = useCollapsibleSections()
 *
 * <CollapsibleSection
 *   id="dimensions"
 *   isExpanded={isExpanded("dimensions")}
 *   onToggle={() => toggleSection("dimensions")}
 * >
 *   ...
 * </CollapsibleSection>
 * ```
 */
export function useCollapsibleSections() {
  // Force re-render when sections are toggled
  const [, forceUpdate] = useState({})

  /**
   * Check if a section is expanded
   * @param sectionId - Unique identifier for the section
   * @returns true if expanded, false if collapsed (default)
   */
  const isExpanded = useCallback((sectionId: string): boolean => {
    return expandedSectionsStore.get(sectionId) ?? false
  }, [])

  /**
   * Toggle a section's expanded state
   * @param sectionId - Unique identifier for the section
   */
  const toggleSection = useCallback((sectionId: string): void => {
    const current = expandedSectionsStore.get(sectionId) ?? false
    expandedSectionsStore.set(sectionId, !current)
    forceUpdate({})
  }, [])

  /**
   * Set a section's expanded state explicitly
   * @param sectionId - Unique identifier for the section
   * @param expanded - Whether to expand (true) or collapse (false)
   */
  const setExpanded = useCallback(
    (sectionId: string, expanded: boolean): void => {
      expandedSectionsStore.set(sectionId, expanded)
      forceUpdate({})
    },
    []
  )

  /**
   * Expand multiple sections at once
   * @param sectionIds - Array of section IDs to expand
   */
  const expandSections = useCallback((sectionIds: string[]): void => {
    sectionIds.forEach((id) => expandedSectionsStore.set(id, true))
    forceUpdate({})
  }, [])

  /**
   * Collapse all sections
   */
  const collapseAll = useCallback((): void => {
    expandedSectionsStore.clear()
    forceUpdate({})
  }, [])

  return {
    isExpanded,
    toggleSection,
    setExpanded,
    expandSections,
    collapseAll,
  }
}

export default useCollapsibleSections
