import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { FetchSanitizer } from '@/components/FetchSanitizer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Big AI 考勤系统',
  description: 'Big AI Sdn Bhd 员工请假与考勤管理系统',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3B82F6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased`}>
        <FetchSanitizer />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
