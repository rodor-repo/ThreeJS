import { useMemo, useRef, useState, useEffect } from 'react'
import { ViewManager, type View, type ViewId } from '../ViewManager'
import type { CabinetData } from '@/features/scene/types'

export const useViewManager = (cabinets: CabinetData[]) => {
  const viewManagerRef = useRef<ViewManager | null>(null)
  const [updateTrigger, setUpdateTrigger] = useState(0)
  
  if (!viewManagerRef.current) {
    viewManagerRef.current = new ViewManager()
  }
  
  const viewManager = viewManagerRef.current

  // Sync ViewManager with cabinets state to ensure consistency
  // This fixes bugs where cabinets state has a viewId but ViewManager doesn't know about it
  useEffect(() => {
    let changed = false
    cabinets.forEach(cab => {
      const targetView = (!cab.viewId || cab.viewId === 'none') ? 'none' : cab.viewId
      const currentView = viewManager.getCabinetView(cab.cabinetId) || 'none'
      
      if (currentView !== targetView) {
        viewManager.assignCabinetToView(cab.cabinetId, targetView as ViewId)
        changed = true
      }
    })
    
    if (changed) {
      setUpdateTrigger(prev => prev + 1)
    }
  }, [cabinets, viewManager])

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
