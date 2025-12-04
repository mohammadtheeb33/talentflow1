"use client";
import { useEffect, useMemo, useState } from "react";
import { getClientAuth, getClientFirestore, getClientStorage, getCvDownloadUrl } from "@/lib/firebase";
import { collection, getDocs, limit, query, where, orderBy, Timestamp, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";

type JobProfile = { id: string; title?: string };

type LogEntry = { type: "info" | "error"; message: string };

export function BulkScanModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [jobProfileId, setJobProfileId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [scanning, setScanning] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const canScan = useMemo(() => !!jobProfileId && !!fromDate && !!toDate, [jobProfileId, fromDate, toDate]);

  function appendLog(type: "info" | "error", message: string) {
    setLogs((prev) => [...prev, { type, message }]);
  }

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) {
          appendLog("error", "غير مصرح: الرجاء تسجيل الدخول");
          return;
        }
        const db = getClientFirestore();
        const snap = await getDocs(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(200)));
        const rows: JobProfile[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        rows.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        if (mounted) setJobs(rows);
      } catch (e: any) {
        appendLog("error", e?.message || "تعذّر تحميل ملفات الوظائف");
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  async function scanSelected() {
    if (!canScan) return;
    try {
      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        appendLog("error", "غير مصرح: الرجاء تسجيل الدخول");
        return;
      }
      setScanning(true);
      setProcessedCount(0);
      setMatchedCount(0);
      setLogs([]);
      appendLog("info", "بدء الفحص الجماعي…");
      const db = getClientFirestore();
      const storage = getClientStorage();

      const start = Timestamp.fromDate(new Date(`${fromDate}T00:00:00`));
      const end = Timestamp.fromDate(new Date(`${toDate}T23:59:59`));

      // المحاولة الأساسية: استعلام مركّب (uid + نطاق تاريخ + ترتيب) — يتطلب فهرس مركّب
      const baseQuery = query(
        collection(db, "cvs"),
        where("uid", "==", uid),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt"),
        limit(500)
      );
      let rows: { id: string; data: any }[] = [];
      try {
        const snap = await getDocs(baseQuery);
        snap.forEach((d) => rows.push({ id: d.id, data: d.data() as any }));
      } catch (err: any) {
        // في حال عدم وجود الفهرس المركّب، نستخدم آلية احتياطية: نجلب بحسب uid/userId فقط ثم نرشّح ونرتّب محليًا
        const isIndexError =
          typeof err?.message === "string" && err.message.toLowerCase().includes("requires an index");
        if (!isIndexError) throw err;
        appendLog(
          "info",
          "الاستعلام يتطلب فهرسًا مركّبًا (uid + createdAt). تم استخدام آلية احتياطية مؤقتًا؛ يُنصح بإنشاء الفهرس المقترح."
        );

        // استعلام بالـ uid فقط
        const fallbackUidQuery = query(collection(db, "cvs"), where("uid", "==", uid), limit(500));
        const uidSnap = await getDocs(fallbackUidQuery);
        const merged: Map<string, any> = new Map();
        uidSnap.forEach((d) => {
          const data = d.data() as any;
          merged.set(d.id, data);
        });

        // دعم السجلات القديمة التي تستخدم الحقل userId
        const fallbackUserIdQuery = query(collection(db, "cvs"), where("userId", "==", uid), limit(500));
        const userIdSnap = await getDocs(fallbackUserIdQuery);
        userIdSnap.forEach((d) => {
          const data = d.data() as any;
          merged.set(d.id, data);
        });

        // ترشيح نطاق التاريخ وفرز محليًا
        rows = Array.from(merged.entries())
          .map(([id, data]) => ({ id, data }))
          .filter(({ data }) => {
            const ts: Timestamp | undefined = data?.createdAt;
            if (!ts || typeof (ts as any)?.toMillis !== "function") return false;
            const ms = ts.toMillis();
            return ms >= start.toMillis() && ms <= end.toMillis();
          })
          .sort((a, b) => {
            const am = (a.data?.createdAt as Timestamp)?.toMillis?.() ?? 0;
            const bm = (b.data?.createdAt as Timestamp)?.toMillis?.() ?? 0;
            return am - bm;
          })
          .slice(0, 500);
      }

      appendLog("info", `تم العثور على ${rows.length} سير ذاتية ضمن الفترة.`);
      setMatchedCount(rows.length);

      // Find selected job title label and full profile (inline write to trigger re-score)
      const selected = jobs.find((j) => j.id === jobProfileId);
      const jobTitleLabel = selected ? (selected.title || selected.id) : undefined;

      for (const row of rows) {
        const { id, data } = row;
        setProcessedCount((prev) => prev + 1);
        const storagePath: string | undefined = data?.storagePath;
        if (!storagePath) {
          appendLog("error", `CV ${id}: لا يحتوي على ملف في التخزين؛ تمّ تجاوزه.`);
          continue;
        }
        try {
          // Always set job profile selection; scoring function re-scores on change
          await updateDoc(doc(db, "cvs", id), {
            jobProfileId,
            jobTitle: jobTitleLabel || null,
            // كتابة الملف الوظيفي ضمن المستند لضمان اعتبار التغيير في دالة إعادة التقييم
            jobProfile: selected ? { ...(selected as any), updatedAt: serverTimestamp() } : null,
            updatedAt: serverTimestamp(),
          });

          // If parsed is missing or status indicates not scanned, re-upload to trigger parse
          const needsParse = !data?.parsed || String(data?.status || "") !== "scanned";
          if (needsParse) {
            const url = await getCvDownloadUrl(storagePath);
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`فشل تنزيل الملف (${resp.status})`);
            const blob = await resp.blob();
            const r = storageRef(storage, storagePath);
            await uploadBytes(r, blob, { contentType: blob.type || "application/pdf", cacheControl: "public, max-age=3600" });
            await updateDoc(doc(db, "cvs", id), {
              status: "pending",
              storagePath,
              rescanRequestedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            appendLog("info", `CV ${id}: أُعيد رفع الملف لإعادة الفحص.`);
          } else {
            // Parsed exists; job profile change will trigger re-score via function
            appendLog("info", `CV ${id}: محدّث لملف الوظيفة وسيُعاد التقييم.`);
          }
        } catch (e: any) {
          appendLog("error", `CV ${id}: ${e?.message || "تعذّر الفحص"}`);
        }
      }

      appendLog("info", "اكتمل الفحص الجماعي.");
    } catch (e: any) {
      appendLog("error", e?.message || "تعذّر تنفيذ الفحص الجماعي");
    } finally {
      setScanning(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-lg border bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">فحص جماعي للسير الذاتية</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-gray-100">إغلاق</button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">الملف الوظيفي</div>
            <select value={jobProfileId} onChange={(e) => setJobProfileId(e.target.value)} className="w-full rounded border p-2 text-xs">
              <option value="">— اختر ملفًا وظيفيًا —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title || j.id}</option>
              ))}
            </select>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">الفترة الزمنية</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">من تاريخ</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded border p-2 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">إلى تاريخ</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded border p-2 text-xs" />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">الإجراء</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600">المطابقات: {matchedCount} | المُعالَجة: {processedCount}</div>
              <button
                onClick={scanSelected}
                disabled={!canScan || scanning}
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {scanning ? "جارٍ الفحص…" : "فحص السير الذاتية"}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">السجل</div>
            <div className="rounded-md border bg-gray-50 p-3">
              {logs.length === 0 ? (
                <div className="text-xs text-gray-600">لا توجد رسائل بعد.</div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {logs.map((l, i) => (
                    <li key={i} className={l.type === "error" ? "text-red-700" : "text-gray-800"}>{l.message}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={onClose} className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">إغلاق</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}