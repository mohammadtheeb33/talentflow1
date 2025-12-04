"use client";
import { useRef } from "react";

export function UploadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Upload File</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-gray-100">Close</button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <input ref={inputRef} type="file" className="w-full rounded border p-2" />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
          >
            Choose File
          </button>
          <p className="text-xs text-gray-500">CSV, XLSX, PDF are supported.</p>
        </div>
      </div>
    </div>
  );
}