import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AdminReport, BadRequestResponse, Cart, CartItemInput, CartItemQuantityUpdate, CheckoutInput, ConflictResponse, GenerateCoupon200, HealthStatus, ListProducts200, NotFoundResponse, Order, RewardConfig, RewardConfigUpdate } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Check service health
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Check service health
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListProductsUrl: () => string;
/**
 * @summary List active products
 */
export declare const listProducts: (options?: Parameters<typeof customFetch>[1]) => Promise<ListProducts200>;
export declare const getListProductsQueryKey: () => readonly ["/api/products"];
export declare const getListProductsQueryOptions: <TData = Awaited<ReturnType<typeof listProducts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProductsQueryResult = NonNullable<Awaited<ReturnType<typeof listProducts>>>;
export type ListProductsQueryError = ErrorType<unknown>;
/**
 * @summary List active products
 */
export declare function useListProducts<TData = Awaited<ReturnType<typeof listProducts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCartUrl: () => string;
/**
 * @summary Create an empty cart
 */
export declare const createCart: (options?: Parameters<typeof customFetch>[1]) => Promise<Cart>;
export declare const getCreateCartMutationKey: () => readonly ["createCart"];
export declare const getCreateCartMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCart>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCart>>, TError, void, TContext>;
export type CreateCartMutationResult = NonNullable<Awaited<ReturnType<typeof createCart>>>;
export type CreateCartMutationError = ErrorType<unknown>;
/**
* @summary Create an empty cart
*/
export declare const useCreateCart: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCart>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCart>>, TError, void, TContext>;
export declare const getGetCartUrl: (cartId: string) => string;
/**
 * @summary Retrieve a cart and current catalog prices
 */
