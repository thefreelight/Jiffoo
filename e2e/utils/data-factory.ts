/**
 * Data Factory Utility
 *
 * Creates and manages test data through API calls.
 * Ensures proper cleanup after tests.
 *
 * Requirements: 27.1, 27.2, 27.5
 */

import { APIRequestContext } from '@playwright/test';

// ============================================
// Types
// ============================================

export interface UserData {
  id?: string;
  email: string;
  password: string;
  username: string;
  tenantId?: number;
}

export interface ProductData {
  id?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  tenantId: number;
  images?: string[];
}

export interface OrderData {
  id?: string;
  userId: string;
  tenantId: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status?: string;
}

export interface TenantData {
  id?: number;
  name: string;
  domain?: string;
  email: string;
}

// ============================================
// Data Factory Class
// ============================================

export class DataFactory {
  private createdUsers: string[] = [];
  private createdProducts: string[] = [];
  private createdOrders: string[] = [];
  private createdTenants: number[] = [];
  private authToken?: string;

  constructor(
    private request: APIRequestContext,
    private baseUrl: string
  ) {}

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(tenantId?: number): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId.toString();
    }
    return headers;
  }

  // ============================================
  // User Management
  // ============================================

  /**
   * Create a test user
   */
  async createUser(data?: Partial<UserData>): Promise<UserData> {
    const timestamp = Date.now();
    const userData: UserData = {
      email: `test-user-${timestamp}@example.com`,
      password: 'TestPassword123!',
      username: `testuser-${timestamp}`,
      ...data,
    };

    const response = await this.request.post(`${this.baseUrl}/api/auth/register`, {
      data: userData,
      headers: this.getHeaders(userData.tenantId),
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create user: ${response.status()} - ${errorText}`);
    }

    const result = await response.json();
    const userId = result.data?.id || result.id;
    
    if (userId) {
      this.createdUsers.push(userId);
      return { ...userData, id: userId };
    }

    return userData;
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.request.delete(`${this.baseUrl}/api/users/${userId}`, {
        headers: this.getHeaders(),
      });
      this.createdUsers = this.createdUsers.filter(id => id !== userId);
    } catch (error) {
      console.warn(`Failed to delete user ${userId}:`, error);
    }
  }

  /**
   * Login and get auth token
   */
  async login(email: string, password: string, tenantId?: number): Promise<string> {
    const response = await this.request.post(`${this.baseUrl}/api/auth/login`, {
      data: { email, password },
      headers: this.getHeaders(tenantId),
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to login: ${response.status()} - ${errorText}`);
    }

    const result = await response.json();
    const token = result.data?.token || result.token;
    this.authToken = token;
    return token;
  }

  // ============================================
  // Product Management
  // ============================================

  /**
   * Create a test product
   */
  async createProduct(tenantId: number, data?: Partial<ProductData>): Promise<ProductData> {
    const timestamp = Date.now();
    const productData: ProductData = {
      name: `Test Product ${timestamp}`,
      description: 'Test product description',
      price: 99.99,
      stock: 100,
      category: 'Test Category',
      tenantId,
      images: [],
      ...data,
    };

    const response = await this.request.post(`${this.baseUrl}/api/products`, {
      data: productData,
      headers: this.getHeaders(tenantId),
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create product: ${response.status()} - ${errorText}`);
    }

    const result = await response.json();
    const productId = result.data?.id || result.id;

    if (productId) {
      this.createdProducts.push(productId);
      return { ...productData, id: productId };
    }

    return productData;
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: string, tenantId?: number): Promise<void> {
    try {
      await this.request.delete(`${this.baseUrl}/api/products/${productId}`, {
        headers: this.getHeaders(tenantId),
      });
      this.createdProducts = this.createdProducts.filter(id => id !== productId);
    } catch (error) {
      console.warn(`Failed to delete product ${productId}:`, error);
    }
  }

  /**
   * Get a product by ID
   */
  async getProduct(productId: string, tenantId?: number): Promise<ProductData | null> {
    const response = await this.request.get(`${this.baseUrl}/api/products/${productId}`, {
      headers: this.getHeaders(tenantId),
    });

    if (!response.ok()) {
      return null;
    }

    const result = await response.json();
    return result.data || result;
  }

  // ============================================
  // Order Management
  // ============================================

  /**
   * Create a test order
   */
  async createOrder(data: Omit<OrderData, 'id'>): Promise<OrderData> {
    const response = await this.request.post(`${this.baseUrl}/api/orders`, {
      data,
      headers: this.getHeaders(data.tenantId),
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create order: ${response.status()} - ${errorText}`);
    }

    const result = await response.json();
    const orderId = result.data?.id || result.id;

    if (orderId) {
      this.createdOrders.push(orderId);
      return { ...data, id: orderId };
    }

    return data as OrderData;
  }

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string, tenantId?: number): Promise<void> {
    try {
      await this.request.delete(`${this.baseUrl}/api/orders/${orderId}`, {
        headers: this.getHeaders(tenantId),
      });
      this.createdOrders = this.createdOrders.filter(id => id !== orderId);
    } catch (error) {
      console.warn(`Failed to delete order ${orderId}:`, error);
    }
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string, tenantId?: number): Promise<OrderData | null> {
    const response = await this.request.get(`${this.baseUrl}/api/orders/${orderId}`, {
      headers: this.getHeaders(tenantId),
    });

    if (!response.ok()) {
      return null;
    }

    const result = await response.json();
    return result.data || result;
  }

  // ============================================
  // Tenant Management
  // ============================================

  /**
   * Create a test tenant
   */
  async createTenant(data?: Partial<TenantData>): Promise<TenantData> {
    const timestamp = Date.now();
    const tenantData: TenantData = {
      name: `Test Tenant ${timestamp}`,
      domain: `test-tenant-${timestamp}`,
      email: `tenant-${timestamp}@example.com`,
      ...data,
    };

    const response = await this.request.post(`${this.baseUrl}/api/super-admin/tenants`, {
      data: tenantData,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create tenant: ${response.status()} - ${errorText}`);
    }

    const result = await response.json();
    const tenantId = result.data?.id || result.id;

    if (tenantId) {
      this.createdTenants.push(tenantId);
      return { ...tenantData, id: tenantId };
    }

    return tenantData;
  }

  /**
   * Delete a tenant
   */
  async deleteTenant(tenantId: number): Promise<void> {
    try {
      await this.request.delete(`${this.baseUrl}/api/super-admin/tenants/${tenantId}`, {
        headers: this.getHeaders(),
      });
      this.createdTenants = this.createdTenants.filter(id => id !== tenantId);
    } catch (error) {
      console.warn(`Failed to delete tenant ${tenantId}:`, error);
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up all created test data
   */
  async cleanup(): Promise<void> {
    // Delete orders first (they depend on users and products)
    for (const orderId of this.createdOrders) {
      await this.deleteOrder(orderId);
    }

    // Delete products
    for (const productId of this.createdProducts) {
      await this.deleteProduct(productId);
    }

    // Delete users
    for (const userId of this.createdUsers) {
      await this.deleteUser(userId);
    }

    // Delete tenants last
    for (const tenantId of this.createdTenants) {
      await this.deleteTenant(tenantId);
    }

    // Reset tracking arrays
    this.createdOrders = [];
    this.createdProducts = [];
    this.createdUsers = [];
    this.createdTenants = [];
  }

  /**
   * Get counts of created test data
   */
  getCreatedCounts(): {
    users: number;
    products: number;
    orders: number;
    tenants: number;
  } {
    return {
      users: this.createdUsers.length,
      products: this.createdProducts.length,
      orders: this.createdOrders.length,
      tenants: this.createdTenants.length,
    };
  }
}

/**
 * Create a DataFactory instance
 */
export function createDataFactory(
  request: APIRequestContext,
  baseUrl: string
): DataFactory {
  return new DataFactory(request, baseUrl);
}
