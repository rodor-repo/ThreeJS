import { useCallback, useEffect, useRef, useState } from "react"
import { SavedRoom } from "@/data/savedRooms"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetData, WallDimensions as WallDims } from "../types"
import type { View, ViewId, ViewManager } from "@/features/cabinets/ViewManager"
import {
  serializeRoom,
  restoreRoom,
  type CreateCabinetFn,
} from "../utils/roomPersistenceUtils"

type CabinetGroupsMap = Map<
  string,
  Array<{ cabinetId: string; percentage: number }>
>
type CabinetSyncsMap = Map<string, string[]>

export interface Checkpoint extends SavedRoom {
  type: "manual" | "auto"
}

type UseUndoRedoOptions = {
  cabinets: CabinetData[]
  cabinetGroups: CabinetGroupsMap
  setCabinetGroups: (
    groups: CabinetGroupsMap | ((prev: CabinetGroupsMap) => CabinetGroupsMap)
  ) => void
  cabinetSyncs: CabinetSyncsMap
  setCabinetSyncs: (
    syncs: CabinetSyncsMap | ((prev: CabinetSyncsMap) => CabinetSyncsMap)
  ) => void
  wallDimensions: WallDims
  wallColor: string
  setWallColor: (color: string) => void
  applyDimensions: (
    dimensions: WallDims,
    color?: string,
    zoomLevel?: number,
    preserveCamera?: boolean
  ) => void
  viewManager: {
    activeViews: View[]
    viewManager: ViewManager
    createView: () => View
    assignCabinetToView: (cabinetId: string, viewId: ViewId) => void
    getCabinetView: (cabinetId: string) => ViewId | undefined
  }
  wsProducts?: WsProducts | null
  setNumbersVisible: (visible: boolean) => void
  clearCabinets: () => void
  createCabinet: CreateCabinetFn
  updateCabinetViewId: (cabinetId: string, viewId: ViewId | undefined) => void
  updateCabinetLock: (
    cabinetId: string,
    leftLock: boolean,
    rightLock: boolean
  ) => void
}

