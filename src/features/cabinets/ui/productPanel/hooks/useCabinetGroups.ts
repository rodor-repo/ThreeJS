import { useState, useCallback, useEffect } from "react"

/**
 * Grouped cabinet data for pair section
 */
export interface GroupCabinet {
  cabinetId: string
  percentage: number
}

/**
 * Options for the useCabinetGroups hook
 */
export interface UseCabinetGroupsOptions {
  cabinetId: string | undefined
  initialGroupData?: GroupCabinet[]
  initialSyncData?: string[]
  onGroupChange?: (cabinetId: string, group: GroupCabinet[]) => void
  onSyncChange?: (cabinetId: string, sync: string[]) => void
}

/**
 * Return type for the useCabinetGroups hook
 */
export interface UseCabinetGroupsReturn {
  groupCabinets: GroupCabinet[]
  syncCabinets: string[]
  handleGroupChange: (newGroup: GroupCabinet[]) => void
  handleSyncChange: (newSyncList: string[]) => void
}

/**
 * Hook to manage cabinet grouping and sync state.
 *
 * Handles:
 * - Group cabinets (for paired percentage distribution)
 * - Sync cabinets (for synchronized dimension updates)
 * - Loading initial data when cabinet changes
 * - Propagating changes to parent callbacks
 */
export function useCabinetGroups(
  options: UseCabinetGroupsOptions
): UseCabinetGroupsReturn {
  const {
    cabinetId,
    initialGroupData,
    initialSyncData,
    onGroupChange,
    onSyncChange,
  } = options

  const [groupCabinets, setGroupCabinets] = useState<GroupCabinet[]>([])
  const [syncCabinets, setSyncCabinets] = useState<string[]>([])

  // Load group/sync data when selected cabinet changes
  useEffect(() => {
    if (cabinetId) {
      if (initialGroupData && initialGroupData.length > 0) {
        setGroupCabinets([...initialGroupData])
      } else {
        setGroupCabinets([])
      }
      if (initialSyncData && initialSyncData.length > 0) {
        setSyncCabinets([...initialSyncData])
      } else {
        setSyncCabinets([])
      }
    }
  }, [cabinetId, initialGroupData, initialSyncData])

  // Handle group changes
  const handleGroupChange = useCallback(
    (newGroup: GroupCabinet[]) => {
      setGroupCabinets(newGroup)
      if (cabinetId && onGroupChange) {
        onGroupChange(cabinetId, newGroup)
      }
    },
    [cabinetId, onGroupChange]
  )

  // Handle sync changes
  const handleSyncChange = useCallback(
    (newSyncList: string[]) => {
      setSyncCabinets(newSyncList)
      if (cabinetId && onSyncChange) {
        onSyncChange(cabinetId, newSyncList)
      }
    },
    [cabinetId, onSyncChange]
  )

  return {
    groupCabinets,
    syncCabinets,
    handleGroupChange,
    handleSyncChange,
  }
}