export declare const getCart: (cartId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Cart>;
export declare const getGetCartQueryKey: (cartId: string) => readonly [`/api/carts/${string}`];
export declare const getGetCartQueryOptions: <TData = Awaited<ReturnType<typeof getCart>>, TError = ErrorType<NotFoundResponse>>(cartId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCart>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCart>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCartQueryResult = NonNullable<Awaited<ReturnType<typeof getCart>>>;
export type GetCartQueryError = ErrorType<NotFoundResponse>;
/**
 * @summary Retrieve a cart and current catalog prices
 */
export declare function useGetCart<TData = Awaited<ReturnType<typeof getCart>>, TError = ErrorType<NotFoundResponse>>(cartId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCart>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAddCartItemUrl: (cartId: string) => string;
/**
 * Adds to the existing quantity when the product is already in the cart.
 * @summary Add a quantity to a cart line
 */
export declare const addCartItem: (cartId: string, cartItemInput: CartItemInput, options?: Parameters<typeof customFetch>[1]) => Promise<Cart>;
export declare const getAddCartItemMutationKey: () => readonly ["addCartItem"];
export declare const getAddCartItemMutationOptions: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addCartItem>>, TError, AddCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addCartItem>>, TError, AddCartItemMutationVariables, TContext>;
export type AddCartItemMutationResult = NonNullable<Awaited<ReturnType<typeof addCartItem>>>;
export type AddCartItemMutationBody = BodyType<CartItemInput>;
export type AddCartItemMutationError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>;
export type AddCartItemMutationVariables = {
    cartId: string;
    data: BodyType<CartItemInput>;
};
/**
* @summary Add a quantity to a cart line
*/
export declare const useAddCartItem: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addCartItem>>, TError, AddCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addCartItem>>, TError, AddCartItemMutationVariables, TContext>;
export declare const getUpdateCartItemUrl: (cartId: string, productId: string) => string;
/**
 * @summary Set a cart line quantity
 */
export declare const updateCartItem: (cartId: string, productId: string, cartItemQuantityUpdate: CartItemQuantityUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<Cart>;
export declare const getUpdateCartItemMutationKey: () => readonly ["updateCartItem"];
export declare const getUpdateCartItemMutationOptions: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCartItem>>, TError, UpdateCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCartItem>>, TError, UpdateCartItemMutationVariables, TContext>;
export type UpdateCartItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateCartItem>>>;
export type UpdateCartItemMutationBody = BodyType<CartItemQuantityUpdate>;
export type UpdateCartItemMutationError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>;
export type UpdateCartItemMutationVariables = {
    cartId: string;
    productId: string;
    data: BodyType<CartItemQuantityUpdate>;
};
/**
* @summary Set a cart line quantity
*/
export declare const useUpdateCartItem: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCartItem>>, TError, UpdateCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCartItem>>, TError, UpdateCartItemMutationVariables, TContext>;
export declare const getRemoveCartItemUrl: (cartId: string, productId: string) => string;
/**
 * @summary Remove a product from a cart
 */
export declare const removeCartItem: (cartId: string, productId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Cart>;
export declare const getRemoveCartItemMutationKey: () => readonly ["removeCartItem"];
export declare const getRemoveCartItemMutationOptions: <TError = ErrorType<NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeCartItem>>, TError, RemoveCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeCartItem>>, TError, RemoveCartItemMutationVariables, TContext>;
export type RemoveCartItemMutationResult = NonNullable<Awaited<ReturnType<typeof removeCartItem>>>;
export type RemoveCartItemMutationError = ErrorType<NotFoundResponse | ConflictResponse>;
export type RemoveCartItemMutationVariables = {
    cartId: string;
    productId: string;
};
/**
* @summary Remove a product from a cart
*/
export declare const useRemoveCartItem: <TError = ErrorType<NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeCartItem>>, TError, RemoveCartItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeCartItem>>, TError, RemoveCartItemMutationVariables, TContext>;
export declare const getCheckoutCartUrl: (cartId: string) => string;
/**
 * @summary Check out a cart
 */
export declare const checkoutCart: (cartId: string, checkoutInput?: CheckoutInput, options?: Parameters<typeof customFetch>[1]) => Promise<Order>;
export declare const getCheckoutCartMutationKey: () => readonly ["checkoutCart"];
export declare const getCheckoutCartMutationOptions: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof checkoutCart>>, TError, CheckoutCartMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof checkoutCart>>, TError, CheckoutCartMutationVariables, TContext>;
export type CheckoutCartMutationResult = NonNullable<Awaited<ReturnType<typeof checkoutCart>>>;
export type CheckoutCartMutationBody = BodyType<CheckoutInput> | undefined;
export type CheckoutCartMutationError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>;
export type CheckoutCartMutationVariables = {
    cartId: string;
    data?: BodyType<CheckoutInput>;
};
/**
* @summary Check out a cart
*/
export declare const useCheckoutCart: <TError = ErrorType<BadRequestResponse | NotFoundResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof checkoutCart>>, TError, CheckoutCartMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof checkoutCart>>, TError, CheckoutCartMutationVariables, TContext>;
export declare const getGetOrderUrl: (orderId: string) => string;
/**
 * @summary Retrieve an order and its purchase snapshots
 */
export declare const getOrder: (orderId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Order>;
export declare const getGetOrderQueryKey: (orderId: string) => readonly [`/api/orders/${string}`];
export declare const getGetOrderQueryOptions: <TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<NotFoundResponse>>(orderId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOrderQueryResult = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
export type GetOrderQueryError = ErrorType<NotFoundResponse>;
/**
 * @summary Retrieve an order and its purchase snapshots
 */
export declare function useGetOrder<TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<NotFoundResponse>>(orderId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetRewardConfigUrl: () => string;
/**
 * @summary Get reward milestone settings
 */
export declare const getRewardConfig: (options?: Parameters<typeof customFetch>[1]) => Promise<RewardConfig>;
export declare const getGetRewardConfigQueryKey: () => readonly ["/api/admin/rewards/config"];
export declare const getGetRewardConfigQueryOptions: <TData = Awaited<ReturnType<typeof getRewardConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRewardConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRewardConfig>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRewardConfigQueryResult = NonNullable<Awaited<ReturnType<typeof getRewardConfig>>>;
export type GetRewardConfigQueryError = ErrorType<unknown>;
/**
 * @summary Get reward milestone settings
 */
export declare function useGetRewardConfig<TData = Awaited<ReturnType<typeof getRewardConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRewardConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateRewardConfigUrl: () => string;
/**
 * @summary Set reward milestone settings for future coupon generation
 */
export declare const updateRewardConfig: (rewardConfigUpdate: RewardConfigUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<RewardConfig>;
export declare const getUpdateRewardConfigMutationKey: () => readonly ["updateRewardConfig"];
export declare const getUpdateRewardConfigMutationOptions: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateRewardConfig>>, TError, UpdateRewardConfigMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateRewardConfig>>, TError, UpdateRewardConfigMutationVariables, TContext>;
export type UpdateRewardConfigMutationResult = NonNullable<Awaited<ReturnType<typeof updateRewardConfig>>>;
export type UpdateRewardConfigMutationBody = BodyType<RewardConfigUpdate>;
export type UpdateRewardConfigMutationError = ErrorType<BadRequestResponse>;
export type UpdateRewardConfigMutationVariables = {
    data: BodyType<RewardConfigUpdate>;
};
/**
* @summary Set reward milestone settings for future coupon generation
*/
export declare const useUpdateRewardConfig: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateRewardConfig>>, TError, UpdateRewardConfigMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateRewardConfig>>, TError, UpdateRewardConfigMutationVariables, TContext>;
export declare const getGenerateCouponUrl: () => string;
/**
 * @summary Generate the next eligible milestone coupon
 */
export declare const generateCoupon: (options?: Parameters<typeof customFetch>[1]) => Promise<GenerateCoupon200>;
export declare const getGenerateCouponMutationKey: () => readonly ["generateCoupon"];
export declare const getGenerateCouponMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateCoupon>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateCoupon>>, TError, void, TContext>;
export type GenerateCouponMutationResult = NonNullable<Awaited<ReturnType<typeof generateCoupon>>>;
export type GenerateCouponMutationError = ErrorType<unknown>;
/**
* @summary Generate the next eligible milestone coupon
*/
export declare const useGenerateCoupon: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateCoupon>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateCoupon>>, TError, void, TContext>;
export declare const getGetAdminReportUrl: () => string;
/**
 * @summary Get a read-only reconciliation report
 */
export declare const getAdminReport: (options?: Parameters<typeof customFetch>[1]) => Promise<AdminReport>;
export declare const getGetAdminReportQueryKey: () => readonly ["/api/admin/report"];
export declare const getGetAdminReportQueryOptions: <TData = Awaited<ReturnType<typeof getAdminReport>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAdminReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAdminReportQueryResult = NonNullable<Awaited<ReturnType<typeof getAdminReport>>>;
export type GetAdminReportQueryError = ErrorType<unknown>;
/**
 * @summary Get a read-only reconciliation report
 */
export declare function useGetAdminReport<TData = Awaited<ReturnType<typeof getAdminReport>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map