"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getClientFirestore, getClientAuth, ensureUid } from "@/lib/firebase";

type Row = Record<string, string>;

export default function UploadPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const parseCsv = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      // Normalize newlines and split lines
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/).filter(Boolean);
      if (lines.length === 0) {
        setError("الملف فارغ أو غير صالح");
        return;
      }
      const headerLine = lines[0];
      // Simple CSV split respecting quoted values
      const splitCsv = (line: string): string[] => {
        const out: string[] = [];
        let cur = ""; let quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (quoted && line[i+1] === '"') { cur += '"'; i++; } else { quoted = !quoted; }
          } else if (ch === ',' && !quoted) {
            out.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        out.push(cur.trim());
        return out;
      };
      const hdrs = splitCsv(headerLine).map(h => h.trim());
      setHeaders(hdrs);
      const parsed: Row[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsv(lines[i]);
        const obj: Row = {};
        for (let j = 0; j < hdrs.length; j++) obj[hdrs[j]] = cols[j] ?? "";
        parsed.push(obj);
      }
      setRows(parsed);
    } catch (e: any) {
      setError(e?.message ?? "تعذّر قراءة الملف");
    }
  }, []);

  const onFile = useCallback((f?: File) => { if (f) parseCsv(f); }, [parseCsv]);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setImportedCount(0);
    setError(null);
    
    try {
      await ensureUid();
      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setError("يرجى تسجيل الدخول أولاً");
        setImporting(false);
        return;
      }
      
      const db = getClientFirestore();
      const col = collection(db, "cvs");
      
      let count = 0;
      for (const row of rows) {
        // Simple heuristic to find name/email fields
        const keys = Object.keys(row);
        const nameKey = keys.find(k => k.toLowerCase().includes("name")) || keys[0];
        const emailKey = keys.find(k => k.toLowerCase().includes("email")) || keys.find(k => k.toLowerCase().includes("mail"));
        
        const name = row[nameKey] || "Unnamed Candidate";
        const email = emailKey ? row[emailKey] : null;
        
        await addDoc(col, {
          uid,
          name,
          email,
          status: "uploaded",
          source: "csv_import",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          originalData: row
        });
        count++;
        setImportedCount(count);
      }
      
      alert(`تم استيراد ${count} مرشح بنجاح`);
      router.push("/Dashboard");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
    }
  };

  const previewHeaders = useMemo(() => headers.slice(0, 8), [headers]);

  return (
    <main className="space-y-6">
      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Upload Candidates CSV</h2>
            <p className="mt-1 text-xs text-gray-600">اختر ملف CSV وسيتم عرض معاينة للصفوف.</p>
          </div>
          {rows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? `Importing... (${importedCount}/${rows.length})` : "Import Candidates"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">
            <span>Choose File</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <button
            onClick={() => setRows([])}
            className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          >Clear</button>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        )}
      </section>

      <section className="rounded-lg border bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
          <div className="text-xs text-gray-500">{rows.length} rows</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-t border-b bg-gray-50 text-xs text-gray-600">
              <tr>
                {previewHeaders.map((h) => (
                  <th key={h} className="px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-b">
                  {previewHeaders.map((h) => (
                    <td key={h} className="px-4 py-3 text-gray-700">{r[h]}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-xs text-gray-500" colSpan={previewHeaders.length || 1}>
                    لا توجد بيانات بعد. قم برفع ملف CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
