'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'

interface AlertAction {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline' | 'danger'
}

interface AlertOptions {
    title?: string
    message: string
    type?: 'success' | 'error' | 'info' | 'warning'
    actions?: AlertAction[]
    showAdButton?: boolean
}

interface AlertModalProps {
    isOpen: boolean
    onClose: () => void
    config: AlertOptions
}
export function AlertModal({ isOpen, onClose, config }: AlertModalProps) {
    // ...
    const getTypeIcon = () => {
        switch (config.type) {
            case 'success': return <CheckCircle className="text-green-500" size={32} />
            case 'error': return <AlertCircle className="text-red-500" size={32} />
            case 'warning': return <AlertTriangle className="text-yellow-500" size={32} />
            case 'info': return <Info className="text-blue-500" size={32} />
            default: return <Info className="text-blue-500" size={32} />
        }
    }

    const getTypeColor = () => {
        switch (config.type) {
            case 'success': return 'border-green-500/50'
            case 'error': return 'border-red-500/50'
            case 'warning': return 'border-yellow-500/50'
            default: return 'border-white/10'
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`relative w-full max-w-sm bg-[#1a1a1a] rounded-2xl border ${getTypeColor()} shadow-2xl overflow-hidden`}
            >
                {/* Glow Effect */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${config.type === 'error' ? 'red' : config.type === 'success' ? 'green' : config.type === 'warning' ? 'yellow' : 'blue'}-500 to-transparent opacity-50`} />

                <div className="p-6">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className={`p-3 rounded-full bg-white/5 border border-white/5`}>
                            {getTypeIcon()}
                        </div>

                        <div className="space-y-2">
                            {config.title && (
                                <h3 className="text-xl font-bold text-white">{config.title}</h3>
                            )}
                            <p className="text-white/70 text-sm leading-relaxed">
                                {config.message}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 w-full mt-2">
                            {config.actions?.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        action.onClick()
                                        onClose()
                                    }}
                                    className={`w-full py-3 rounded-xl font-medium transition-all ${action.variant === 'primary'
                                        ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                        : action.variant === 'danger'
                                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
                                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                                        }`}
                                >
                                    {action.label}
                                </button>
                            ))}

                            {!config.actions?.length && (
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors"
                                >
                                    Tamam
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
