import React from "react";
import { Search, Filter, Briefcase, ChevronDown } from "lucide-react";

interface FilterHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: {
    department: string;
    job: string;
    stage: string;
    decision: string;
  };
  setFilters: (filters: any) => void;
  jobOptions: Record<string, string>; // jobId -> jobTitle
  totalCount: number;
}

export default function FilterHeader({
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  jobOptions,
  totalCount
}: FilterHeaderProps) {
  
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Candidates
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {totalCount}
          </span>
        </h2>
        
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filters Row */}
      <div className="p-3 bg-gray-50/50 flex flex-wrap gap-2 items-center rounded-b-lg">
        <div className="flex items-center gap-2 text-sm text-gray-500 mr-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters:</span>
        </div>

        {/* Job Filter */}
        <div className="relative">
          <select
            className="appearance-none bg-white border border-gray-300 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            value={filters.job}
            onChange={(e) => handleFilterChange("job", e.target.value)}
          >
            <option value="">All Jobs</option>
            {Object.entries(jobOptions).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Decision Filter */}
        <div className="relative">
          <select
            className="appearance-none bg-white border border-gray-300 text-gray-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            value={filters.decision}
            onChange={(e) => handleFilterChange("decision", e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="undecided">Undecided</option>
            <option value="accepted">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
