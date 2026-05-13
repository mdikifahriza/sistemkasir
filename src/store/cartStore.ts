import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  discount: number;
  customerName: string;

  isWaitingXenditPayment: boolean;
  xenditTransactionCreatedAt: string | null;

  // Computed values
  subtotal: number;

  // Actions
  addItem: (item: { productId: string; name: string; price: number }, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number) => void;
  setCustomerName: (name: string) => void;
  setWaitingXenditPayment: (isWaiting: boolean, createdAt?: string | null) => void;
  clear: () => void;

  // Helpers
  serviceCharge: (rate: number) => number;
  tax: (taxRate: number, serviceChargeRate: number) => number;
  total: (taxRate: number, serviceChargeRate: number) => number;
}

const calculateSubtotal = (items: CartItem[]) => {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      customerName: '',
      isWaitingXenditPayment: false,
      xenditTransactionCreatedAt: null,
      subtotal: 0,

      addItem: (product, quantity) => {
        const items = get().items;
        const existing = items.find((item) => item.productId === product.productId);
        let newItems;

        if (existing) {
          newItems = items.map((item) =>
            item.productId === product.productId
              ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.price,
              }
              : item
          );
        } else {
          newItems = [
            ...items,
            {
              id: `cart-${product.productId}`,
              productId: product.productId,
              name: product.name,
              price: product.price,
              quantity,
              subtotal: product.price * quantity,
            },
          ];
        }

        set({
          items: newItems,
          subtotal: calculateSubtotal(newItems)
        });
      },

      removeItem: (productId) => {
        const newItems = get().items.filter((item) => item.productId !== productId);
        set({
          items: newItems,
          subtotal: calculateSubtotal(newItems)
        });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const newItems = get().items.map((item) =>
          item.productId === productId
            ? { ...item, quantity, subtotal: quantity * item.price }
            : item
        );

        set({
          items: newItems,
          subtotal: calculateSubtotal(newItems)
        });
      },

      setDiscount: (amount) => set({ discount: amount }),
      setCustomerName: (name) => set({ customerName: name }),
      setWaitingXenditPayment: (isWaiting, createdAt) => set({
        isWaitingXenditPayment: isWaiting,
        xenditTransactionCreatedAt: createdAt ?? null,
      }),

      clear: () => set({
        items: [],
        discount: 0,
        customerName: '',
        isWaitingXenditPayment: false,
        xenditTransactionCreatedAt: null,
        subtotal: 0
      }),

      serviceCharge: (rate) => {
        const subtotal = get().subtotal;
        const discount = get().discount;
        const taxable = Math.max(0, subtotal - discount);
        return taxable * (rate / 100);
      },

      tax: (taxRate, serviceChargeRate) => {
        const subtotal = get().subtotal;
        const discount = get().discount;
        const taxable = Math.max(0, subtotal - discount);
        const sc = taxable * (serviceChargeRate / 100);
        return (taxable + sc) * (taxRate / 100);
      },

      total: (taxRate, serviceChargeRate) => {
        const subtotal = get().subtotal;
        const discount = get().discount;
        const taxable = Math.max(0, subtotal - discount);
        const sc = get().serviceCharge(serviceChargeRate);
        const tx = get().tax(taxRate, serviceChargeRate);
        return taxable + sc + tx;
      },
    }),
    {
      name: 'pos-pro-cart',
    }
  )
);

export type { CartItem };
