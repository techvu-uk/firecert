"use client";
/** Photo capture: uses the phone camera, shrinks images before upload to save data. */
import { useRef, useState } from "react";
import type { PhotoValue } from "@/forms/types";
import { IconCamera, IconTrash } from "@/components/icons";

async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
}

export function PhotosField({
  certId,
  fieldName,
  value,
  max,
  onChange,
  disabled,
}: {
  certId: string;
  fieldName: string;
  value: PhotoValue[];
  max: number;
  onChange: (v: PhotoValue[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const room = max - value.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Only ${max} photos allowed`);
    setBusy(list.length);
    const added: PhotoValue[] = [];
    for (const f of list) {
      try {
        const blob = await shrink(f);
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        fd.append("field", fieldName);
        const res = await fetch(`/api/certificates/${certId}/photos`, { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        added.push({ id: json.id, caption: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed – check your connection");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((p, i) => (
            <div key={p.id} className="overflow-hidden rounded-lg border border-ink-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}`} alt={p.caption || `Photo ${i + 1}`} className="aspect-[4/3] w-full bg-ink-100 object-cover" />
              <div className="flex items-center gap-1 p-1.5">
                <input
                  value={p.caption ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(value.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))}
                  placeholder="Caption"
                  maxLength={200}
                  className="h-9 min-w-0 flex-1 rounded-md border border-ink-200 px-2 text-sm"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                    className="rounded-md p-2 text-ink-500 hover:bg-ink-100"
                    aria-label="Remove photo"
                  >
                    <IconTrash width={18} height={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled && value.length < max && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy > 0}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-700 shadow-sm hover:bg-ink-50 disabled:opacity-60"
          >
            <IconCamera />
            {busy > 0 ? `Uploading ${busy}…` : "Add photos"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-sm text-brand-700">{error}</p>}
    </div>
  );
}
