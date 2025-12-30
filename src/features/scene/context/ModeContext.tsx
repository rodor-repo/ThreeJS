import { useCallback } from "react"
import { useQueryState } from "nuqs"

export type AppMode = "admin" | "user"

export const useAppMode = () => {
	const [modeParam, setModeParam] = useQueryState("mode")
	const mode: AppMode = modeParam === "admin" ? "admin" : "user"

	const setMode = useCallback((nextMode: AppMode) => setModeParam(nextMode), [setModeParam])

	return [mode, setMode] as const
}
