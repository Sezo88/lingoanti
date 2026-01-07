import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import FractalBackground from '@/components/FractalBackground'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Lingo Türkiye',
    description: 'Çok oyunculu Türkçe kelime tahmin oyunu',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="tr">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#667eea" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body className={inter.className}>
                <FractalBackground />
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    )
}
