import MainPage from '@/components/MainPage'
import { cookies } from 'next/headers'
import { USER_SESSION_COOKIE_NAME } from '@/lib/auth/constants'
import { verifyRoomSessionToken } from '@/lib/auth/session'

type UserSession = {
  email: string | null
  role: 'admin' | 'user' | null
}

async function getUserSession(): Promise<UserSession> {
  const cookieStore = cookies()
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value
  if (!token) return { email: null, role: null }

  const session = await verifyRoomSessionToken(token)
  if (!session || session.role !== 'user') return { email: null, role: null }

  return {
    email: session.email,
    role: session.role,
  }
}

const Page = async () => {
  const { email, role } = await getUserSession()

  return <MainPage userEmail={email} userRole={role} />
}

export default Page
