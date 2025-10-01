"use client";
import React, { useEffect, useRef, useState } from "react";

// Lazy thumbnail generator for PDF certificates using pdfjs-dist
// Props: url (string) - public PDF URL
// Renders a canvas snapshot (first page) and fallback skeleton while loading
export const CertificateThumbnail: React.FC<{
  url: string;
  className?: string;
}> = ({ url, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!url || !canvasRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        // worker setup (only once globally) - guard on window
        if (typeof window !== "undefined") {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }

        const doc = await pdfjs.getDocument({ url, withCredentials: false })
          .promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.25 }); // small scale for thumbnail
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context missing");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal memuat thumbnail");
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className={className} style={{ fontSize: 12, color: "#c00" }}>
        PDF
      </div>
    );
  }
  return (
    <div className={className} style={{ position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            background: "rgba(0,0,0,0.05)",
          }}
        >
          Memuat...
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: loading ? "none" : "block",
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export default CertificateThumbnail;
