import React from 'react'
import TrackerScript from '@/components/tracker-script'


interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <TrackerScript />
      {children}
    </>
  )
}