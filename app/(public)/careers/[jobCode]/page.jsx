import React from "react";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Clock, Lock } from "lucide-react";
import ApplyButton from "@/components/ApplyButton";

// Helper to parse Firestore REST format
function parseFirestoreDoc(doc) {
  const fields = doc.fields;
  const result = { id: doc.name.split("/").pop() };
  
  const parseValue = (val) => {
      if (!val) return null;
      if (val.stringValue !== undefined) return val.stringValue;
      if (val.integerValue !== undefined) return parseInt(val.integerValue);
      if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
      if (val.booleanValue !== undefined) return val.booleanValue;
      if (val.timestampValue !== undefined) return val.timestampValue;
      if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseValue);
      if (val.mapValue !== undefined) {
          const mapRes = {};
          for(const k in val.mapValue.fields) {
              mapRes[k] = parseValue(val.mapValue.fields[k]);
          }
          return mapRes;
      }
      return null;
  };

  for (const key in fields) {
    result[key] = parseValue(fields[key]);
  }
  return result;
}

// Helper to fetch job from Firestore REST API (Server Side)
async function getJobProfile(jobId) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  // 1. Try to fetch as Document ID
  const directUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/jobProfiles/${jobId}`;
  try {
    const res = await fetch(directUrl, { next: { revalidate: 0 } });
    if (res.ok) {
      const data = await res.json();
      return parseFirestoreDoc(data);
    } else {
        console.error("Firestore Fetch Error:", res.status, res.statusText, await res.text());
    }
  } catch (e) {
    // Ignore error
    console.error("Error fetching job:", e);
  }
  
  return null;
}

export async function generateMetadata({ params }) {
  const job = await getJobProfile(params.jobCode);
  if (!job) return { title: "Job Not Found" };

  return {
    title: `${job.title} at TalentFlow`,
    description: `We are hiring a ${job.title}. Apply now!`,
    openGraph: {
      title: `${job.title} - Careers at TalentFlow`,
      description: job.description || `Join our team as a ${job.title}.`,
    },
  };
}

export default async function JobPage({ params }) {
  const job = await getJobProfile(params.jobCode);
  
  if (!job) {
    return notFound();
  }

  if (job.status === 'Closed') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md w-full border border-gray-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
            <Lock className="h-6 w-6 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Position Closed</h2>
          <p className="text-gray-500 mb-6">
            Thank you for your interest. This position ({job?.title || 'Job'}) is no longer accepting applications.
          </p>

        </div>
      </div>
    );
  }

  // Format description to HTML if it's not already (simple newline to br)
  // If the description contains HTML tags, we assume it's HTML.
  // Otherwise we replace newlines with <br />
  const isHtml = /<[a-z][\s\S]*>/i.test(job.description || "");
  const descriptionHtml = isHtml 
    ? (job.description || "") 
    : (job.description || "").replace(/\n/g, '<br />');

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
       {/* Hero Section */}
       <div className="bg-white border-b border-gray-100 pb-12 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{job.title}</h1>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span>{job.department || "Engineering"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{job.location || "Amman, Jordan"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{job.type || "Full-time"}</span>
                  </div>
              </div>
              <div className="mt-8 hidden sm:block">
                          <ApplyButton jobTitle={job.title} jobId={job.id} ownerId={job.uid || job.userId} />
                      </div>
                  </div>
               </div>

               {/* Content Section */}
               <article className="prose prose-slate mx-auto mt-8 px-4 sm:px-6 lg:px-8 max-w-3xl">
                   <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
               </article>

               {/* Mobile Sticky Button */}
               <ApplyButton jobTitle={job.title} jobId={job.id} ownerId={job.uid || job.userId} mobileSticky={true} />
            </div>
          );
        }