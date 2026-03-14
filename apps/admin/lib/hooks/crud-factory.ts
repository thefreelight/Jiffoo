/**
 * CRUD Hook Factory for React Query
 *
 * Generates standardized React Query hooks for CRUD operations to reduce boilerplate
 * and ensure consistency across resources.
 *
 * ## Features
 * - Automatic query caching and invalidation
 * - Built-in error handling with toast notifications
 * - Type-safe API integration
 * - Consistent pagination structure
 * - Smart cache key management
 *
 * ## Exports
 * - `createCrudHooks` - Main factory function
 * - `CrudFactoryConfig` - Configuration type
 * - `CrudHooks` - Return type of the factory
 * - `CrudApiMethods` - API method signatures interface
 * - `CrudPaginationParams` - Pagination parameters type
 * - `PaginatedResponse` - Standardized response type
 *
 * @example Basic Usage
 * ```ts
 * import { createCrudHooks } from './crud-factory';
 *
 * const productHooks = createCrudHooks({
 *   resource: 'products',
 *   api: {
 *     getAll: (params) => productsApi.getAll(params.page, params.limit, params.search),
 *     getById: (id) => productsApi.getById(id),
 *     create: (data) => productsApi.create(data),
 *     update: (id, data) => productsApi.update(id, data),
 *     delete: (id) => productsApi.delete(id),
 *   },
 *   messages: {
 *     createSuccess: 'Product created successfully',
 *     updateSuccess: 'Product updated successfully',
 *     deleteSuccess: 'Product deleted successfully',
 *   },
 * });
 *
 * // Use in components
 * function ProductList() {
 *   const { data, isLoading } = productHooks.useList({ page: 1, limit: 10 });
 *   const createProduct = productHooks.useCreate();
 *
 *   const handleCreate = async (formData) => {
 *     await createProduct.mutateAsync(formData);
 *   };
 *
 *   // ...
 * }
 * ```
 *
 * @example With Custom Transform
 * ```ts
 * const orderHooks = createCrudHooks({
 *   resource: 'orders',
 *   api: ordersApi,
 *   transformListResponse: (data, params) => ({
 *     data: data.items || [],
 *     pagination: {
 *       page: params.page || 1,
 *       limit: params.limit || 10,
 *       total: data.total || 0,
 *       totalPages: Math.ceil((data.total || 0) / (params.limit || 10))
 *     }
 *   }),
 * });
 * ```
 *
 * @module crud-factory
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiResponse } from '../api';

/**
 * Pagination and filter parameters for list queries
 *
 * @property page - Current page number (1-based)
 * @property limit - Number of items per page
 * @property search - Search query string
 */
export interface CrudPaginationParams {
  /** Current page number (1-based) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Search query string */
  search?: string;
  /** Additional filter parameters (resource-specific) */
  [key: string]: any;
}

/**
 * Standardized paginated response structure
 *
 * @template T - Type of items in the data array
 *
 * @property data - Array of items for the current page
 * @property pagination - Pagination metadata
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number (1-based) */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of items across all pages */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };
}

/**
 * API method signatures required by the CRUD factory
 *
 * @template TListItem - Type for items in list responses
 * @template TDetail - Type for detail responses
 * @template TCreateData - Type for create request payload
 * @template TUpdateData - Type for update request payload
 */
export interface CrudApiMethods<TListItem, TDetail, TCreateData, TUpdateData> {
  /** Fetch paginated list of resources */
  getAll: (params?: CrudPaginationParams) => Promise<ApiResponse<any>>;
  /** Fetch a single resource by ID */
  getById: (id: string) => Promise<ApiResponse<TDetail>>;
  /** Create a new resource */
  create: (data: TCreateData) => Promise<ApiResponse<TDetail>>;
  /** Update an existing resource */
  update: (id: string, data: TUpdateData) => Promise<ApiResponse<TDetail>>;
  /** Delete a resource */
  delete: (id: string) => Promise<ApiResponse<void>>;
}

/**
 * Configuration object for creating CRUD hooks
 *
 * @template TListItem - Type for items in list responses
 * @template TDetail - Type for detail responses (usually same as or extends TListItem)
 * @template TCreateData - Type for create request payload
 * @template TUpdateData - Type for update request payload
 */
export interface CrudFactoryConfig<TListItem, TDetail, TCreateData, TUpdateData> {
  /**
   * Resource name used for query keys and default messages
   * @example 'products', 'orders', 'users'
   */
  resource: string;

