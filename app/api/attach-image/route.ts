// app/api/attach-image/route.ts
import { addProductImage } from "@/lib/shopify";

const IMAGES_TO_ATTACH = [
  {
    productId: "gid://shopify/Product/10229182759149", // Classic Tee
    imageUrl: "https://novaedgeonline.myshopify.com/cdn/shop/files/MyLaptop_sDownSoIThoughtOfComingOutToday.jpg?v=1789725987",
    alt: "My Laptop's Down T-Shirt",
  },
  {
    productId: "gid://shopify/Product/10229182791917", // Graphic Tee
    imageUrl: "https://novaedgeonline.myshopify.com/cdn/shop/files/Network_No_Dey_But_We_Dey_Tee.jpg?v=1789725986",
    alt: "Network No Dey But We Dey T-Shirt",
  },
];

export async function GET() {
  const results = [];

  for (const item of IMAGES_TO_ATTACH) {
    const result = await addProductImage(item.productId, item.imageUrl, item.alt);
    results.push({ productId: item.productId, result });
  }

  return Response.json(results);
}