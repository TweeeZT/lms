"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

// Dynamic import to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  error?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis sesuatu...",
  minHeight = "300px",
  error,
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      ["link"],
      [{ color: [] }, { background: [] }],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "indent",
    "link",
    "color",
    "background",
  ];

  if (!mounted) {
    return (
      <div
        style={{
          minHeight,
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "12px",
          backgroundColor: "#f8f9fa",
        }}
      >
        Loading editor...
      </div>
    );
  }

  return (
    <div>
      <style jsx global>{`
        .quill-editor-wrapper .ql-container {
          min-height: ${minHeight};
          font-size: 16px;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }
        .quill-editor-wrapper .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #f8f9fa;
        }
        .quill-editor-wrapper .ql-editor {
          min-height: ${minHeight};
          font-size: 16px;
          line-height: 1.8;
        }
        .quill-editor-wrapper .ql-editor p {
          margin-bottom: 1em;
        }
        .quill-editor-wrapper .ql-editor h1,
        .quill-editor-wrapper .ql-editor h2,
        .quill-editor-wrapper .ql-editor h3 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        .quill-editor-wrapper .ql-editor ul,
        .quill-editor-wrapper .ql-editor ol {
          margin-bottom: 1em;
        }
        .quill-editor-wrapper.error .ql-container {
          border-color: #fa5252;
        }
      `}</style>
      <div className={`quill-editor-wrapper ${error ? "error" : ""}`}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
        />
      </div>
      {error && (
        <div style={{ color: "#fa5252", fontSize: "14px", marginTop: "8px" }}>
          {error}
        </div>
      )}
    </div>
  );
}
