'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { AlertModal } from '@/components/AlertModal'

type AlertType = 'success' | 'error' | 'info' | 'warning'

interface AlertAction {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline' | 'danger'
}

interface AlertOptions {
    title?: string
    message: string
    type?: AlertType
    actions?: AlertAction[]
    showAdButton?: boolean // Lbilet için özel
}

interface AlertContextType {
    showAlert: (options: AlertOptions | string) => void
    hideAlert: () => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function AlertProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [config, setConfig] = useState<AlertOptions>({ message: '' })

    const showAlert = (options: AlertOptions | string) => {
        if (typeof options === 'string') {
            setConfig({ message: options, type: 'info' })
        } else {
            setConfig(options)
        }
        setIsOpen(true)
    }

    const hideAlert = () => {
        setIsOpen(false)
    }

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {isOpen && (
                <AlertModal
                    isOpen={isOpen}
                    onClose={hideAlert}
                    config={config}
                />
            )}
        </AlertContext.Provider>
    )
}

export function useAlert() {
    const context = useContext(AlertContext)
    if (context === undefined) {
        throw new Error('useAlert must be used within an AlertProvider')
    }
    return context
}
