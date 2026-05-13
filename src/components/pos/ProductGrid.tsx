'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Input, Select, Button, Card, Empty, Spin, Tag } from 'antd';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { getMediaUrl } from '@/lib/utils/media';
import { useCartStore } from '@/store/cartStore';
import { useDataStore } from '@/store/dataStore';

interface ProductGridProps {
  className?: string;
}

export function ProductGrid({ className }: ProductGridProps) {
  const { addItem } = useCartStore();
  const products = useDataStore((state) => state.products);
  const categories = useDataStore((state) => state.categories);
  const isReady = useDataStore((state) => state.isReady);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (product.status === 'discontinued') {
        return false;
      }

      if (categoryId !== 'all' && product.categoryId !== categoryId) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.description || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categoryId, products, searchQuery]);

  return (
    <div className={`flex h-full flex-col bg-slate-50 dark:bg-[#141414] ${className || ''}`}>
      <div className="z-10 flex-shrink-0 space-y-3 border-b border-slate-200 bg-white p-4 shadow-sm dark:border-[#303030] dark:bg-[#1f1f1f]">
        <div className="flex flex-col gap-3">
          <Input
            prefix={<Search className="h-4 w-4 text-slate-400" />}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari produk..."
            size="large"
            className="w-full"
          />
        </div>

        <Select
          value={categoryId}
          onChange={(value) => setCategoryId(value)}
          size="large"
          className="w-full"
          options={[
            { value: 'all', label: 'Semua Kategori' },
            ...categories
              .filter((category) => category.isActive)
              .map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:pb-4">
        {!isReady ? (
          <div className="flex h-full items-center justify-center">
            <Spin size="large" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Empty
              image={<ShoppingBag className="mx-auto mb-4 h-16 w-16 text-slate-300" />}
              description="Produk tidak ditemukan"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.status === 'sold_out';

              return (
                <Card
                  key={product.id}
                  hoverable={!isOutOfStock}
                  onClick={() => {
                    if (isOutOfStock) {
                      return;
                    }

                    addItem(
                      {
                        productId: product.id,
                        name: product.name,
                        price: product.sellingPrice,
                      },
                      1
                    );
                  }}
                  className={`flex flex-col overflow-hidden ${isOutOfStock ? 'cursor-not-allowed grayscale opacity-60' : ''}`}
                  styles={{ body: { padding: 12, flex: 1, display: 'flex', flexDirection: 'column' } }}
                  cover={
                    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#2a2a2a]">
                      {product.imageUrl ? (
                        <Image
                          fill
                          unoptimized
                          src={getMediaUrl(product.imageUrl)}
                          alt={product.name}
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-slate-300" />
                      )}

                      {isOutOfStock ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Tag color="error" className="border-none font-bold uppercase">
                            Habis
                          </Tag>
                        </div>
                      ) : null}
                    </div>
                  }
                >
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="mb-2 line-clamp-2 text-sm font-semibold leading-snug dark:text-slate-200">
                        {product.name}
                      </div>
                      {product.description ? (
                        <div className="line-clamp-2 text-xs text-slate-500">{product.description}</div>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-end justify-between">
                      <div className="text-base font-bold text-[#10b981]">
                        {formatCurrency(product.sellingPrice)}
                      </div>
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<Plus className="h-4 w-4" />}
                        size="small"
                        className="border-none bg-[#10b981] shadow-md hover:bg-[#059669]"
                        disabled={isOutOfStock}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
