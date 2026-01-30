"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const JobApplicationForm = dynamic(() => import("./JobApplicationForm"), { ssr: false });

export default function ApplyButton({ jobTitle, jobId, ownerId, className = "", mobileSticky = false }) {
  const [isOpen, setIsOpen] = useState(false);

  if (mobileSticky) {
    return (
      <>
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 sm:hidden z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Apply for this job
          </button>
        </div>
        <JobApplicationForm 
            jobTitle={jobTitle} 
            jobId={jobId} 
            ownerId={ownerId}
            isOpen={isOpen} 
            onClose={() => setIsOpen(false)} 
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${className}`}
      >
        Apply for this job
      </button>
      <JobApplicationForm 
        jobTitle={jobTitle} 
        jobId={jobId} 
        ownerId={ownerId}
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
