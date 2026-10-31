// lib/types.ts
// Categories the admin can start with. The live list of shop sections comes from the `sections` table.
export const CATEGORIES = ["T-Shirts", "Hoodies", "Joggers", "Caps", "Casuals", "Sweatshirts", "Accessories"] as const;

// Payment and fulfillment are tracked separately (an order can be paid but not yet shipped).
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const FULFILLMENT_STATUSES = ["new", "printing", "shipped", "delivered", "cancelled"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type Product = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  images: string[];
  sizes: string[];
  colors: string[];
  customizable: boolean;
  in_stock: boolean;
  active: boolean;
  created_at: string;
  // promo, home page, affiliate and personalization settings
  featured: boolean;
  sort_order: number;
  promo_price: number | null;
  promo_label: string | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  affiliate_rate: number | null;
  sold_out_variants: string[];
  symbol_default: boolean;
  allow_uploads: boolean;
};

export type Section = {
  name: string;
  sort_order: number;
  soon: boolean;
  visible: boolean;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  image: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  design_id: string | null;
  print_url: string | null;
  production_url: string | null;
  design_elements: unknown[] | null;
  discount_share: number;
  commission: number;
};

export type Order = {
  id: string;
  user_id: string;
  email: string;
  reference: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total: number;
  subtotal: number | null;
  discount_code: string | null;
  discount_amount: number;
  delivery_fee: number;
  delivery_zone: string | null;
  affiliate_id: string | null;
  affiliate_code: string | null;
  affiliate_commission: number;
  affiliate_paid: boolean;
  admin_note: string;
  shipping: Shipping;
  created_at: string;
  paid_at: string | null;
  order_items?: OrderItem[];
};

export type Shipping = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
};

export type Discount = {
  id: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  product_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
};

export type DeliveryZone = {
  id: string;
  name: string;
  states: string[];
  fee: number;
  active: boolean;
};

export type Affiliate = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  commission_rate: number;
  active: boolean;
  notes: string;
  created_at: string;
};

export type Template = {
  id: string;
  title: string;
  category: string;
  elements: unknown[];
  preview_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type SiteContent = {
  announcements: string[];
  hero_eyebrow: string;
  hero_title: string;
  hero_accent: string;
  hero_sub: string;
  footer_tagline: string;
  contact_email: string;
  contact_phone: string;
  instagram: string;
};

export type CartLine = {
  id: string; // unique line id
  productId: string;
  title: string;
  image: string | null;
  price: number;
  size: string;
  color: string;
  quantity: number;
  designId: string | null;
  printUrl: string | null;
};
