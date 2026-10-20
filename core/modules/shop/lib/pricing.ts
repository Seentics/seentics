import type { Area } from "../interfaces";

/**
 * What an order costs, worked out on the server from the page and the store: a buyer's browser
 * says only what and how many, never how much.
 */
export function priceOrder(
  page: { price: number; freeDelivery: boolean; maxQuantity: number },
  store: { deliveryInsideDhaka: number; deliveryOutsideDhaka: number },
  quantity: number,
  area: Area,
): { quantity: number; unitPrice: number; deliveryCharge: number; total: number } {
  const q = Math.min(Math.max(1, Math.floor(quantity)), page.maxQuantity);
  const deliveryCharge = page.freeDelivery ? 0 : area === "inside_dhaka" ? store.deliveryInsideDhaka : store.deliveryOutsideDhaka;
  return { quantity: q, unitPrice: page.price, deliveryCharge, total: page.price * q + deliveryCharge };
}

/** Taka as sellers and buyers write it: ৳1,499; ৳1,00,000 (lakh grouping). */
export const taka = (n: number): string => `৳${n.toLocaleString("en-IN")}`;
