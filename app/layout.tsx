import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AlertProvider } from '@/contexts/AlertContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import FractalBackground from '@/components/FractalBackground'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Lingo Master',
    description: 'Çok oyunculu Türkçe kelime tahmin oyunu',
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Lingo Master",
    },
}

export const viewport: Viewport = {
    themeColor: "#667eea",
    minimumScale: 1,
    initialScale: 1,
    width: "device-width",
    userScalable: false,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="tr">
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className={inter.className}>
                <FractalBackground />
                <AuthProvider>
                    <AlertProvider>
                        <CurrencyProvider>
                            <SettingsProvider>
                                {children}
                            </SettingsProvider>
                        </CurrencyProvider>
                    </AlertProvider>
                </AuthProvider>
            </body>
        </html>
    )
}
