export type Entitlements = {
  plan: string;
  /** Which suite products the current plan grants access to, e.g. ['core', 'uptime']. */
  products: string[];
  limits: Record<string, Record<string, number>>;
};
