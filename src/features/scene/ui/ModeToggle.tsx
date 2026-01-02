'use client'

import React, { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Shield, User } from 'lucide-react'
import _ from 'lodash'

interface ModeToggleProps {
  selectedMode: 'admin' | 'user'
  onModeChange: (mode: 'admin' | 'user') => void
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ selectedMode, onModeChange }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAdminRoute = pathname?.startsWith('/admin')
  const showAdminPageButton = process.env.NEXT_PUBLIC_SHOW_ADMIN_PAGE_BUTTON === 'true'

  const cx = (...classes: Array<string | false | null | undefined>) => _.join(_.compact(classes), ' ')

  const userPath = useMemo(() => {
    const path = pathname || '/'
    if (path === '/admin') return '/'
    if (path.startsWith('/admin/')) return `/${path.slice('/admin/'.length)}`
    return path
  }, [pathname])

  const adminPath = useMemo(() => {
    if (userPath === '/') return '/admin'
    return `/admin${userPath.startsWith('/') ? userPath : `/${userPath}`}`
  }, [userPath])

  const cleanedParams = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString())
    params.delete('mode')
    params.delete('showUserView')
    return params.toString()
  }, [searchParams])

  const adminHref = useMemo(() => {
    return cleanedParams ? `${adminPath}?${cleanedParams}` : adminPath
  }, [adminPath, cleanedParams])

  const userHref = useMemo(() => {
    return cleanedParams ? `${userPath}?${cleanedParams}` : userPath
  }, [cleanedParams, userPath])

  if (!isAdminRoute) {
    if (!showAdminPageButton) return null

    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[80]">
        <div className="rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 p-2">
          <a
            href={adminHref}
            target="_blank"
            rel="noreferrer"
            className={cx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
              'bg-gray-900 text-white font-bold text-sm',
              'shadow-lg shadow-black/20',
              'hover:bg-gray-800 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white/50'
            )}
          >
            <Shield size={16} className="text-yellow-500" />
            Open Admin Mode
            <ExternalLink size={14} className="opacity-80" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[80]">
      <div className="flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 p-2">
        <label className="relative cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="admin"
            checked={selectedMode === 'admin'}
            onChange={(e) => onModeChange(e.target.value as 'admin' | 'user')}
            className="sr-only peer"
          />
          <div
            className={cx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl select-none',
              'text-sm font-bold transition-all',
              'border border-transparent',
              'bg-gray-50 text-gray-700',
              selectedMode !== 'admin' && 'hover:bg-gray-100',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-500/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white/50',
              selectedMode === 'admin' && 'bg-gray-900 text-white shadow-lg shadow-black/20 border-white/10'
            )}
          >
            <Shield size={16} className={cx(selectedMode === 'admin' ? 'text-yellow-500' : 'text-gray-400')} />
            Admin Mode
          </div>
        </label>
        <label className="relative cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="user"
            checked={selectedMode === 'user'}
            onChange={(e) => onModeChange(e.target.value as 'admin' | 'user')}
            className="sr-only peer"
          />
          <div
            className={cx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl select-none',
              'text-sm font-bold transition-all',
              'border border-transparent',
              'bg-gray-50 text-gray-700',
              selectedMode !== 'user' && 'hover:bg-gray-100',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-500/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white/50',
              selectedMode === 'user' && 'bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/20 border-yellow-400/40'
            )}
          >
            <User size={16} className={cx(selectedMode === 'user' ? 'text-gray-900' : 'text-gray-400')} />
            User Preview
          </div>
        </label>
        <Link
          href={userHref}
          target="_blank"
          onClick={(e) => {
            if (selectedMode !== 'user') e.preventDefault()
          }}
          className={cx(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
            'text-sm font-bold transition-all',
            'bg-white/70 text-gray-700 hover:bg-white',
            'border border-gray-200/70',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white/50',
            selectedMode !== 'user' && 'opacity-40 pointer-events-none'
          )}
        >
          Open Actual User Mode
          <ExternalLink size={14} className="opacity-70" />
        </Link>
      </div>
    </div>
  )
}
