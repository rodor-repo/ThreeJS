'use client'

import dynamic from 'next/dynamic'

// Dynamically import the Three.js component to avoid SSR issues
const ThreeScene = dynamic(() => import('../components/ThreeScene'), {
  ssr: false,
  loading: () => <div>Loading 3D Scene...</div>
})

export default function Home() {
  return (
    <main className="h-screen w-full">
      <ThreeScene />
    </main>
  )
}
