'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
    const pathname = usePathname()

    const isActive = (path: string) => pathname === path

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-dark-200/95 backdrop-blur-md border-t border-white/10 z-50">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
                <Link href="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-[#f86516]' : 'text-white/60 hover:text-white'} transition-colors group`}>
                    <span className={`material-symbols-outlined ${isActive('/') ? 'symbol-filled' : ''} text-2xl group-hover:scale-110 transition-transform`}>home</span>
                    <span className="text-[10px] font-bold">Ana Sayfa</span>
                </Link>
                <Link href="/leaderboard" className={`flex flex-col items-center gap-1 ${isActive('/leaderboard') ? 'text-[#f86516]' : 'text-white/60 hover:text-white'} transition-colors group`}>
                    <span className={`material-symbols-outlined ${isActive('/leaderboard') ? 'symbol-filled' : ''} text-2xl group-hover:scale-110 transition-transform`}>leaderboard</span>
                    <span className="text-[10px] font-medium">Liderlik</span>
                </Link>
                <Link href="/friends" className={`flex flex-col items-center gap-1 ${isActive('/friends') ? 'text-[#f86516]' : 'text-white/60 hover:text-white'} transition-colors group`}>
                    <span className={`material-symbols-outlined ${isActive('/friends') ? 'symbol-filled' : ''} text-2xl group-hover:scale-110 transition-transform`}>group</span>
                    <span className="text-[10px] font-medium">Arkadaşlar</span>
                </Link>
                <Link href="/settings" className={`flex flex-col items-center gap-1 ${isActive('/settings') ? 'text-[#f86516]' : 'text-white/60 hover:text-white'} transition-colors group`}>
                    <span className={`material-symbols-outlined ${isActive('/settings') ? 'symbol-filled' : ''} text-2xl group-hover:scale-110 transition-transform`}>settings</span>
                    <span className="text-[10px] font-medium">Ayarlar</span>
                </Link>
            </div>
        </nav>
    )
}