export const useUndoRedo = ({
  cabinets,
  cabinetGroups,
  setCabinetGroups,
  cabinetSyncs,
  setCabinetSyncs,
  wallDimensions,
  wallColor,
  setWallColor,
  applyDimensions,
  viewManager,
  wsProducts,
  setNumbersVisible,
  clearCabinets,
  createCabinet,
  updateCabinetViewId,
  updateCabinetLock,
}: UseUndoRedoOptions) => {
  const [past, setPast] = useState<Checkpoint[]>([])
  const [future, setFuture] = useState<Checkpoint[]>([])
  const isRestoring = useRef(false)
  const lastAutoSaveRef = useRef<number>(Date.now())
  const lastAutoSaveContentRef = useRef<string>("")
  const {
    activeViews,
    viewManager: viewManagerInstance,
    createView,
    assignCabinetToView,
    getCabinetView,
  } = viewManager

  // Helper to get content string for comparison
  const getRoomContentString = (room: SavedRoom) => {
    const { id, savedAt, ...content } = room
    return JSON.stringify(content)
  }

  // Serialize current state to SavedRoom
  const getSnapshot = useCallback((): SavedRoom => {
    return serializeRoom({
      cabinets,
      cabinetGroups,
      wallDimensions,
      wallColor,
      activeViews,
      getCabinetView,
      wsProducts,
      roomName: "Snapshot",
      roomCategory: "Kitchen",
      cabinetSyncs,
    })
  }, [
    cabinets,
    cabinetGroups,
    cabinetSyncs,
    wallDimensions,
    wallColor,
    wsProducts,
    activeViews,
    getCabinetView,
  ])

  // Manual checkpoint creation
  const createCheckpoint = useCallback(() => {
    if (isRestoring.current) return

    const currentState = getSnapshot()

    // Update last known content so auto-save doesn't duplicate if no changes happen
    const contentString = getRoomContentString(currentState)
    lastAutoSaveContentRef.current = contentString

    const checkpoint: Checkpoint = { ...currentState, type: "manual" }

    setPast((prev) => {
      // Limit history size to 50 to accommodate auto-saves
      const newPast = [...prev, checkpoint]
      if (newPast.length > 50) {
        return newPast.slice(newPast.length - 50)
      }
      return newPast
    })
    setFuture([])
  }, [getSnapshot])

  // Auto-save logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRestoring.current) return

      const now = Date.now()
      // Check if 5 seconds have passed (should be guaranteed by setInterval, but good for safety)
      if (now - lastAutoSaveRef.current < 5000) return

      const currentState = getSnapshot()
      const contentString = getRoomContentString(currentState)

      // Skip if content hasn't changed since last save (manual or auto)
      if (contentString === lastAutoSaveContentRef.current) {
        lastAutoSaveRef.current = now
        return
      }

      lastAutoSaveContentRef.current = contentString
      const checkpoint: Checkpoint = { ...currentState, type: "auto" }

      setPast((prev) => {
        // Pruning logic
        // Keep all manual checkpoints
        // Keep auto checkpoints from last 60s
        // Keep auto checkpoints from last 20m (one per minute approx)

        const newPast = [...prev, checkpoint]

        return newPast.filter((cp) => {
          if (cp.type === "manual") return true

          const age = now - new Date(cp.savedAt).getTime()

          // Keep if less than 60 seconds old
          if (age < 60000) return true

          // Keep if less than 20 minutes old AND it's roughly on the minute mark
          // We use the timestamp to determine if it's a "minute marker"
          // e.g. if seconds part of timestamp is < 5
          if (age < 1200000) {
            const seconds = new Date(cp.savedAt).getSeconds()
            return seconds < 5
          }

          return false
        })
      })

      lastAutoSaveRef.current = now
    }, 5000)

    return () => clearInterval(interval)
  }, [getSnapshot])

  const undo = useCallback(async () => {
    if (past.length === 0 || isRestoring.current) return

    const newPast = [...past]
    const previousState = newPast.pop()

    if (previousState) {
      isRestoring.current = true
      setPast(newPast)
      setFuture((prev) => [previousState, ...prev])

      await restoreRoom({
        savedRoom: previousState,
        setNumbersVisible,
        clearCabinets,
        setCabinetGroups,
        applyDimensions,
        setWallColor,
        viewManagerInstance,
        createView,
        createCabinet,
        updateCabinetViewId,
        assignCabinetToView,
        updateCabinetLock,
        setCabinetSyncs,
      })

      isRestoring.current = false
    }
  }, [
    past,
    setNumbersVisible,
    clearCabinets,
    setCabinetGroups,
    applyDimensions,
    setWallColor,
    viewManagerInstance,
    createView,
    createCabinet,
    updateCabinetViewId,
    assignCabinetToView,
    updateCabinetLock,
    setCabinetSyncs,
  ])

  const redo = useCallback(async () => {
    if (future.length === 0 || isRestoring.current) return

    const newFuture = [...future]
    const nextState = newFuture.shift()

    if (nextState) {
      isRestoring.current = true
      setFuture(newFuture)
      setPast((prev) => [...prev, nextState])

      await restoreRoom({
        savedRoom: nextState,
        setNumbersVisible,
        clearCabinets,
        setCabinetGroups,
        applyDimensions,
        setWallColor,
        viewManagerInstance,
        createView,
        createCabinet,
        updateCabinetViewId,
        assignCabinetToView,
        updateCabinetLock,
        setCabinetSyncs,
      })

      isRestoring.current = false
    }
  }, [
    future,
    setNumbersVisible,
    clearCabinets,
    setCabinetGroups,
    applyDimensions,
    setWallColor,
    viewManagerInstance,
    createView,
    createCabinet,
    updateCabinetViewId,
    assignCabinetToView,
    updateCabinetLock,
    setCabinetSyncs,
  ])

  const jumpTo = useCallback(
    async (index: number) => {
      if (isRestoring.current) return

      const allCheckpoints = [...past, ...future]
      if (index < 0 || index >= allCheckpoints.length) return

      const targetState = allCheckpoints[index]

      // Fix: Include the target state in 'past' so that subsequent checkpoints append after it
      const newPast = allCheckpoints.slice(0, index + 1)
      const newFuture = allCheckpoints.slice(index + 1)

      isRestoring.current = true
      setPast(newPast)
      setFuture(newFuture)

      await restoreRoom({
        savedRoom: targetState,
        setNumbersVisible,
        clearCabinets,
        setCabinetGroups,
        applyDimensions,
        setWallColor,
        viewManagerInstance,
        createView,
        createCabinet,
        updateCabinetViewId,
        assignCabinetToView,
        updateCabinetLock,
        setCabinetSyncs,
      })

      isRestoring.current = false
    },
    [
      past,
      future,
      setNumbersVisible,
      clearCabinets,
      setCabinetGroups,
      applyDimensions,
      setWallColor,
      viewManagerInstance,
      createView,
      createCabinet,
      updateCabinetViewId,
      assignCabinetToView,
      updateCabinetLock,
      setCabinetSyncs,
    ]
  )

  const deleteCheckpoint = useCallback((index: number) => {
    const allCheckpoints = [...past, ...future]
    if (index < 0 || index >= allCheckpoints.length) return

    // If the deleted index is in past
    if (index < past.length) {
      const newPast = [...past]
      newPast.splice(index, 1)
      setPast(newPast)
    } else {
      // If the deleted index is in future
      const futureIndex = index - past.length
      const newFuture = [...future]
      newFuture.splice(futureIndex, 1)
      setFuture(newFuture)
    }
  }, [past, future])

  const resetHistory = useCallback((initialState?: SavedRoom) => {
    setPast([])
    setFuture([])
    
    let checkpoint: Checkpoint;
    
    if (initialState) {
      checkpoint = { ...initialState, type: "manual" }
      // Also update content ref
      const contentString = getRoomContentString(initialState)
      lastAutoSaveContentRef.current = contentString
    } else {
      // Create initial checkpoint from current state
      const currentState = getSnapshot()
      const contentString = getRoomContentString(currentState)
      lastAutoSaveContentRef.current = contentString
      checkpoint = { ...currentState, type: "manual" }
    }
    
    setPast([checkpoint])
  }, [getSnapshot])

  return {
    undo,
    redo,
    createCheckpoint,
    deleteCheckpoint,
    resetHistory,
    jumpTo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    past,
    future,
  }
}
