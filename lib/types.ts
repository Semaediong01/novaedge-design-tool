// lib/types.ts
export const CATEGORIES = ["T-Shirts", "Hoodies", "Sweatshirts", "Joggers", "Caps", "Accessories"] as const;

export const ORDER_STATUSES = ["pending", "paid", "printing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
};

export type Order = {
  id: string;
  user_id: string;
  email: string;
  reference: string;
  status: OrderStatus;
  total: number;
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
