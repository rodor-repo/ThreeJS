import { useMemo, useRef, useState } from 'react'
import { ViewManager, type View, type ViewId } from '../ViewManager'
import type { CabinetData } from '@/features/scene/types'

export const useViewManager = (cabinets: CabinetData[]) => {
  const viewManagerRef = useRef<ViewManager | null>(null)
  const [updateTrigger, setUpdateTrigger] = useState(0)
  
  if (!viewManagerRef.current) {
    viewManagerRef.current = new ViewManager()
  }
  
  const viewManager = viewManagerRef.current

  const activeViews = useMemo(() => viewManager.getActiveViews(), [updateTrigger])

  const assignCabinetToView = (cabinetId: string, viewId: ViewId) => {
    viewManager.assignCabinetToView(cabinetId, viewId)
    setUpdateTrigger(prev => prev + 1) // Trigger re-render
  }

  const createView = () => {
    const newView = viewManager.createView()
    setUpdateTrigger(prev => prev + 1) // Trigger re-render
    return newView
  }

  const deleteView = (viewId: ViewId) => {
    viewManager.deleteView(viewId)
    setUpdateTrigger(prev => prev + 1) // Trigger re-render
  }

  const getCabinetView = (cabinetId: string): ViewId | undefined => {
    return viewManager.getCabinetView(cabinetId)
  }

  const getCabinetsInView = (viewId: ViewId): string[] => {
    return viewManager.getCabinetsInView(viewId)
  }

  const areCabinetsInSameView = (cabinetId1: string, cabinetId2: string): boolean => {
    return viewManager.areCabinetsInSameView(cabinetId1, cabinetId2)
  }


  return {
    activeViews,
    assignCabinetToView,
    createView,
    deleteView,
    getCabinetView,
    getCabinetsInView,
    areCabinetsInSameView,
    viewManager,
  }
}
