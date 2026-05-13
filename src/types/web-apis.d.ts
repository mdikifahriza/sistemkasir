/// <reference lib="dom" />

/**
 * Type declarations for Web USB API
 * https://wicg.github.io/webusb/
 */

interface USBDeviceFilter {
    vendorId?: number;
    productId?: number;
    classCode?: number;
    subclassCode?: number;
    protocolCode?: number;
    serialNumber?: string;
}

interface USBDeviceRequestOptions {
    filters: USBDeviceFilter[];
}

interface USBEndpoint {
    endpointNumber: number;
    direction: 'in' | 'out';
    type: 'bulk' | 'interrupt' | 'isochronous';
    packetSize: number;
}

interface USBAlternateInterface {
    alternateSetting: number;
    interfaceClass: number;
    interfaceSubclass: number;
    interfaceProtocol: number;
    interfaceName: string | null;
    endpoints: USBEndpoint[];
}

interface USBInterface {
    interfaceNumber: number;
    alternate: USBAlternateInterface;
    alternates: USBAlternateInterface[];
    claimed: boolean;
}

interface USBConfiguration {
    configurationValue: number;
    configurationName: string | null;
    interfaces: USBInterface[];
}

interface USBInTransferResult {
    data: DataView | null;
    status: 'ok' | 'stall' | 'babble';
}

interface USBOutTransferResult {
    bytesWritten: number;
    status: 'ok' | 'stall';
}

interface USBDevice {
    usbVersionMajor: number;
    usbVersionMinor: number;
    usbVersionSubminor: number;
    deviceClass: number;
    deviceSubclass: number;
    deviceProtocol: number;
    vendorId: number;
    productId: number;
    deviceVersionMajor: number;
    deviceVersionMinor: number;
    deviceVersionSubminor: number;
    manufacturerName: string | null;
    productName: string | null;
    serialNumber: string | null;
    configuration: USBConfiguration | null;
    configurations: USBConfiguration[];
    opened: boolean;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
    controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
    controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
    transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
    reset(): Promise<void>;
}

interface USBControlTransferParameters {
    requestType: 'standard' | 'class' | 'vendor';
    recipient: 'device' | 'interface' | 'endpoint' | 'other';
    request: number;
    value: number;
    index: number;
}

interface USB {
    getDevices(): Promise<USBDevice[]>;
    requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
    addEventListener(type: 'connect' | 'disconnect', listener: (event: USBConnectionEvent) => void): void;
    removeEventListener(type: 'connect' | 'disconnect', listener: (event: USBConnectionEvent) => void): void;
}

interface USBConnectionEvent extends Event {
    device: USBDevice;
}

/**
 * Type declarations for Web Bluetooth API
 * https://webbluetoothcg.github.io/web-bluetooth/
 */

interface BluetoothRequestDeviceFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
    manufacturerData?: BluetoothManufacturerDataFilter[];
    serviceData?: BluetoothServiceDataFilter[];
}

interface BluetoothManufacturerDataFilter {
    companyIdentifier: number;
    dataPrefix?: BufferSource;
    mask?: BufferSource;
}

interface BluetoothServiceDataFilter {
    service: BluetoothServiceUUID;
    dataPrefix?: BufferSource;
    mask?: BufferSource;
}

interface RequestDeviceOptions {
    filters?: BluetoothRequestDeviceFilter[];
    optionalServices?: BluetoothServiceUUID[];
    optionalManufacturerData?: number[];
    acceptAllDevices?: boolean;
}

type BluetoothServiceUUID = string | number;
type BluetoothCharacteristicUUID = string | number;
type BluetoothDescriptorUUID = string | number;

interface BluetoothRemoteGATTDescriptor {
    characteristic: BluetoothRemoteGATTCharacteristic;
    uuid: string;
    value: DataView | null;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTCharacteristic {
    service: BluetoothRemoteGATTService;
    uuid: string;
    properties: BluetoothCharacteristicProperties;
    value: DataView | null;
    getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
    getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
    removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
}

interface BluetoothCharacteristicProperties {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
    authenticatedSignedWrites: boolean;
    reliableWrite: boolean;
    writableAuxiliaries: boolean;
}

interface BluetoothRemoteGATTService {
    device: BluetoothDevice;
    uuid: string;
    isPrimary: boolean;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
    getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTServer {
    device: BluetoothDevice;
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice {
    id: string;
    name: string | null;
    gatt: BluetoothRemoteGATTServer | undefined;
    watchAdvertisements(options?: WatchAdvertisementsOptions): Promise<void>;
    unwatchAdvertisements(): void;
    watchingAdvertisements: boolean;
    addEventListener(type: 'gattserverdisconnected' | 'advertisementreceived', listener: (event: Event) => void): void;
    removeEventListener(type: 'gattserverdisconnected' | 'advertisementreceived', listener: (event: Event) => void): void;
}

interface WatchAdvertisementsOptions {
    signal?: AbortSignal;
}

interface Bluetooth {
    getAvailability(): Promise<boolean>;
    getDevices(): Promise<BluetoothDevice[]>;
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
    addEventListener(type: 'availabilitychanged', listener: (event: Event) => void): void;
    removeEventListener(type: 'availabilitychanged', listener: (event: Event) => void): void;
}

// Extend Navigator interface
declare global {
    interface Navigator {
        usb: USB;
        bluetooth: Bluetooth;
    }
}

export { };
