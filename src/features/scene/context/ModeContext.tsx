import { createContext, useContext } from "react"

export type AppMode = "admin" | "user"

export const ModeContext = createContext<AppMode>("admin")

export const useAppMode = () => useContext(ModeContext)
