'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SettingsContextType {
    soundEnabled: boolean
    musicEnabled: boolean
    vibrationEnabled: boolean
    notificationsEnabled: boolean
    toggleSound: () => void
    toggleMusic: () => void
    toggleVibration: () => void
    toggleNotifications: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [musicEnabled, setMusicEnabled] = useState(true)
    const [vibrationEnabled, setVibrationEnabled] = useState(true)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)

    // Load settings from localStorage on mount
    useEffect(() => {
        const loadSettings = () => {
            const sound = localStorage.getItem('soundEnabled')
            const music = localStorage.getItem('musicEnabled')
            const vibration = localStorage.getItem('vibrationEnabled')
            const notifications = localStorage.getItem('notificationsEnabled')

            if (sound !== null) setSoundEnabled(sound === 'true')
            if (music !== null) setMusicEnabled(music === 'true')
            if (vibration !== null) setVibrationEnabled(vibration === 'true')
            if (notifications !== null) setNotificationsEnabled(notifications === 'true')
        }

        loadSettings()
    }, [])

    const toggleSound = () => {
        setSoundEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('soundEnabled', String(newValue))
            return newValue
        })
    }

    const toggleMusic = () => {
        setMusicEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('musicEnabled', String(newValue))
            return newValue
        })
    }

    const toggleVibration = () => {
        setVibrationEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('vibrationEnabled', String(newValue))
            return newValue
        })
    }

    const toggleNotifications = () => {
        setNotificationsEnabled(prev => {
            const newValue = !prev
            localStorage.setItem('notificationsEnabled', String(newValue))
            return newValue
        })
    }

    return (
        <SettingsContext.Provider
            value={{
                soundEnabled,
                musicEnabled,
                vibrationEnabled,
                notificationsEnabled,
                toggleSound,
                toggleMusic,
                toggleVibration,
                toggleNotifications,
            }}
        >
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
