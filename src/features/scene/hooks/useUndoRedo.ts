import { useCallback, useRef, useState } from "react"
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
  applyDimensions: (dimensions: WallDims, color?: string) => void
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
  const [past, setPast] = useState<SavedRoom[]>([])
  const [future, setFuture] = useState<SavedRoom[]>([])
  const isRestoring = useRef(false)
  const {
    activeViews,
    viewManager: viewManagerInstance,
    createView,
    assignCabinetToView,
    getCabinetView,
  } = viewManager

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

    setPast((prev) => {
      // Limit history size to 20
      const newPast = [...prev, currentState]
      if (newPast.length > 20) {
        return newPast.slice(newPast.length - 20)
      }
      return newPast
    })
    setFuture([])
  }, [getSnapshot])

  const undo = useCallback(async () => {
    if (past.length === 0 || isRestoring.current) return

    const newPast = [...past]
    const previousState = newPast.pop()
    // In manual mode, we don't save the current "drifting" state to future unless it was checkpointed.
    // But to allow Redo to work for the checkpoint we just undid, we push the *current* state (which is effectively the checkpoint we are leaving?)
    // No, if we are at B (checkpointed), and undo to A. We want to be able to Redo to B.
    // So we push B to future.
    // But wait, if we are at C (unsaved), and undo to B.
    // We lose C.
    // We load B.
    // So we should push B to future? No, if we load B, we are at B.
    // If we undo AGAIN (to A), then we push B to future.

    // Let's assume the user clicked Checkpoint at B. So B is in `past`.
    // Current state is C (unsaved).
    // Undo -> Load B.
    // `past` has B.
    // We pop B.
    // We restore B.
    // We push B to future.
    // So `past`=[A], `future`=[B]. Current=B.

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

      // New past includes everything up to and including the target index
      // But wait, if we restore targetState, it is the "current" state.
      // In our undo logic:
      // Undo -> pops from past, pushes to future. Restores.
      // So "current" is NOT in past.
      // So if we restore targetState, past should be everything BEFORE it.
      // And future should be everything AFTER it.
      // And targetState itself is "current" (not in either list? or in future[0]?)

      // Let's stick to the pattern established by Undo:
      // When we Undo to B. past=[A], future=[B].
      // So if we jump to index 1 (B).
      // past should be [A]. future should be [B, ...rest].

      const newPast = allCheckpoints.slice(0, index)
      const newFuture = allCheckpoints.slice(index)

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

  return {
    undo,
    redo,
    createCheckpoint,
    jumpTo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    past,
    future,
  }
}
