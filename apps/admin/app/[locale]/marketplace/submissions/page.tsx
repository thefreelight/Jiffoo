'use client';

import { SubmissionsReview } from '@/components/marketplace/SubmissionsReview';

export default function MarketplaceSubmissionsPage() {
  return (
    <div className="min-h-screen w-full bg-[#fcfdfe]">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold leading-none tracking-tight text-gray-900">
          Extension submissions
        </h1>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-blue-600">
          Third-party plugin and theme submissions awaiting review
        </span>
      </div>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <SubmissionsReview />
      </div>
    </div>
  );
}
