/**
 * Settings Store - App configuration and preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storeRequest } from '@/lib/api/store';
import { PrinterType } from '@/lib/utils/print';

interface StoreInfo {
    id: string;
    store_code: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_percentage: number;
    currency: string;
    timezone: string;
    logo_url: string | null;
}

interface PrinterSettings {
    type: PrinterType;
    paperWidth: '58mm' | '80mm';
    autoPrint: boolean;
    printCopy: number;
    showLogo: boolean;
    footerText: string;
}

interface AppSettings {
    // Theme
    theme: 'light' | 'dark' | 'system';

    // Language
    language: 'id' | 'en';

    // POS settings
    enableBarcodeScan: boolean;
    enableQuickAmount: boolean;
    quickAmounts: number[];
    defaultPaymentMethod: string;

    // Notifications
    enableSoundEffects: boolean;
    enableNotifications: boolean;

    // Display
    productGridColumns: 2 | 3 | 4;
    showProductSKU: boolean;

    // Tax
    taxEnabled: boolean;
    taxPercentage: number;
    taxInclusive: boolean;
}

interface SettingsState {
    // Store info
    storeInfo: StoreInfo | null;

    // Printer settings
    printer: PrinterSettings;

    // App settings
    app: AppSettings;

    // Loading state
    isLoading: boolean;
    error: string | null;

    // Actions
    loadStoreInfo: () => Promise<void>;
    updateStoreInfo: (data: Partial<StoreInfo>) => Promise<void>;
    updatePrinterSettings: (settings: Partial<PrinterSettings>) => void;
    updateAppSettings: (settings: Partial<AppSettings>) => void;
    resetSettings: () => void;
}

const defaultPrinterSettings: PrinterSettings = {
    type: 'browser',
    paperWidth: '58mm',
    autoPrint: true,
    printCopy: 1,
    showLogo: true,
    footerText: 'Terima kasih atas kunjungan Anda',
};

const defaultAppSettings: AppSettings = {
    theme: 'light',
    language: 'id',
    enableBarcodeScan: true,
    enableQuickAmount: true,
    quickAmounts: [50000, 100000, 200000, 500000],
    defaultPaymentMethod: 'cash',
    enableSoundEffects: true,
    enableNotifications: true,
    productGridColumns: 3,
    showProductSKU: false,
    taxEnabled: true,
    taxPercentage: 11,
    taxInclusive: false,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            storeInfo: null,
            printer: defaultPrinterSettings,
            app: defaultAppSettings,
            isLoading: false,
            error: null,

            loadStoreInfo: async () => {
                set({ isLoading: true, error: null });

                try {
                    const data = await storeRequest<StoreInfo>({
                        action: 'select',
                        table: 'stores',
                        single: true,
                    });

                    set({
                        storeInfo: data,
                        isLoading: false,
                    });

                    // Update tax settings from store
                    if (data.tax_percentage) {
                        set((state) => ({
                            app: {
                                ...state.app,
                                taxPercentage: data.tax_percentage,
                            },
                        }));
                    }
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                }
            },

            updateStoreInfo: async (data: Partial<StoreInfo>) => {
                const { storeInfo } = get();
                if (!storeInfo) return;

                set({ isLoading: true, error: null });

                try {
                    await storeRequest({
                        action: 'update',
                        table: 'stores',
                        match: { id: storeInfo.id },
                        data: data,
                    });

                    set({
                        storeInfo: { ...storeInfo, ...data },
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                }
            },

            updatePrinterSettings: (settings: Partial<PrinterSettings>) => {
                set((state) => ({
                    printer: { ...state.printer, ...settings },
                }));
            },

            updateAppSettings: (settings: Partial<AppSettings>) => {
                set((state) => ({
                    app: { ...state.app, ...settings },
                }));
            },

            resetSettings: () => {
                set({
                    printer: defaultPrinterSettings,
                    app: defaultAppSettings,
                });
            },
        }),
        {
            name: 'settings-storage',
            partialize: (state) => ({
                storeInfo: state.storeInfo,
                printer: state.printer,
                app: state.app,
            }),
        }
    )
);
