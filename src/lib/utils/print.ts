/**
 * Thermal Printer Utilities
 * Supports USB and Bluetooth thermal printers via Web APIs
 * Uses ESC/POS commands for printing receipts
 */

type USBEndpointLike = {
    direction: 'in' | 'out';
    endpointNumber: number;
};

type USBDeviceLike = {
    productName?: string | null;
    configuration?: {
        interfaces: Array<{
            alternates: Array<{
                endpoints: USBEndpointLike[];
            }>;
        }>;
    } | null;
    open: () => Promise<void>;
    close: () => Promise<void>;
    selectConfiguration: (config: number) => Promise<void>;
    claimInterface: (interfaceNumber: number) => Promise<void>;
    transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>;
};

type USBDeviceType = typeof globalThis extends { USBDevice: infer T } ? T : USBDeviceLike;

// =====================================================
// ESC/POS COMMANDS
// =====================================================

export const ESC = '\x1B';
export const GS = '\x1D';
export const DLE = '\x10';

export const Commands = {
    // Initialize
    INIT: ESC + '@',

    // Alignment
    ALIGN_LEFT: ESC + 'a' + '\x00',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_RIGHT: ESC + 'a' + '\x02',

    // Text formatting
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    UNDERLINE_ON: ESC + '-' + '\x01',
    UNDERLINE_OFF: ESC + '-' + '\x00',
    DOUBLE_HEIGHT: ESC + '!' + '\x10',
    DOUBLE_WIDTH: ESC + '!' + '\x20',
    DOUBLE_SIZE: ESC + '!' + '\x30',
    NORMAL_SIZE: ESC + '!' + '\x00',

    // Line spacing
    LINE_SPACING_DEFAULT: ESC + '2',
    LINE_SPACING_SET: (n: number) => ESC + '3' + String.fromCharCode(n),

    // Paper
    FEED_LINE: '\n',
    FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),
    CUT_FULL: GS + 'V' + '\x00',
    CUT_PARTIAL: GS + 'V' + '\x01',

    // Cash drawer
    OPEN_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',

    // Barcode
    BARCODE_HEIGHT: (n: number) => GS + 'h' + String.fromCharCode(n),
    BARCODE_WIDTH: (n: number) => GS + 'w' + String.fromCharCode(n),
    BARCODE_POSITION: (n: number) => GS + 'H' + String.fromCharCode(n),
    BARCODE_FONT: (n: number) => GS + 'f' + String.fromCharCode(n),
    PRINT_BARCODE: (type: number, data: string) =>
        GS + 'k' + String.fromCharCode(type) + String.fromCharCode(data.length) + data,

    // QR Code
    QR_SIZE: (n: number) => GS + '(k' + '\x03\x00' + '\x31' + '\x43' + String.fromCharCode(n),
    QR_ERROR_LEVEL: (n: number) => GS + '(k' + '\x03\x00' + '\x31' + '\x45' + String.fromCharCode(n),
    QR_STORE: (data: string) => {
        const len = data.length + 3;
        const pL = len % 256;
        const pH = Math.floor(len / 256);
        return GS + '(k' + String.fromCharCode(pL) + String.fromCharCode(pH) + '\x31\x50\x30' + data;
    },
    QR_PRINT: GS + '(k' + '\x03\x00' + '\x31\x51\x30',
};

// =====================================================
// RECEIPT DATA TYPES
// =====================================================

export interface ReceiptItem {
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    sku?: string;
}

export interface ReceiptData {
    // Store info
    storeName: string;
    storeAddress?: string;
    storePhone?: string;

    // Transaction info
    invoiceNumber: string;
    date: Date;
    cashierName: string;
    customerName?: string;

    // Items
    items: ReceiptItem[];

    // Totals
    subtotal: number;
    discountAmount: number;
    serviceCharge: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    changeAmount: number;

    // Payment
    paymentMethod: string;

    // Optional
    notes?: string;
    shiftName?: string;
}

// =====================================================
// RECEIPT FORMATTER
// =====================================================

const LINE_WIDTH = 32; // Characters per line (58mm printer)
const SEPARATOR = '================================';
const THIN_SEPARATOR = '--------------------------------';

function padRight(text: string, length: number): string {
    return text.slice(0, length).padEnd(length);
}

