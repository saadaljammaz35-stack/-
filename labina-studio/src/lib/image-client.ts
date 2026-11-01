"use client";

import { getBrowserClient } from "./supabase/browser";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type UploadedImage = { url: string; path: string; width: number; height: number };

/** Downscales to max 2000px and re-encodes as WebP so pages stay fast */
async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (blob && blob.type === "image/webp") return { blob, width, height, ext: "webp" };
  return { blob: file, width, height, ext: file.type.split("/")[1] ?? "jpg" };
}

export async function uploadImage(file: File, folder: "gallery" | "services" | "home"): Promise<UploadedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error("نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("حجم الصورة كبير جداً (الحد 20 ميجابايت).");
  const supabase = getBrowserClient();
  if (!supabase) throw new Error("لم يتم ربط Supabase.");

  const { blob, width, height, ext } = await prepare(file);
  const month = new Date().toISOString().slice(0, 7);
  const path = `${folder}/${month}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, blob, {
    contentType: blob.type || file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    throw new Error(error.message.includes("row-level security") ? "ليست لديك صلاحية رفع الصور." : `تعذر رفع الصورة: ${error.message}`);
  }
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, path, width, height };
}
