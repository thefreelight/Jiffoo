/**
 * Cart-related types
 *
 * NOTE: The canonical response types live in `./dto/cart-dto.ts`.
 * This file re-exports them as `Cart` / `CartItem` for convenience,
 * so that existing consumers (`theme.ts`, `shop/store/cart.ts`, etc.)
 * can keep using the shorter names without breaking imports.
 */

export type { CartDTO as Cart, CartItemDTO as CartItem } from './dto/cart-dto';
export type { AddToCartRequestDTO as AddToCartRequest } from './dto/cart-dto';
export type { UpdateCartItemRequestDTO as UpdateCartItemRequest } from './dto/cart-dto';
