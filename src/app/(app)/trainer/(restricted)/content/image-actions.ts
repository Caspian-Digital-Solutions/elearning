"use server";

import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;
const maxBytes = 5 * 1024 * 1024;
const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function safeSegment(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return base.slice(0, 80) || "image";
}

export async function uploadContentImage(formData: FormData): Promise<ActionResult<{ markdown: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }

  const folder = String(formData.get("folder") ?? "");
  const contentId = String(formData.get("contentId") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  const confirmed = formData.get("noClientData") === "true";
  const file = formData.get("file");

  if (folder !== "lessons" && folder !== "pages") {
    return { ok: false, error: "Invalid upload folder." };
  }
  if (!contentId || !/^[0-9a-f-]{36}$/i.test(contentId)) {
    return { ok: false, error: "Save a draft first so this item has an id." };
  }
  if (!alt) {
    return { ok: false, error: "Enter alt text describing the image." };
  }
  if (!confirmed) {
    return { ok: false, error: "Confirm the image contains no client data before uploading." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: "Images must be 5 MB or smaller." };
  }
  if (!allowedMime.has(file.type)) {
    return { ok: false, error: "Use PNG, JPG, WEBP or GIF." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const objectPath = `${folder}/${contentId}/${Date.now()}-${safeSegment(file.name)}.${ext}`;

  const supabase = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from("content-images").upload(objectPath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The image was not uploaded.") };
  }

  const markdown = `![${alt.replace(/]/g, "")}](/content-image/${objectPath})`;
  return { ok: true, data: { markdown } };
}
