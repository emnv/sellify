"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { buttonClasses, HiddenField, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  shopId: string;
  /** Sub-folder inside the shop's media, e.g. "products" or "store". */
  folder: string;
  /** Form field name; one hidden input per uploaded URL. */
  name: string;
  label: string;
  defaultValue?: string[];
  max?: number;
};

/**
 * Uploads straight from the browser to the shop's folder in the `shop-media`
 * bucket (storage policies only allow the member's own shop folder). The
 * form then submits the public URLs, which the server checks again.
 */
export function ImageUploader({ shopId, folder, name, label, defaultValue = [], max = 8 }: Props) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = max - urls.length;
    const picked = Array.from(files).slice(0, room);
    const bad = picked.find((f) => !TYPES[f.type] || f.size > MAX_BYTES);
    if (bad) {
      setError(`${bad.name}: use a PNG, JPG, WebP or GIF under 5 MB.`);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const added: string[] = [];
    for (const file of picked) {
      const path = `${shopId}/${folder}/${crypto.randomUUID()}.${TYPES[file.type]}`;
      const { error: uploadError } = await supabase.storage.from("shop-media").upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError("Upload failed. Try again.");
        break;
      }
      added.push(supabase.storage.from("shop-media").getPublicUrl(path).data.publicUrl);
    }
    setUrls((u) => [...u, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-body font-medium text-fg">{label}</span>
      {urls.map((u) => (
        <HiddenField key={u} name={name} value={u} />
      ))}

      <ul className="flex flex-wrap gap-3" aria-label={`${label}: ${urls.length} uploaded`}>
        {urls.map((u, i) => (
          <li key={u} className="relative size-24 overflow-hidden rounded-md border border-border bg-surface-muted">
            <Image src={u} alt={`Photo ${i + 1}`} fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => setUrls((list) => list.filter((x) => x !== u))}
              className="absolute top-1 right-1 rounded-sm bg-surface px-1.5 text-small font-medium text-fg shadow-card hover:bg-danger-bg hover:text-danger-fg"
              aria-label={`Remove photo ${i + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {urls.length < max ? (
        <div>
          <label htmlFor={inputId} className={buttonClasses("secondary", "sm")} aria-disabled={busy || undefined}>
            {busy ? "Uploading…" : urls.length ? "Add more photos" : "Upload photos"}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={Object.keys(TYPES).join(",")}
            multiple={max > 1}
            disabled={busy}
            onChange={(e) => upload(e.target.files)}
            className="sr-only"
          />
          <p className="mt-1.5 text-small text-fg-subtle">PNG, JPG, WebP or GIF, up to 5 MB. {max > 1 ? `Up to ${max} photos.` : null}</p>
        </div>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
