'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/widgets/PageHeader';
import { Card, Button, Tag, Modal, Form, Input, Select, Space, Typography, App, Empty, Spin } from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  QrcodeOutlined, 
  LinkOutlined, 
  ReloadOutlined,
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useDataStore } from '@/store/dataStore';
import { QRCodeSVG } from 'qrcode.react';

const { Text, Title } = Typography;

// Separate Form Component to ensure form instance is created and connected within the same scope
const TableForm = ({ form, onFinish, editingTable }: { form: any, onFinish: (values: any) => void, editingTable: any }) => {
  return (
    <Form 
      form={form} 
      layout="vertical" 
      onFinish={onFinish}
      initialValues={editingTable || { status: 'available' }}
    >
      <Form.Item 
        name="name" 
        label="Nama / Nomor Meja" 
        rules={[{ required: true, message: 'Nama meja wajib diisi' }]}
      >
        <Input placeholder="Contoh: Meja 01 atau VIP 1" size="large" />
      </Form.Item>
      <Form.Item name="status" label="Status Meja">
        <Select size="large" options={[
          { value: 'available', label: 'Tersedia' },
          { value: 'occupied', label: 'Terisi' },
          { value: 'reserved', label: 'Dipesan (Reserved)' },
          { value: 'inactive', label: 'Nonaktif' },
          { value: 'maintenance', label: 'Perbaikan' },
        ]} />
      </Form.Item>
      <div className="bg-blue-50 p-3 rounded-lg dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
        <Space align="start">
          <InfoCircleOutlined className="text-blue-500 mt-1" />
          <Text type="secondary" className="text-xs leading-tight block">
            QR Code akan otomatis dibuat berdasarkan URL sistem pemesanan yang Anda atur di halaman Pengaturan.
          </Text>
        </Space>
      </div>
    </Form>
  );
};

