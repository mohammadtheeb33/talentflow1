export default function PublicNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Job Not Found</h2>
        <p className="text-gray-600 mb-8">
          The job posting you are looking for may have been removed or is no longer available.
        </p>
        <a 
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Go to Home
        </a>
      </div>
    </div>
  );
}