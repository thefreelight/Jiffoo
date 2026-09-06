export {
  CoreApiError,
  isCoreApiError,
  type CoreApiErrorInfo,
} from './errors';

export type {
  CoreApiErrorEnvelope,
  CoreApiSuccessEnvelope,
  CoreApiEnvelope,
} from './types';

export {
  createCoreOpenApiClient,
  type CoreApiRequestIdProvider,
  type CoreApiTokenProvider,
  type CoreOpenApiClient,
  type CoreOpenApiClientOptions,
} from './openapi-client';

export type { paths, components, operations } from './openapi-types';

// ============================================================================
// Admin Response Type Aliases
// Extracted from the generated OpenAPI paths for convenient import.
// ============================================================================

import type { paths } from './openapi-types';

type Get200Json<P> = P extends { get: { responses: { 200: { content: { 'application/json': infer T } } } } } ? T : never;
type Put200Json<P> = P extends { put: { responses: { 200: { content: { 'application/json': infer T } } } } } ? T : never;
type Post200Json<P> = P extends { post: { responses: { 200: { content: { 'application/json': infer T } } } } } ? T : never;
type Post201Json<P> = P extends { post: { responses: { 201: { content: { 'application/json': infer T } } } } } ? T : never;
type Patch200Json<P> = P extends { patch: { responses: { 200: { content: { 'application/json': infer T } } } } } ? T : never;
type Delete200Json<P> = P extends { delete: { responses: { 200: { content: { 'application/json': infer T } } } } } ? T : never;

type UnwrapData<T> = T extends { data: infer D } ? D : never;

// Dashboard
export type AdminDashboardResponse = Get200Json<paths['/api/v1/admin/dashboard']>;
export type AdminDashboardData = UnwrapData<AdminDashboardResponse>;

// User stats
export type AdminUserStatsResponse = Get200Json<paths['/api/v1/admin/users/stats']>;
export type AdminUserStatsData = UnwrapData<AdminUserStatsResponse>;

// User list item
type AdminUserListResponse = Get200Json<paths['/api/v1/admin/users/']>;
type AdminUserListData = UnwrapData<AdminUserListResponse>;
export type AdminUserListItem = AdminUserListData extends { items: Array<infer T> } ? T : never;

// User detail
export type AdminUserDetailResponse = Get200Json<paths['/api/v1/admin/users/{id}']>;
export type AdminUserDetail = UnwrapData<AdminUserDetailResponse>;
export type AdminUserDeleteResponse = Delete200Json<paths['/api/v1/admin/users/{id}']>;
export type AdminUserDeleteData = UnwrapData<AdminUserDeleteResponse>;
export type AdminUserResetPasswordResponse = Patch200Json<paths['/api/v1/admin/users/{id}/password']>;
export type AdminUserResetPasswordData = UnwrapData<AdminUserResetPasswordResponse>;

// Product stats
export type AdminProductStatsResponse = Get200Json<paths['/api/v1/admin/products/stats']>;
export type AdminProductStatsData = UnwrapData<AdminProductStatsResponse>;

// Product list item
type AdminProductListResponse = Get200Json<paths['/api/v1/admin/products/']>;
type AdminProductListData = UnwrapData<AdminProductListResponse>;
export type AdminProductListItem = AdminProductListData extends { items: Array<infer T> } ? T : never;

// Product detail
export type AdminProductDetailResponse = Get200Json<paths['/api/v1/admin/products/{id}']>;
export type AdminProductDetail = UnwrapData<AdminProductDetailResponse>;
type AdminProductCategoriesResponse = Get200Json<paths['/api/v1/admin/products/categories']>;
type AdminProductCategoriesData = UnwrapData<AdminProductCategoriesResponse>;
export type AdminProductCategoryItem = AdminProductCategoriesData extends { items: Array<infer T> } ? T : never;

// Order stats
export type AdminOrderStatsResponse = Get200Json<paths['/api/v1/admin/orders/stats']>;
export type AdminOrderStatsData = UnwrapData<AdminOrderStatsResponse>;

// Order list item
type AdminOrderListResponse = Get200Json<paths['/api/v1/admin/orders/']>;
type AdminOrderListData = UnwrapData<AdminOrderListResponse>;
export type AdminOrderListItem = AdminOrderListData extends { items: Array<infer T> } ? T : never;

// Order detail
export type AdminOrderDetailResponse = Get200Json<paths['/api/v1/admin/orders/{id}']>;
export type AdminOrderDetail = UnwrapData<AdminOrderDetailResponse>;

// External source
export type AdminExternalSourceResponse = Get200Json<paths['/api/v1/admin/products/{id}/external-source']>;
export type AdminExternalSourceData = UnwrapData<AdminExternalSourceResponse>;

// External source ack
export type AdminExternalSourceAckResponse = Post200Json<paths['/api/v1/admin/products/{id}/ack-source-change']>;
export type AdminExternalSourceAckData = UnwrapData<AdminExternalSourceAckResponse>;

// External source variant ack
export type AdminExternalSourceVariantAckResponse = Post200Json<paths['/api/v1/admin/products/{id}/variants/{variantId}/ack-source-change']>;
export type AdminExternalSourceVariantAckData = UnwrapData<AdminExternalSourceVariantAckResponse>;