  /**
   * API methods for CRUD operations
   * Each method should return an ApiResponse<T> wrapper
   */
  api: CrudApiMethods<TListItem, TDetail, TCreateData, TUpdateData>;

  /**
   * Optional transformer to convert API response to standardized pagination format
   * Defaults to handling { items: T[], total: number } format
   *
   * @param data - Raw API response data
   * @param params - Original query parameters
   * @returns Standardized paginated response
   */
  transformListResponse?: (
    data: any,
    params: CrudPaginationParams
  ) => PaginatedResponse<TListItem>;

  /**
   * Custom toast notification messages
   * If not provided, default messages will be generated from the resource name
   */
  messages?: {
    /** Success message for create operations */
    createSuccess?: string;
    /** Success message for update operations */
    updateSuccess?: string;
    /** Success message for delete operations */
    deleteSuccess?: string;
    /** Error message for create operations (defaults to API error) */
    createError?: string;
    /** Error message for update operations (defaults to API error) */
    updateError?: string;
    /** Error message for delete operations (defaults to API error) */
    deleteError?: string;
  };

  /**
   * Time in milliseconds before cached data is considered stale
   * @default 300000 (5 minutes)
   */
  staleTime?: number;

  /**
   * Whether to show toast notifications for mutations
   * @default true
   */
  enableToasts?: boolean;
}

/**
 * Object containing all generated CRUD hooks and query keys
 *
 * @template TListItem - Type for items in list responses
 * @template TDetail - Type for detail responses
 * @template TCreateData - Type for create request payload
 * @template TUpdateData - Type for update request payload
 */
export interface CrudHooks<TListItem, TDetail, TCreateData, TUpdateData> {
  /**
   * Query hook for fetching paginated list of resources
   * Automatically caches and invalidates based on params
   */
  useList: (params?: CrudPaginationParams) => UseQueryResult<PaginatedResponse<TListItem>, Error>;

  /**
   * Query hook for fetching a single resource by ID
   * Automatically enabled only when ID is provided
   */
  useDetail: (id: string) => UseQueryResult<TDetail, Error>;

  /**
   * Mutation hook for creating new resources
   * Shows success toast and invalidates list queries on success
   */
  useCreate: () => UseMutationResult<TDetail, Error, TCreateData, unknown>;

  /**
   * Mutation hook for updating existing resources
   * Shows success toast and invalidates relevant queries on success
   */
  useUpdate: () => UseMutationResult<TDetail, Error, { id: string; data: TUpdateData }, unknown>;

  /**
   * Mutation hook for deleting resources
   * Shows success toast and invalidates relevant queries on success
   */
  useDelete: () => UseMutationResult<void, Error, string, unknown>;

  /**
   * Query key factory for consistent cache key generation
   * Use these keys for manual cache invalidation or optimistic updates
   */
  queryKeys: {
    /** Base query key for all queries of this resource */
    all: readonly [string];
    /** Query key for list queries with specific params */
    list: (params?: CrudPaginationParams) => readonly [string, CrudPaginationParams | undefined];
    /** Query key for detail queries with specific ID */
    detail: (id: string) => readonly [string, string];
  };
}

/**
 * Creates a set of standardized CRUD hooks for a resource
 *
 * This factory generates five hooks and a query key factory:
 * - `useList`: Query hook for paginated lists with filtering/search
 * - `useDetail`: Query hook for fetching a single resource by ID
 * - `useCreate`: Mutation hook for creating new resources
 * - `useUpdate`: Mutation hook for updating existing resources
 * - `useDelete`: Mutation hook for deleting resources
 * - `queryKeys`: Factory for generating consistent React Query cache keys
 *
 * All hooks include:
 * - Automatic error handling and toast notifications
 * - Smart cache invalidation on mutations
 * - TypeScript type safety for requests/responses
 * - Consistent API response unwrapping
 *
 * @template TListItem - Type for items in list responses (defaults to any)
 * @template TDetail - Type for detail responses (defaults to any)
 * @template TCreateData - Type for create request payload (defaults to Partial<TDetail>)
 * @template TUpdateData - Type for update request payload (defaults to Partial<TDetail>)
 *
 * @param config - Factory configuration object
 * @returns Object containing generated hooks and query keys
 *
 * @example
 * ```ts
 * // Create hooks for a products resource
 * const productHooks = createCrudHooks({
 *   resource: 'products',
 *   api: productsApi,
 *   messages: {
 *     createSuccess: 'Product created!',
 *     updateSuccess: 'Product updated!',
 *     deleteSuccess: 'Product deleted!',
 *   },
 * });
 *
 * // Use in components
 * const { data, isLoading } = productHooks.useList({ page: 1, limit: 10 });
 * const createProduct = productHooks.useCreate();
 * ```
 */
