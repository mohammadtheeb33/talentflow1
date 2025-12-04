"use client";
import { useState } from "react";
import CandidatesTable from "@/components/CandidatesTable";
import { BulkScanModal } from "@/components/BulkScanModal";

export default function CvsPage() {
  const [openBulkScan, setOpenBulkScan] = useState(false);
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Table and filters */}
      <CandidatesTable onCheckCv={() => setOpenBulkScan(true)} />
      <BulkScanModal isOpen={openBulkScan} onClose={() => setOpenBulkScan(false)} />
    </main>
  );
}