function padLeft(text: string, length: number): string {
    return text.slice(0, length).padStart(length);
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatLine(left: string, right: string): string {
    const maxLeftWidth = LINE_WIDTH - right.length - 1;
    return padRight(left, maxLeftWidth) + ' ' + right;
}

/**
 * Generate receipt content for thermal printer
 */
export function generateReceiptContent(data: ReceiptData): string {
    let content = '';

    // Initialize printer
    content += Commands.INIT;

    // Store Header
    content += Commands.ALIGN_CENTER;
    content += Commands.DOUBLE_SIZE;
    content += data.storeName + '\n';
    content += Commands.NORMAL_SIZE;

    if (data.storeAddress) {
        content += data.storeAddress + '\n';
    }
    if (data.storePhone) {
        content += 'Telp: ' + data.storePhone + '\n';
    }

    content += SEPARATOR + '\n';

    // Transaction Info
    content += Commands.ALIGN_LEFT;
    content += 'No     : ' + data.invoiceNumber + '\n';
    content += 'Tgl    : ' + formatDate(data.date) + '\n';
    content += 'Kasir  : ' + data.cashierName + '\n';
    if (data.customerName) {
        content += 'Pelanggan: ' + data.customerName + '\n';
    }

    content += THIN_SEPARATOR + '\n';

    // Items
    for (const item of data.items) {
        // Item name
        content += item.name + '\n';
        // Quantity x Price = Subtotal
        const qtyPrice = `${item.quantity} x ${formatCurrency(item.price)}`;
        const subtotalStr = formatCurrency(item.subtotal);
        content += formatLine('  ' + qtyPrice, subtotalStr) + '\n';
    }

    content += THIN_SEPARATOR + '\n';

    // Totals
    content += formatLine('Subtotal', formatCurrency(data.subtotal)) + '\n';

    if (data.discountAmount > 0) {
        content += formatLine('Diskon', '-' + formatCurrency(data.discountAmount)) + '\n';
    }

    if (data.serviceCharge > 0) {
        content += formatLine('Service', formatCurrency(data.serviceCharge)) + '\n';
    }

    if (data.taxAmount > 0) {
        content += formatLine('Pajak (11%)', formatCurrency(data.taxAmount)) + '\n';
    }

    content += SEPARATOR + '\n';

    // Grand Total
    content += Commands.BOLD_ON;
    content += Commands.DOUBLE_HEIGHT;
    content += formatLine('TOTAL', 'Rp ' + formatCurrency(data.totalAmount)) + '\n';
    content += Commands.NORMAL_SIZE;
    content += Commands.BOLD_OFF;

    content += SEPARATOR + '\n';

    // Payment
    content += formatLine('Bayar (' + translatePaymentMethod(data.paymentMethod) + ')',
        'Rp ' + formatCurrency(data.amountPaid)) + '\n';

    if (data.paymentMethod === 'cash' && data.changeAmount > 0) {
        content += formatLine('Kembali', 'Rp ' + formatCurrency(data.changeAmount)) + '\n';
    }

    // Notes
    if (data.notes) {
        content += '\n';
        content += 'Catatan: ' + data.notes + '\n';
    }

    // Footer
    content += '\n';
    content += Commands.ALIGN_CENTER;
    content += 'Terima Kasih\n';
    content += 'Atas Kunjungan Anda\n';
    content += '\n';
    content += 'Barang yang sudah dibeli\n';
    content += 'tidak dapat dikembalikan\n';

    // Feed and cut
    content += Commands.FEED_LINES(4);
    content += Commands.CUT_PARTIAL;

    return content;
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function translatePaymentMethod(method: string): string {
    const methods: Record<string, string> = {
        cash: 'Tunai',
        card: 'Kartu',
        xendit: 'Xendit',
        qris: 'QRIS',
        transfer: 'Transfer',
        'e-wallet': 'E-Wallet',
        cashless_other: 'Cashless Lain',
        split: 'Split',
    };
    return methods[method] || method;
}

// =====================================================
// PRINTER CONNECTION - WEB USB API
// =====================================================

let usbDevice: USBDeviceType | null = null;

/**
 * Check if Web USB is supported
 */
export function isWebUSBSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Request USB printer connection
 */
export async function connectUSBPrinter(): Promise<boolean> {
    if (!isWebUSBSupported()) {
        throw new Error('Web USB tidak didukung di browser ini');
    }

    try {
        // Request device - user will see a dialog
        const device = await navigator.usb.requestDevice({
            filters: [
                // Common thermal printer vendor IDs
                { vendorId: 0x0483 }, // STMicroelectronics
                { vendorId: 0x0416 }, // Winbond
                { vendorId: 0x0493 }, // MAG Technology
                { vendorId: 0x04B8 }, // Seiko Epson
                { vendorId: 0x0525 }, // PLX Technology
                { vendorId: 0x0DD4 }, // Sunplus
                { vendorId: 0x0E8D }, // MediaTek
                { vendorId: 0x1504 }, // face2face
                { vendorId: 0x154F }, // SNBC
                { vendorId: 0x1A86 }, // QinHeng Electronics (CH340)
                { vendorId: 0x1FC9 }, // NXP
                { vendorId: 0x20D1 }, // Gprinter
            ],
        });
        usbDevice = device;

        await device.open();

        // Select configuration
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }

        // Claim interface
        await device.claimInterface(0);

        console.log('[Printer] Connected:', device.productName);
        return true;
    } catch (error) {
        console.error('[Printer] Connection failed:', error);
        throw error;
    }
}

/**
 * Disconnect USB printer
 */
export async function disconnectUSBPrinter(): Promise<void> {
    if (usbDevice) {
        try {
            await usbDevice.close();
            usbDevice = null;
            console.log('[Printer] Disconnected');
        } catch (error) {
            console.error('[Printer] Disconnect error:', error);
        }
    }
}

/**
 * Print to USB printer
 */
export async function printToUSB(content: string): Promise<boolean> {
    if (!usbDevice) {
        throw new Error('Printer tidak terhubung');
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);

        // Find the OUT endpoint
        const endpoint = usbDevice.configuration?.interfaces[0]?.alternates[0]?.endpoints.find(
            (ep: USBEndpointLike) => ep.direction === 'out'
        );

        if (!endpoint) {
            throw new Error('Endpoint printer tidak ditemukan');
        }

        await usbDevice.transferOut(endpoint.endpointNumber, data);
        console.log('[Printer] Print successful');
        return true;
    } catch (error) {
        console.error('[Printer] Print failed:', error);
        throw error;
    }
}

