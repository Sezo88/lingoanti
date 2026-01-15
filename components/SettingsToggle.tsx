'use client'

import { motion } from 'framer-motion'

interface SettingsToggleProps {
    label: string
    description?: string
    enabled: boolean
    onToggle: () => void
    icon?: string
}

export default function SettingsToggle({ label, description, enabled, onToggle, icon }: SettingsToggleProps) {
    return (
        <div className="flex items-center justify-between p-4 bg-dark-200/50 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
            <div className="flex items-center gap-3 flex-1">
                {icon && <span className="text-2xl">{icon}</span>}
                <div>
                    <div className="text-white font-semibold">{label}</div>
                    {description && (
                        <div className="text-xs text-white/60 mt-0.5">{description}</div>
                    )}
                </div>
            </div>

            <button
                onClick={onToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-dark-300'
                    }`}
            >
                <motion.div
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg"
                    animate={{
                        left: enabled ? '26px' : '2px'
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30
                    }}
                />
            </button>
        </div>
    )
}
