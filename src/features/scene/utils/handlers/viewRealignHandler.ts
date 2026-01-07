import _ from "lodash"
import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { updateAllDependentComponents } from "./dependentComponentsHandler"

export interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
  activeViews: Array<{ id: string; [key: string]: any }>
}

/**
 * Realigns all cabinets in a view by forcing a refresh of all dependent components.
 * This fixes misalignment issues that can occur after complex resizing operations.
 */
export function realignViewCabinets(
  viewId: ViewId,
  cabinets: CabinetData[],
  viewManager: Pick<ViewManagerResult, "getCabinetsInView">,
  wallDimensions: WallDimensions
): void {
  const cabinetIds = viewManager.getCabinetsInView(viewId)

  _.each(cabinetIds, (id) => {
    const cabinet = _.find(cabinets, { cabinetId: id })
    if (cabinet) {
      updateAllDependentComponents(cabinet, cabinets, wallDimensions, {
        positionChanged: true,
      })
    }
  })
}

/**
 * Realigns all cabinets in all active views.
 */
export function realignAllViews(
  cabinets: CabinetData[],
  viewManager: ViewManagerResult,
  wallDimensions: WallDimensions
): void {
  _.each(viewManager.activeViews, (view) => {
    realignViewCabinets(
      view.id as ViewId,
      cabinets,
      viewManager,
      wallDimensions
    )
  })
}