export function createCrudHooks<
  TListItem = any,
  TDetail = any,
  TCreateData = Partial<TDetail>,
  TUpdateData = Partial<TDetail>
>(
  config: CrudFactoryConfig<TListItem, TDetail, TCreateData, TUpdateData>
): CrudHooks<TListItem, TDetail, TCreateData, TUpdateData> {
  const {
    resource,
    api,
    transformListResponse,
    messages = {},
    staleTime = 5 * 60 * 1000,
    enableToasts = true,
  } = config;

  // Query key factory
  const queryKeys = {
    all: [resource] as const,
    list: (params?: CrudPaginationParams) => [resource, params] as const,
    detail: (id: string) => [resource, id] as const,
  };

  // Default list response transformer
  const defaultTransformListResponse = (
    data: any,
    params: CrudPaginationParams
  ): PaginatedResponse<TListItem> => {
    if (data.items && typeof data.total === 'number') {
      // Handle PageResult format { items, total }
      return {
        data: data.items || [],
        pagination: {
          page: params.page || 1,
          limit: params.limit || 10,
          total: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / (params.limit || 10)),
        },
      };
    }
    // Assume data is already in correct format
    return data as PaginatedResponse<TListItem>;
  };

  const transformList = transformListResponse || defaultTransformListResponse;

  // useList hook
  const useList = (params: CrudPaginationParams = {}) => {
    return useQuery({
      queryKey: queryKeys.list(params),
      queryFn: async () => {
        const response = await api.getAll(params);
        const data = response.success ? response.data : (() => { throw new Error(response.error as unknown as string); })();
        return transformList(data, params);
      },
      staleTime,
    });
  };

  // useDetail hook
  const useDetail = (id: string) => {
    return useQuery({
      queryKey: queryKeys.detail(id),
      queryFn: async () => {
        const response = await api.getById(id);
        if (response.success) {
          return response.data as TDetail;
        }
        throw new Error(response.error as unknown as string);
      },
      enabled: !!id,
    });
  };

  // useCreate hook
  const useCreate = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (data: TCreateData) => {
        const response = await api.create(data);
        if (response.success) {
          return response.data as TDetail;
        }
        throw new Error(response.error as unknown as string);
      },
      onSuccess: () => {
        // Invalidate all list queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.all,
          exact: false,
        });
        // Refetch list queries
        queryClient.refetchQueries({
          queryKey: queryKeys.all,
          exact: false,
        });
        if (enableToasts) {
          toast.success(messages.createSuccess || `${resource} created successfully`);
        }
      },
      onError: (error: Error) => {
        if (enableToasts) {
          toast.error(messages.createError || error.message);
        }
      },
    });
  };

  // useUpdate hook
  const useUpdate = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, data }: { id: string; data: TUpdateData }) => {
        const response = await api.update(id, data);
        if (response.success) {
          return response.data as TDetail;
        }
        throw new Error(response.error as unknown as string);
      },
      onSuccess: (_, { id }) => {
        // Invalidate all list queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.all,
          exact: false,
        });
        // Invalidate specific detail query
        queryClient.invalidateQueries({
          queryKey: queryKeys.detail(id),
        });
        if (enableToasts) {
          toast.success(messages.updateSuccess || `${resource} updated successfully`);
        }
      },
      onError: (error: Error) => {
        if (enableToasts) {
          toast.error(messages.updateError || error.message);
        }
      },
    });
  };

  // useDelete hook
  const useDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        const response = await api.delete(id);
        if (!response.success) {
          throw new Error(response.error as unknown as string);
        }
      },
      onSuccess: (_, deletedId) => {
        // Invalidate all list queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.all,
          exact: false,
        });
        // Remove specific detail query
        queryClient.removeQueries({
          queryKey: queryKeys.detail(deletedId),
        });
        // Refetch list queries
        queryClient.refetchQueries({
          queryKey: queryKeys.all,
          exact: false,
        });
        if (enableToasts) {
          toast.success(messages.deleteSuccess || `${resource} deleted successfully`);
        }
      },
      onError: (error: Error) => {
        if (enableToasts) {
          toast.error(messages.deleteError || error.message);
        }
      },
    });
  };

  return {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    queryKeys,
  };
}
