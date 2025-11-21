export type ViewId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" | "none"

export interface View {
  id: ViewId
  name: string
  cabinetIds: Set<string>
}

export class ViewManager {
  private views: Map<ViewId, View> = new Map()
  private cabinetToView: Map<string, ViewId> = new Map() // cabinetId -> viewId
  private nextViewIndex: number = 0 // For generating next view letter

  constructor() {
    // Don't create default view - start with none
  }

  /**
   * Get all active views (excluding "none")
   */
  getActiveViews(): View[] {
    return Array.from(this.views.values()).filter(v => v.id !== "none")
  }

  /**
   * Get a specific view by ID
   */
  getView(viewId: ViewId): View | undefined {
    return this.views.get(viewId)
  }

  /**
   * Create a new view with the next available letter
   */
  createView(): View {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if (this.nextViewIndex >= letters.length) {
      throw new Error("Maximum number of views reached (26)")
    }
    
    const viewId = letters[this.nextViewIndex] as ViewId
    this.nextViewIndex++
    
    const view: View = {
      id: viewId,
      name: `View ${viewId}`,
      cabinetIds: new Set(),
    }
    
    this.views.set(viewId, view)
    return view
  }

  /**
   * Assign a cabinet to a view
   * If viewId is "none", removes the cabinet from any view
   */
  assignCabinetToView(cabinetId: string, viewId: ViewId): void {
    // Remove from previous view if any
    const previousViewId = this.cabinetToView.get(cabinetId)
    if (previousViewId) {
      const previousView = this.views.get(previousViewId)
      if (previousView) {
        previousView.cabinetIds.delete(cabinetId)
      }
    }

    // If viewId is "none", just remove from view mapping
    if (viewId === "none") {
      this.cabinetToView.delete(cabinetId)
      return
    }

    // Add to new view
    const view = this.views.get(viewId)
    if (!view) {
      throw new Error(`View ${viewId} does not exist`)
    }

    view.cabinetIds.add(cabinetId)
    this.cabinetToView.set(cabinetId, viewId)
  }

  /**
   * Delete a view and unassign all cabinets from it
   */
  deleteView(viewId: ViewId): void {
    if (viewId === "none") {
      throw new Error("Cannot delete 'none' view")
    }
    
    const view = this.views.get(viewId)
    if (!view) {
      return
    }

    // Remove all cabinets from this view
    view.cabinetIds.forEach((cabinetId) => {
      this.cabinetToView.delete(cabinetId)
    })

    this.views.delete(viewId)
  }

  /**
   * Get the view ID for a cabinet
   */
  getCabinetView(cabinetId: string): ViewId | undefined {
    return this.cabinetToView.get(cabinetId)
  }

  /**
   * Get all cabinet IDs in a view
   */
  getCabinetsInView(viewId: ViewId): string[] {
    const view = this.views.get(viewId)
    if (!view) {
      return []
    }
    return Array.from(view.cabinetIds)
  }

  /**
   * Check if two cabinets are in the same view
   */
  areCabinetsInSameView(cabinetId1: string, cabinetId2: string): boolean {
    const view1 = this.cabinetToView.get(cabinetId1)
    const view2 = this.cabinetToView.get(cabinetId2)
    
    if (!view1 || !view2 || view1 === "none" || view2 === "none") {
      return false
    }
    
    return view1 === view2
  }

}
