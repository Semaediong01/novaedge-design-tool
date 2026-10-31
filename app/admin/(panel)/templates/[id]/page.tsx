// app/admin/(panel)/templates/[id]/page.tsx — edit a template in the designer
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveTemplate } from "../actions";
import { templateCategories } from "../categories";
import TemplateEditor from "../TemplateEditor";

export const metadata = { title: "Edit template · Admin · Nova Edge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: t } = await supabase.from("templates").select("id, title, category, elements, preview_url").eq("id", id).maybeSingle();
  if (!t) notFound();

  const categories = await templateCategories();
  return (
    <TemplateEditor
      key={t.id}
      userId={user.id}
      save={saveTemplate}
      draft={{ id: t.id, title: t.title, category: t.category, categories, elements: Array.isArray(t.elements) ? t.elements : [], previewUrl: t.preview_url }}
    />
  );
}
