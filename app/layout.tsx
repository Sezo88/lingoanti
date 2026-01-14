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
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className={inter.className}>
                <FractalBackground />
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    )
}
