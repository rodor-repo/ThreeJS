'use client'

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type AppMode = "admin" | "user"

export const useAppMode = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isAdminRoute = pathname?.startsWith("/admin")
  const showUserView = searchParams?.get("showUserView") === "true"
  const mode: AppMode = isAdminRoute
    ? showUserView
      ? "user"
      : "admin"
    : "user"

  const setMode = useCallback((nextMode: AppMode) => {
    const rawQuery = typeof window !== "undefined"
      ? window.location.search
      : searchParams?.toString()
    const currentQuery = rawQuery?.startsWith("?") ? rawQuery.slice(1) : rawQuery
    const params = new URLSearchParams(currentQuery)
    params.delete("mode")
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname

    if (isAdminRoute) {
      if (nextMode === "user") {
        params.set("showUserView", "true")
      } else {
        params.delete("showUserView")
      }
      const query = params.toString()
      const nextUrl = query ? `${pathname}?${query}` : pathname
      if (nextUrl === currentUrl) return
      router.push(nextUrl)
      return
    }

    const nextPath = nextMode === "admin" ? "/admin" : "/"
    params.delete("showUserView")
    const query = params.toString()
    const nextUrl = query ? `${nextPath}?${query}` : nextPath

    if (nextUrl === currentUrl) return
    router.push(nextUrl)
  }, [isAdminRoute, pathname, router, searchParams])

  return [mode, setMode] as const
}
