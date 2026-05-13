'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { ConfigProvider, theme as antTheme } from 'antd';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useUIStore((state) => state.theme);
    const [mounted, setMounted] = useState(false);
    const isDark = theme === 'dark';

    useEffect(() => {
        setMounted(true);
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }
    }, [theme]);

    if (!mounted) return null;

    return (
        <ConfigProvider
            theme={{
                algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
                token: {
                    colorPrimary: '#10b981',
                    colorInfo: '#10b981',
                    colorLink: '#10b981',
                    borderRadius: 12,
                    fontFamily: 'var(--font-sans), sans-serif',
                    colorBgBase: isDark ? '#020617' : '#f8fafc',
                    colorBgLayout: isDark ? '#020617' : '#f8fafc',
                    colorBgContainer: isDark ? '#111827' : '#ffffff',
                    colorBgElevated: isDark ? '#0f172a' : '#ffffff',
                    colorBorder: isDark ? '#243042' : '#e2e8f0',
                    colorBorderSecondary: isDark ? '#243042' : '#e2e8f0',
                    colorSplit: isDark ? '#243042' : '#e2e8f0',
                    colorText: isDark ? '#f8fafc' : '#0f172a',
                    colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
                    boxShadowSecondary: isDark
                        ? '0 24px 55px rgba(2, 6, 23, 0.45)'
                        : '0 16px 40px rgba(15, 23, 42, 0.08)',
                },
                components: {
                    Button: {
                        controlHeight: 40,
                        paddingInline: 24,
                    },
                    Card: {
                        borderRadius: 12,
                    }
                }
            }}
        >
            {children}
        </ConfigProvider>
    );
}
