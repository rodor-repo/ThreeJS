import { CabinetType } from "../../scene/types"
import { CabinetBuilder } from "./CabinetBuilder"
import { TraditionalCabinetBuilder } from "./TraditionalCabinetBuilder"
import { PanelCabinetBuilder } from "./PanelCabinetBuilder"
import { FillerCabinetBuilder } from "./FillerCabinetBuilder"
import { ApplianceBuilder } from "./ApplianceBuilder"
import {
  KickerBuilder,
  UnderPanelBuilder,
  BulkheadBuilder,
  BenchtopBuilder,
} from "./SimplePanelBuilder"

export * from "./CabinetBuilder"
export * from "./TraditionalCabinetBuilder"
export * from "./PanelCabinetBuilder"
export * from "./FillerCabinetBuilder"
export * from "./SimplePanelBuilder"
export * from "./ApplianceBuilder"
export * from "./builder-constants"

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
      case "benchtop":
        return new BenchtopBuilder()
      case "appliance":
        return new ApplianceBuilder()
      default:
        console.warn(
          `Unknown cabinet type: ${type}, defaulting to TraditionalCabinetBuilder`
        )
        return new TraditionalCabinetBuilder()
    }
  }
}
