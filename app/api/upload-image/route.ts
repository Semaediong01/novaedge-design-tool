import { createStagedUpload, createFileFromStagedUpload, getFileStatus } from "@/lib/shopify";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  const staged = await createStagedUpload(file.name, file.type, file.size.toString());

  const uploadForm = new FormData();
  staged.parameters.forEach((p: any) => uploadForm.append(p.name, p.value));
  uploadForm.append("file", file);
  await fetch(staged.url, { method: "POST", body: uploadForm });

  const created = await createFileFromStagedUpload(staged.resourceUrl, file.name);
  if (!created?.id) {
    return Response.json({ url: null, error: "File creation failed" });
  }

  // Poll the SAME file's status — do not re-create it
  let url: string | null = null;
  for (let i = 0; i < 10; i++) {
    const status = await getFileStatus(created.id);
    if (status?.image?.url) {
      url = status.image.url;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return Response.json({ url });
}