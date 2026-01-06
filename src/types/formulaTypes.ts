export type FormulaPiece = {
  id: string
  label: string
  token: string
  group: string
}

export type ViewGDFormulaMap = Record<string, string>
export type ViewGDFormulas = Record<string, ViewGDFormulaMap>

export const APPLIANCE_FORMULA_DIMENSIONS = [
  { id: "appliance:width", label: "Appliance Width" },
  { id: "appliance:height", label: "Appliance Height" },
  { id: "appliance:depth", label: "Appliance Depth" },
  { id: "appliance:gapTop", label: "Top Gap" },
  { id: "appliance:gapLeft", label: "Left Gap" },
  { id: "appliance:gapRight", label: "Right Gap" },
  { id: "appliance:kickerHeight", label: "Kicker Height" },
] as const

export type ApplianceFormulaDimId =
  (typeof APPLIANCE_FORMULA_DIMENSIONS)[number]["id"]

export const APPLIANCE_FORMULA_DIM_ID_SET = new Set(
  APPLIANCE_FORMULA_DIMENSIONS.map((entry) => entry.id)
)

export const BENCHTOP_FORMULA_DIMENSIONS = [
  { id: "benchtop:heightFromFloor", label: "Height From Floor" },
  { id: "benchtop:thickness", label: "Benchtop Thickness" },
  { id: "benchtop:frontOverhang", label: "Front Overhang" },
  { id: "benchtop:leftOverhang", label: "Left Overhang" },
  { id: "benchtop:rightOverhang", label: "Right Overhang" },
] as const

export type BenchtopFormulaDimId =
  (typeof BENCHTOP_FORMULA_DIMENSIONS)[number]["id"]

export const BENCHTOP_FORMULA_DIM_ID_SET = new Set(
  BENCHTOP_FORMULA_DIMENSIONS.map((entry) => entry.id)
)

export const FILLER_PANEL_FORMULA_DIMENSIONS = [
  { id: "fillerPanel:offTheFloor", label: "Off The Floor" },
] as const

export type FillerPanelFormulaDimId =
  (typeof FILLER_PANEL_FORMULA_DIMENSIONS)[number]["id"]

export const FILLER_PANEL_FORMULA_DIM_ID_SET = new Set(
  FILLER_PANEL_FORMULA_DIMENSIONS.map((entry) => entry.id)
)
