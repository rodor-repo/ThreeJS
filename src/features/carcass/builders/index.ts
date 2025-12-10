import { CabinetType } from "../../scene/types"
import { CabinetBuilder } from "./CabinetBuilder"
import { TraditionalCabinetBuilder } from "./TraditionalCabinetBuilder"
import { PanelCabinetBuilder } from "./PanelCabinetBuilder"
import { FillerCabinetBuilder } from "./FillerCabinetBuilder"
import { KickerBuilder, UnderPanelBuilder, BulkheadBuilder } from "./SimplePanelBuilder"

export * from "./CabinetBuilder"
export * from "./TraditionalCabinetBuilder"
export * from "./PanelCabinetBuilder"
export * from "./FillerCabinetBuilder"
export * from "./SimplePanelBuilder"

export class BuilderRegistry {
  static getBuilder(type: CabinetType): CabinetBuilder {
    switch (type) {
      case "base":
      case "top":
      case "tall":
      case "wardrobe":
        return new TraditionalCabinetBuilder()
      case "panel":
        return new PanelCabinetBuilder()
      case "filler":
        return new FillerCabinetBuilder()
      case "kicker":
        return new KickerBuilder()
      case "underPanel":
        return new UnderPanelBuilder()
      case "bulkhead":
        return new BulkheadBuilder()
      default:
        console.warn(`Unknown cabinet type: ${type}, defaulting to TraditionalCabinetBuilder`)
        return new TraditionalCabinetBuilder()
    }
  }
}