// =====================================================
// PRINTER CONNECTION - WEB BLUETOOTH API
// =====================================================

let bluetoothDevice: BluetoothDevice | null = null;
let bluetoothCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

/**
 * Check if Web Bluetooth is supported
 */
export function isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Connect to Bluetooth printer
 */
export async function connectBluetoothPrinter(): Promise<boolean> {
    if (!isWebBluetoothSupported()) {
        throw new Error('Web Bluetooth tidak didukung di browser ini');
    }

    try {
        // Request device
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common BLE printer service
            ],
            optionalServices: [
                '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
            ],
        });

        const server = await bluetoothDevice.gatt?.connect();
        if (!server) throw new Error('Gagal terhubung ke GATT server');

        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        bluetoothCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

        console.log('[Printer] Bluetooth connected:', bluetoothDevice.name);
        return true;
    } catch (error) {
        console.error('[Printer] Bluetooth connection failed:', error);
        throw error;
    }
}

/**
 * Disconnect Bluetooth printer
 */
export async function disconnectBluetoothPrinter(): Promise<void> {
    if (bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
        bluetoothDevice = null;
        bluetoothCharacteristic = null;
        console.log('[Printer] Bluetooth disconnected');
    }
}

/**
 * Print to Bluetooth printer
 */
export async function printToBluetooth(content: string): Promise<boolean> {
    if (!bluetoothCharacteristic) {
        throw new Error('Printer Bluetooth tidak terhubung');
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);

        // BLE has max packet size, split if needed
        const chunkSize = 20;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await bluetoothCharacteristic.writeValue(chunk);
        }

        console.log('[Printer] Bluetooth print successful');
        return true;
    } catch (error) {
        console.error('[Printer] Bluetooth print failed:', error);
        throw error;
    }
}

// =====================================================
// UNIFIED PRINT FUNCTION
// =====================================================

