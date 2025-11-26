import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from './QueryProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Three.js + Next.js Website',
  description: 'A modern website built with Three.js, Next.js, and TypeScript',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster
          position="top-center"
          containerStyle={{
            top: "50%",
            transform: "translateY(-50%)",
          }}
          toastOptions={{
            style: {
              fontSize: "1.25rem",
              padding: "1rem 1.5rem",
              minWidth: "300px",
              fontWeight: 500,
            },
            loading: {
              duration: Infinity,
            },
          }}
        />
      </body>
    </html>
  )
}
