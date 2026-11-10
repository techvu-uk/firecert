"use client";
/** Finger/mouse signature capture. Produces a cropped PNG data URL. */
import { useEffect, useRef, useState } from "react";
import type { SignatureValue } from "@/forms/types";

export function SignaturePad({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: SignatureValue | undefined;
  onChange: (v: SignatureValue) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [editing, setEditing] = useState(!value?.image);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current!;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#151920";
      hasInk.current = false;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [editing]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
    hasInk.current = true;
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  const accept = () => {
    if (!hasInk.current) return;
    onChange({ image: cropToPng(canvasRef.current!), signedAt: new Date().toISOString() });
    setEditing(false);
  };

  if (!editing && value?.image) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.image} alt="Signature" className="h-16 max-w-[220px] object-contain" />
        {!disabled && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100">
            Re-sign
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={`relative rounded-lg border-2 border-dashed bg-white ${invalid ? "border-brand-400" : "border-ink-200"}`}>
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          aria-label="Signature area – sign with your finger or mouse"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-ink-200" />
        <span className="pointer-events-none absolute bottom-2 left-3 text-xs text-ink-400">Sign above the line</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={clear} className="h-10 rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-700">
          Clear
        </button>
        <button type="button" onClick={accept} className="h-10 rounded-lg bg-ink-800 px-4 text-sm font-semibold text-white">
          Use this signature
        </button>
        {value?.image && (
          <button type="button" onClick={() => setEditing(false)} className="h-10 px-3 text-sm font-semibold text-ink-500">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** Crops whitespace and downsizes so the stored image stays small. */
function cropToPng(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad);
  maxY = Math.min(height, maxY + pad);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(1, 600 / w, 200 / h);
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  out.getContext("2d")!.drawImage(canvas, minX, minY, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
