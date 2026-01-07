import { parse } from "mathjs"

export type FormulaStatus = "empty" | "valid" | "invalid"

export const parseFormulaStatus = (
  formula: string
): { status: FormulaStatus; error?: string } => {
  const trimmed = formula.trim()
  if (!trimmed) {
    return { status: "empty" }
  }
  try {
    parse(trimmed)
    return { status: "valid" }
  } catch (error) {
    return {
      status: "invalid",
      error: error instanceof Error ? error.message : "Invalid formula",
    }
  }
}
