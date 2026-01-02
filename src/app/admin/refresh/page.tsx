import Link from 'next/link'
import { cookies } from 'next/headers'
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react'
import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth/constants'
import { verifyRoomSessionToken } from '@/lib/auth/session'
import { clearAllSwrCaches } from '@/server/swrCache'

export const dynamic = 'force-dynamic'

type UserSession = {
  email: string | null
  role: 'admin' | 'user' | null
}

async function getAdminSession(): Promise<UserSession> {
  const cookieStore = cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value
  if (!token) return { email: null, role: null }

  const session = await verifyRoomSessionToken(token)
  if (!session || session.role !== 'admin') return { email: null, role: null }

  return {
    email: session.email,
    role: session.role,
  }
}

const Page = async () => {
  const { email, role } = await getAdminSession()
  const isAdmin = role === 'admin'

  if (isAdmin) {
    clearAllSwrCaches()
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-yellow-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-200/40 via-transparent to-transparent" />
      <div className="relative mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <div className="w-full overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl shadow-yellow-500/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-2xl p-2.5 text-white shadow-lg ${isAdmin
                    ? 'bg-yellow-500 shadow-yellow-500/30'
                    : 'bg-gray-400 shadow-gray-300/30'
                  }`}
              >
                <RefreshCw size={18} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Admin tools
                </p>
                <h1 className="text-lg font-bold text-gray-900">Cache refresh</h1>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}
            >
              {isAdmin ? 'Refresh complete' : 'Access denied'}
            </span>
          </div>

          <div className="space-y-4 px-6 py-6">
            {isAdmin ? (
              <>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-semibold">SWR cache cleared</span>
                  </div>
                  <p className="mt-2 text-sm text-emerald-700/80">
                    Cached entries were removed for this server instance. Refresh any
                    page to pull fresh data.
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    <span>Session</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Admin
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {email ? `Signed in as ${email}.` : 'Signed in with an admin account.'}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <div className="flex items-center gap-2 text-red-600">
                  <ShieldAlert size={18} />
                  <span className="text-sm font-semibold">Admin access required</span>
                </div>
                <p className="mt-2 text-sm text-red-600/80">
                  Sign in with an admin account to clear cached data.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-white/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Data refresh
            </p>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-gray-900/20 transition hover:bg-gray-800"
              href="/admin"
            >
              <ArrowLeft size={14} />
              Back to admin
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Page
