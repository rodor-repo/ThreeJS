export type FormulaPiece = {
  id: string
  label: string
  token: string
  group: string
}

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