export default function TablesPage() {
  const { message: messageApi, modal: antdModal } = App.useApp();
  const store = useDataStore((state) => state.store);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [isUpdatingQr, setIsUpdatingQr] = useState(false);
  const [form] = Form.useForm();

  const fetchTables = async () => {
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/tables`);
      const payload = await res.json();
      if (payload.data) setTables(payload.data);
    } catch (error) {
      messageApi.error('Gagal mengambil data meja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [store?.id]);

  const handleSubmit = async (values: any) => {
    try {
      const method = editingTable ? 'PATCH' : 'POST';
      const body = editingTable 
        ? { ...values, id: editingTable.id } 
        : { ...values };

      const res = await fetch('/api/tables', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        messageApi.success(`Meja berhasil ${editingTable ? 'diperbarui' : 'ditambahkan'}`);
        setIsModalOpen(false);
        form.resetFields();
        setEditingTable(null);
        fetchTables();
      }
    } catch (error) {
      messageApi.error('Gagal menyimpan data meja');
    }
  };

  const handleDelete = async (id: string) => {
    antdModal.confirm({
      title: 'Hapus Meja',
      content: 'Apakah Anda yakin ingin menghapus meja ini?',
      okText: 'Hapus',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await fetch(`/api/tables?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
            messageApi.success('Meja dihapus');
            fetchTables();
          }
        } catch (error) {
          messageApi.error('Gagal menghapus meja');
        }
      },
    });
  };

  const handleBulkUpdateQr = async () => {
    antdModal.confirm({
      title: 'Perbarui Semua QR Code?',
      content: 'Tindakan ini akan memperbarui link pada seluruh meja di database sesuai URL Sistem Pemesanan saat ini. QR yang sudah tercetak akan menjadi tidak valid dan perlu diprint ulang. Lanjutkan?',
      okText: 'Ya, Perbarui Semua',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        setIsUpdatingQr(true);
        try {
          const response = await fetch('/api/tables/bulk-update-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Gagal memperbarui QR');
          messageApi.success(`Berhasil memperbarui ${result.count} QR meja`);
          fetchTables();
        } catch (error) {
          messageApi.error(error instanceof Error ? error.message : 'Gagal memperbarui QR');
        } finally {
          setIsUpdatingQr(false);
        }
      }
    });
  };

  const downloadQR = (tableId: string, tableName: string) => {
    const svg = document.getElementById(`qr-${tableId}`);
    if (!svg) {
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const qrSize = 900;
      const textAreaHeight = 140;
      const canvasWidth = qrSize;
      const canvasHeight = qrSize + textAreaHeight;
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0, qrSize, qrSize);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 42px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textX = canvasWidth / 2;
      const textY = qrSize + 30;
      const maxTextWidth = canvasWidth - 40;

      const lines = [tableName].flatMap((text) => {
        if (!ctx.measureText(text).width || ctx.measureText(text).width <= maxTextWidth) {
          return [text];
        }

        const words = text.split(' ');
        const wrappedLines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const candidate = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(candidate).width <= maxTextWidth) {
            currentLine = candidate;
          } else {
            if (currentLine) wrappedLines.push(currentLine);
            currentLine = word;
          }
        }

        if (currentLine) wrappedLines.push(currentLine);
        return wrappedLines;
      });

      lines.forEach((line, index) => {
        ctx.fillText(line, textX, textY + index * 48);
      });

      canvas.toBlob((blobResult) => {
        if (!blobResult) {
          URL.revokeObjectURL(url);
          return;
        }

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blobResult);
        downloadLink.download = `QR_Meja_${tableName.replace(/[^a-zA-Z0-9-_ ]/g, '')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader 
        title="Manajemen Meja" 
        subtitle="Kelola daftar meja dan QR Code untuk pemesanan pelanggan" 
        actions={
          <Space wrap>
            <Button 
              danger
              icon={<ReloadOutlined />} 
              onClick={handleBulkUpdateQr}
              loading={isUpdatingQr}
            >
              Perbarui Semua QR
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingTable(null);
                form.resetFields();
                setIsModalOpen(true);
              }}
              className="bg-[#10b981] hover:bg-[#059669]"
            >
              Tambah Meja
            </Button>
          </Space>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : tables.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 shadow-sm border-slate-200">
          <Empty description="Belum ada meja yang terdaftar" />
          <Button 
            type="primary" 
            className="mt-4 bg-[#10b981]"
            onClick={() => setIsModalOpen(true)}
          >
            Tambah Meja Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {tables.map((table) => (
            <Card 
              key={table.id}
              className="shadow-sm border-slate-200 hover:shadow-md transition-shadow dark:border-[#303030] dark:bg-[#141414] overflow-hidden"
              styles={{ body: { padding: 0 } }}
            >
              <div className="p-3 sm:p-6 flex flex-col items-center border-b border-slate-100 dark:border-[#303030]">
                <div className="mb-2 sm:mb-4 flex items-center justify-between w-full">
                  <Tag color={table.status === 'available' ? 'green' : table.status === 'occupied' ? 'red' : 'orange'} className="m-0 border-none font-bold uppercase text-[10px] sm:text-xs px-1 sm:px-2">
                    {table.status}
                  </Tag>
                  <Space size={4}>
                    <Button 
                      type="text" 
                      size="small"
                      className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8"
                      icon={<EditOutlined className="text-slate-400 text-xs sm:text-base" />} 
                      onClick={() => {
                        setEditingTable(table);
                        form.setFieldsValue(table);
                        setIsModalOpen(true);
                      }} 
                    />
                    <Button 
                      type="text" 
                      size="small"
                      danger
                      className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8"
                      icon={<DeleteOutlined className="text-xs sm:text-base" />} 
                      onClick={() => handleDelete(table.id)} 
                    />
                  </Space>
                </div>
                
                <div className="bg-white p-1.5 sm:p-4 rounded-lg sm:rounded-2xl shadow-inner border border-slate-50 mb-2 sm:mb-4 w-full flex justify-center">
                  <QRCodeSVG 
                    id={`qr-${table.id}`}
                    value={table.qrCodeUrl || ''} 
                    size={256}
                    style={{ width: '100%', height: 'auto', maxWidth: '160px' }}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <Title level={5} className="!mb-0 text-center text-sm sm:text-lg truncate w-full">{table.name}</Title>
                <Text type="secondary" className="text-[10px] sm:text-xs">ID: {table.id.split('-')[0]}</Text>
              </div>

              <div className="p-2 sm:p-3 bg-slate-50/50 dark:bg-white/5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                <Button 
                  block
                  size="small"
                  icon={<LinkOutlined className="text-xs" />} 
                  onClick={() => window.open(table.qrCodeUrl, '_blank')}
                  className="rounded-md sm:rounded-lg text-[10px] sm:text-sm h-7 sm:h-9 px-1"
                >
                  <span className="hidden xs:inline">Cek Link</span>
                  <span className="xs:hidden">Link</span>
                </Button>
                <Button 
                  block
                  size="small"
                  type="primary"
                  icon={<DownloadOutlined className="text-xs" />} 
                  onClick={() => downloadQR(table.id, table.name)}
                  className="bg-blue-600 rounded-md sm:rounded-lg text-[10px] sm:text-sm h-7 sm:h-9 px-1"
                >
                  <span className="hidden xs:inline">Download</span>
                  <span className="xs:hidden">Simpan</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editingTable ? 'Edit Meja' : 'Tambah Meja Baru'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        centered
        destroyOnHidden
        forceRender // Ensure the form is mounted even when modal is hidden to avoid 'not connected' warning
      >
        <TableForm 
          form={form} 
          onFinish={handleSubmit} 
          editingTable={editingTable} 
        />
      </Modal>
    </div>
  );
}
