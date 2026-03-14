import { create } from 'zustand';
import { b2bApi } from '@/lib/api';

// Quote types based on API response
export interface QuoteItem {
  id?: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
  // Cached product info for display
  productName?: string;
  productImage?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  companyId: string;
  userId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  validFrom: string;
  validUntil?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  notes?: string;
  customerNotes?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
  items?: QuoteItem[];
}

interface QuoteState {
  quotes: Quote[];
  currentQuote: Quote | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
}

interface QuoteActions {
  fetchQuotes: (params?: { page?: number; limit?: number; status?: string; companyId?: string }) => Promise<void>;
  fetchQuote: (quoteId: string) => Promise<void>;
  createQuote: (data: {
    companyId: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
      taxRate?: number;
      notes?: string;
    }>;
    notes?: string;
    customerNotes?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => Promise<Quote>;
  updateQuote: (quoteId: string, data: { status?: string; notes?: string; customerNotes?: string }) => Promise<void>;
  deleteQuote: (quoteId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState: QuoteState = {
  quotes: [],
  currentQuote: null,
  isLoading: false,
  error: null,
  page: 1,
  limit: 10,
  total: 0,
};

export const useQuoteStore = create<QuoteState & QuoteActions>((set, get) => ({
  // State
  ...initialState,

  // Actions
  fetchQuotes: async (params) => {
    try {
      set({ isLoading: true, error: null });
      const response = await b2bApi.getQuotes(params);

      if (response.success && response.data) {
        set({
          quotes: response.data.items || [],
          total: response.data.total || 0,
          page: response.data.page || 1,
          limit: response.data.limit || 10,
          isLoading: false,
        });
      } else {
        throw new Error(response.error?.message || 'Failed to fetch quotes');
      }
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: (error as { message?: string }).message || 'Failed to fetch quotes',
      });
    }
  },

  fetchQuote: async (quoteId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await b2bApi.getQuote(quoteId);

      if (response.success && response.data) {
        set({
          currentQuote: response.data,
          isLoading: false,
        });
      } else {
        throw new Error(response.error?.message || 'Failed to fetch quote');
      }
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: (error as { message?: string }).message || 'Failed to fetch quote',
      });
    }
  },

  createQuote: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await b2bApi.createQuote(data);

      if (response.success && response.data) {
        set({
          isLoading: false,
        });
        // Refresh quotes list
        await get().fetchQuotes();
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to create quote');
      }
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: (error as { message?: string }).message || 'Failed to create quote',
      });
      throw error;
    }
  },

  updateQuote: async (quoteId: string, data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await b2bApi.updateQuote(quoteId, data);

      if (response.success) {
        set({ isLoading: false });
        // Refresh quotes list
        await get().fetchQuotes();
      } else {
        throw new Error(response.error?.message || 'Failed to update quote');
      }
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: (error as { message?: string }).message || 'Failed to update quote',
      });
      throw error;
    }
  },

  deleteQuote: async (quoteId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await b2bApi.deleteQuote(quoteId);

      if (response.success) {
        set({ isLoading: false });
        // Refresh quotes list
        await get().fetchQuotes();
      } else {
        throw new Error(response.error?.message || 'Failed to delete quote');
      }
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: (error as { message?: string }).message || 'Failed to delete quote',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
