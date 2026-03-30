'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function StoreNotFoundPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const storeId = searchParams.get('storeId');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Store Not Found</span>
          </nav>
        </div>
      </div>

      {/* Not Found Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Not Found Icon */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-yellow-100 rounded-full">
                <i className="fas fa-store-slash text-5xl text-yellow-500"></i>
              </div>
            </div>

            {/* Not Found Message */}
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Store Not Found</h1>
            <p className="text-xl text-gray-600 mb-2">We couldn't find the store you're looking for</p>
            {storeId && (
              <p className="text-gray-500 mb-8">Store ID: <span className="font-mono font-medium">{storeId}</span></p>
            )}

            {/* Possible Reasons */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">This could happen because:</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <i className="fas fa-link text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Invalid link</h4>
                    <p className="text-sm text-gray-500">The URL may be incorrect or outdated</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-pause-circle text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Store temporarily unavailable</h4>
                    <p className="text-sm text-gray-500">The store may be undergoing maintenance</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-ban text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Store closed</h4>
                    <p className="text-sm text-gray-500">The store may have been permanently closed</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-globe text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Region restricted</h4>
                    <p className="text-sm text-gray-500">The store may not be available in your region</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* TravelPass Promo */}
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center mb-4">
                <i className="fas fa-globe-americas text-blue-600 text-2xl mr-3"></i>
                <h2 className="text-lg font-semibold text-gray-800">Welcome to TravelPass</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Looking for travel eSIM packages? You're in the right place!
                Browse our collection of eSIMs for 190+ countries.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3">
                  <i className="fas fa-bolt text-blue-600 mb-1"></i>
                  <p className="text-gray-600">Instant Delivery</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <i className="fas fa-globe text-blue-600 mb-1"></i>
                  <p className="text-gray-600">190+ Countries</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <i className="fas fa-headset text-blue-600 mb-1"></i>
                  <p className="text-gray-600">24/7 Support</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <i className="fas fa-shield-alt text-blue-600 mb-1"></i>
                  <p className="text-gray-600">Secure Payment</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                onClick={() => router.push(`/${locale}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md font-medium transition"
              >
                <i className="fas fa-home mr-2"></i>
                Go to Homepage
              </button>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="bg-white hover:bg-gray-50 text-gray-700 px-8 py-3 rounded-md font-medium border border-gray-300 transition"
              >
                <i className="fas fa-sim-card mr-2"></i>
                Browse eSIM Packages
              </button>
            </div>

            {/* Support Link */}
            <div className="text-sm text-gray-500">
              <p>
                Think this is an error?{' '}
                <button
                  onClick={() => router.push(`/${locale}/contact`)}
                  className="text-blue-600 hover:underline"
                >
                  Contact our support team
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
