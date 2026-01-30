"use client";

import { ExternalLink, FileText, ZoomIn, ZoomOut } from "lucide-react";

type CvPdfViewerProps = {
  pdfBlobUrl?: string | null;
  pdfUrl?: string | null;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  pdfLoading: boolean;
  pdfLoadError: string | null;
  debugLogs: string[];
};

export default function CvPdfViewer({
  pdfBlobUrl,
  pdfUrl,
  zoom,
  onZoomIn,
  onZoomOut,
  pdfLoading,
  pdfLoadError,
  debugLogs,
}: CvPdfViewerProps) {
  const hasPdf = Boolean(pdfBlobUrl || pdfUrl);
  const src = pdfBlobUrl || pdfUrl || undefined;

  return (
    <div className="w-[55%] h-full bg-zinc-900 overflow-hidden relative flex flex-col border-r border-gray-200">
      <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Original Resume</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-zinc-600 bg-zinc-700 p-1 shadow-sm">
          <button onClick={onZoomOut} className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs font-medium text-zinc-300">{zoom}%</span>
          <button onClick={onZoomIn} className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-3 w-px bg-zinc-600" />
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors" title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="relative flex-1 w-full bg-zinc-900 overflow-hidden">
        {hasPdf ? (
          <div className="h-full w-full overflow-auto p-8 flex justify-center custom-scrollbar">
            <div style={{ width: `${zoom}%`, transition: "width 0.2s" }} className="shadow-2xl">
              <iframe src={src} className="min-h-[calc(100vh-10rem)] w-full bg-white rounded-sm" title="PDF Viewer" />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
            <div className="rounded-full bg-zinc-800 p-4">
              <FileText className="h-8 w-8 text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-500">No Document Available</p>
              {pdfLoading && <p className="text-xs mt-1 text-zinc-500">Loading document from secure storage...</p>}
              {pdfLoadError && <p className="text-xs text-red-600 mt-1">{pdfLoadError}</p>}
              {pdfLoadError && debugLogs.length > 0 && (
                <div className="mt-4 w-full text-left bg-zinc-950 p-2 rounded text-[10px] text-zinc-500 font-mono overflow-auto max-h-32">
                  <div className="text-zinc-400 font-bold mb-1">Debug Info:</div>
                  {debugLogs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
