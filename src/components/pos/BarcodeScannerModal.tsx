'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Modal, Button } from 'antd';
import { AlertCircle, Camera, Loader2, Image as ImageIcon } from 'lucide-react';

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'];

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      return;
    }

    const startCamera = async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Browser tidak mendukung akses kamera. Gunakan foto dari galeri.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // Autoplay can be blocked on some browsers; user can still tap the video.
          });
          setIsCameraActive(true);
        }
      } catch (err) {
        setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan.');
      }
    };

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open, stopCamera]);

  const detectFromSource = useCallback(
    async (source: ImageBitmapSource) => {
      const detectorCtor = (window as any).BarcodeDetector as BarcodeDetectorConstructor | undefined;
      if (!detectorCtor) {
        setError('Browser belum mendukung pemindai barcode. Gunakan input manual.');
        return null;
      }

      const detector = new detectorCtor({ formats: BARCODE_FORMATS });
      const results = await detector.detect(source);
      if (results.length === 0) {
        return null;
      }

      const value = results[0].rawValue?.trim();
      return value || null;
    },
    []
  );

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!isCameraActive) {
      setError('Kamera belum siap.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        setError('Tidak dapat membaca kamera.');
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        setError('Kamera belum siap memotret.');
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const code = await detectFromSource(canvas);
      context.clearRect(0, 0, width, height);

      if (!code) {
        setError('Barcode tidak terdeteksi. Coba ulang dengan pencahayaan cukup.');
        return;
      }

      onDetected(code);
      onClose();
    } catch (err) {
      setError('Gagal membaca barcode. Silakan coba lagi.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);

    try {
      const bitmap = await createImageBitmap(file);
      const code = await detectFromSource(bitmap);
      if (bitmap.close) bitmap.close();

      if (!code) {
        setError('Barcode tidak terdeteksi dari foto. Coba ulang.');
        return;
      }

      onDetected(code);
      onClose();
    } catch (err) {
      setError('Gagal membaca barcode dari foto.');
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  };

  return (
    <Modal open={open} title="Scan Barcode" onCancel={onClose} footer={null} width="min(500px, calc(100vw - 1rem))" destroyOnHidden>
      <div className="space-y-4 pt-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-[#303030] bg-slate-100 dark:bg-[#1f1f1f]">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            onLoadedMetadata={() => setIsReady(true)}
          />
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Camera className="h-6 w-6" />
              Mengaktifkan kamera...
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#141414] p-3 text-xs text-slate-500">
          Foto diproses langsung di perangkat Anda dan tidak disimpan.
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onClose} disabled={isScanning}>
            Batal
          </Button>
          <Button type="primary" className="flex-1 bg-[#10b981]" onClick={handleCapture} disabled={isScanning || !isCameraActive}>
            {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            Ambil Foto & Scan
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-[#303030] bg-white dark:bg-[#1f1f1f] p-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">Alternatif: pilih foto barcode</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ImageIcon className="h-4 w-4 text-slate-500" />
            <input type="file" accept="image/*" capture="environment" onChange={handleFileScan} className="text-sm" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
