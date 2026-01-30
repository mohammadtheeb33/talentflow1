"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center font-sans text-gray-900">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
        <h1 className="mb-2 text-2xl font-bold">Critical Error</h1>
        <p className="mb-6 max-w-md text-gray-600">
          Something went wrong at the application level.
          <br />
          <span className="mt-2 block text-xs font-mono text-red-400 bg-red-50 p-2 rounded">
            {error.message}
          </span>
        </p>
        <button
          onClick={() => reset()}
          className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Reload Application
        </button>
      </body>
    </html>
  );
}
