// app/admin/(panel)/products/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import type { Product } from "@/lib/types";

export default async function AdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];

  return (
    <>
      <div className="section-head">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="btn">Add product</Link>
      </div>

      {products.length === 0 ? (
        <p className="empty-state">No products yet. Add your first one to put it in the shop.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="table-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.images[0] && <img src={p.images[0]} alt="" />}
                </td>
                <td>{p.title}</td>
                <td>{p.category}</td>
                <td>{naira(p.price)}</td>
                <td>
                  {!p.active ? <span className="status status-cancelled">hidden</span> : !p.in_stock ? <span className="status status-pending">sold out</span> : <span className="status status-delivered">live</span>}
                </td>
                <td><Link href={`/admin/products/${p.id}`} className="text-link">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
