// app/admin/(panel)/templates/new/page.tsx — build a new template in the designer
import { requireAdmin } from "@/lib/auth";
import { saveTemplate } from "../actions";
import { templateCategories } from "../categories";
import TemplateEditor from "../TemplateEditor";

export const metadata = { title: "New template · Admin · Nova Edge" };

export default async function NewTemplate() {
  const user = await requireAdmin();
  const categories = await templateCategories();
  return (
    <TemplateEditor
      userId={user.id}
      save={saveTemplate}
      draft={{ id: null, title: "", category: "T-Shirts", categories, elements: [], previewUrl: null }}
    />
  );
}
