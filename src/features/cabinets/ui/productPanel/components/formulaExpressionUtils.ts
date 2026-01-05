import type { FormulaPiece } from "@/types/formulaTypes"
import { parsePieceGroup } from "./formulaPieceUtils"

export type TokenKind = "operator" | "identifier" | "number" | "punctuation" | "unknown"

export type FormulaSegment =
  | {
      type: "piece"
      token: string
      label: string
      start: number
      end: number
      pieceId: string
    }
  | {
      type: "token"
      value: string
      kind: TokenKind
      start: number
      end: number
    }
  | {
      type: "whitespace"
      value: string
      start: number
      end: number
    }

const formatCabinetLabel = (label: string) => {
  const match = label.match(/#\d+/)
  if (match) return match[0]
  return label
}

export const formatPieceLabel = (piece: FormulaPiece): string => {
  const { cabinetLabel } = parsePieceGroup(piece.group)
  const cabinetDisplay = formatCabinetLabel(cabinetLabel)
  return `${cabinetDisplay} ${piece.label}`
}

export const buildFormulaSegments = (
  formula: string,
  pieces: FormulaPiece[]
): FormulaSegment[] => {
  if (!formula) {
    return [
      {
        type: "whitespace",
        value: "",
        start: 0,
        end: 0,
      },
    ]
  }

  const tokenMap = new Map(pieces.map((piece) => [piece.token, piece]))
  const tokens = Array.from(tokenMap.keys()).sort(
    (a, b) => b.length - a.length
  )

  if (tokens.length === 0) {
    return [
      {
        type: "token",
        value: formula,
        kind: "unknown",
        start: 0,
        end: formula.length,
      },
    ]
  }

  const segments: FormulaSegment[] = []
  let lastIndex = 0

  const tokensByFirstChar = new Map<string, string[]>()
  tokens.forEach((token) => {
    const key = token[0]
    const list = tokensByFirstChar.get(key) || []
    list.push(token)
    tokensByFirstChar.set(key, list)
  })

  while (lastIndex < formula.length) {
    const currentChar = formula[lastIndex]
    const candidates = tokensByFirstChar.get(currentChar)
    let matchedToken: string | null = null

    if (candidates) {
      for (const candidate of candidates) {
        if (formula.startsWith(candidate, lastIndex)) {
          matchedToken = candidate
          break
        }
      }
    }

    if (matchedToken) {
      const piece = tokenMap.get(matchedToken)
      if (piece) {
        segments.push({
          type: "piece",
          token: matchedToken,
          label: formatPieceLabel(piece),
          start: lastIndex,
          end: lastIndex + matchedToken.length,
          pieceId: piece.id,
        })
      } else {
        segments.push({
          type: "token",
          value: matchedToken,
          kind: "unknown",
          start: lastIndex,
          end: lastIndex + matchedToken.length,
        })
      }
      lastIndex += matchedToken.length
      continue
    }

    const nextToken = readNextToken(formula.slice(lastIndex), lastIndex)
    segments.push(nextToken.segment)
    lastIndex += nextToken.length
  }

  return segments
}

export const replaceFormulaRange = (
  formula: string,
  start: number,
  end: number,
  replacement: string
) => `${formula.slice(0, start)}${replacement}${formula.slice(end)}`

export const removeFormulaRange = (
  formula: string,
  start: number,
  end: number
) => {
  const next = `${formula.slice(0, start)}${formula.slice(end)}`
  return next.replace(/\s{2,}/g, " ").trim()
}

export const isInteractiveSegment = (
  segment: FormulaSegment
): segment is Exclude<FormulaSegment, { type: "whitespace" }> =>
  segment.type !== "whitespace"

const MULTI_CHAR_OPERATORS = [">=", "<=", "==", "!=", "&&", "||"]
const SINGLE_CHAR_OPERATORS = ["+", "-", "*", "/", "%", "^"]
const PUNCTUATION_CHARS = ["(", ")", ",", ":", "?"]

const readNextToken = (
  text: string,
  offset: number
): { segment: FormulaSegment; length: number } => {
  const whitespaceMatch = text.match(/^\s+/)
  if (whitespaceMatch) {
    const value = whitespaceMatch[0]
    return {
      segment: {
        type: "whitespace",
        value,
        start: offset,
        end: offset + value.length,
      },
      length: value.length,
    }
  }

  const multiOperator = MULTI_CHAR_OPERATORS.find((op) => text.startsWith(op))
  if (multiOperator) {
    return {
      segment: {
        type: "token",
        value: multiOperator,
        kind: "operator",
        start: offset,
        end: offset + multiOperator.length,
      },
      length: multiOperator.length,
    }
  }

  const firstChar = text[0]
  if (SINGLE_CHAR_OPERATORS.includes(firstChar)) {
    return {
      segment: {
        type: "token",
        value: firstChar,
        kind: "operator",
        start: offset,
        end: offset + 1,
      },
      length: 1,
    }
  }

  if (PUNCTUATION_CHARS.includes(firstChar)) {
    return {
      segment: {
        type: "token",
        value: firstChar,
        kind: "punctuation",
        start: offset,
        end: offset + 1,
      },
      length: 1,
    }
  }

  const numberMatch = text.match(/^\d*\.?\d+(?:e[+-]?\d+)?/i)
  if (numberMatch) {
    const value = numberMatch[0]
    return {
      segment: {
        type: "token",
        value,
        kind: "number",
        start: offset,
        end: offset + value.length,
      },
      length: value.length,
    }
  }

  const identifierMatch = text.match(/^[A-Za-z_][A-Za-z0-9_]*/)
  if (identifierMatch) {
    const value = identifierMatch[0]
    return {
      segment: {
        type: "token",
        value,
        kind: "identifier",
        start: offset,
        end: offset + value.length,
      },
      length: value.length,
    }
  }

  return {
    segment: {
      type: "token",
      value: firstChar,
      kind: "unknown",
      start: offset,
      end: offset + 1,
    },
    length: 1,
  }
}