export type PrinterType = 'usb' | 'bluetooth' | 'browser';

let activePrinterType: PrinterType = 'browser';

export function getActivePrinterType(): PrinterType {
    return activePrinterType;
}

export function setActivePrinterType(type: PrinterType): void {
    activePrinterType = type;
}

/**
 * Print receipt using active printer
 */
export async function printReceipt(data: ReceiptData): Promise<boolean> {
    const content = generateReceiptContent(data);

    switch (activePrinterType) {
        case 'usb':
            return await printToUSB(content);

        case 'bluetooth':
            return await printToBluetooth(content);

        case 'browser':
        default:
            return printToBrowser(data);
    }
}

/**
 * Print using browser's print dialog (fallback)
 */
function printToBrowser(data: ReceiptData): boolean {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        throw new Error('Popup diblokir. Silakan izinkan popup untuk mencetak.');
    }

    const html = generateHTMLReceipt(data);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    return true;
}

/**
 * Generate HTML receipt for browser printing
 */
function generateHTMLReceipt(data: ReceiptData): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk - ${data.invoiceNumber}</title>
      <style>
        @page { size: 58mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 58mm;
          margin: 0;
          padding: 5mm;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 16px; }
        .separator { border-top: 1px dashed #000; margin: 5px 0; }
        .line { display: flex; justify-content: space-between; }
        .item-name { margin-bottom: 2px; }
        .item-detail { padding-left: 10px; }
        .total-line { font-size: 14px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="center bold big">${data.storeName}</div>
      ${data.storeAddress ? `<div class="center">${data.storeAddress}</div>` : ''}
      ${data.storePhone ? `<div class="center">Telp: ${data.storePhone}</div>` : ''}
      <div class="separator"></div>
      <div>No: ${data.invoiceNumber}</div>
      <div>Tgl: ${formatDate(data.date)}</div>
      <div>Kasir: ${data.cashierName}</div>
      ${data.customerName ? `<div>Pelanggan: ${data.customerName}</div>` : ''}
      <div class="separator"></div>
      ${data.items.map(item => `
        <div class="item-name">${item.name}</div>
        <div class="line item-detail">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="line">
        <span>Subtotal</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      ${data.discountAmount > 0 ? `
        <div class="line">
          <span>Diskon</span>
          <span>-${formatCurrency(data.discountAmount)}</span>
        </div>
      ` : ''}
      ${data.serviceCharge > 0 ? `
        <div class="line">
          <span>Service</span>
          <span>${formatCurrency(data.serviceCharge)}</span>
        </div>
      ` : ''}
      ${data.taxAmount > 0 ? `
        <div class="line">
          <span>Pajak</span>
          <span>${formatCurrency(data.taxAmount)}</span>
        </div>
      ` : ''}
      <div class="separator"></div>
      <div class="line total-line">
        <span>TOTAL</span>
        <span>Rp ${formatCurrency(data.totalAmount)}</span>
      </div>
      <div class="separator"></div>
      <div class="line">
        <span>Bayar (${translatePaymentMethod(data.paymentMethod)})</span>
        <span>Rp ${formatCurrency(data.amountPaid)}</span>
      </div>
      ${data.paymentMethod === 'cash' && data.changeAmount > 0 ? `
        <div class="line">
          <span>Kembali</span>
          <span>Rp ${formatCurrency(data.changeAmount)}</span>
        </div>
      ` : ''}
      ${data.notes ? `<div>Catatan: ${data.notes}</div>` : ''}
      <br/>
      <div class="center">Terima Kasih</div>
      <div class="center">Atas Kunjungan Anda</div>
      <br/>
      <div class="center" style="font-size: 10px;">Barang yang sudah dibeli tidak dapat dikembalikan</div>
    </body>
    </html>
  `;
}

// =====================================================
// OPEN CASH DRAWER
// =====================================================

export async function openCashDrawer(): Promise<boolean> {
    const command = Commands.OPEN_DRAWER;

    switch (activePrinterType) {
        case 'usb':
            return await printToUSB(command);
        case 'bluetooth':
            return await printToBluetooth(command);
        default:
            console.log('[Printer] Cash drawer not supported for browser printing');
            return false;
    }
}
