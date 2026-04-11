'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../components/AuthGuard';
import { ordersApi, type Order } from '../../../lib/api';

function OrdersContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock eSIM data for high-fidelity replication
  const mockESims = [
    {
      id: '1',
      name: 'Japan 5GB eSIM',
      network: 'NTT DoCoMo',
      region: 'Asia',
      activatedOn: 'Mar 28, 2023',
      expiresOn: 'Apr 10, 2023',
      status: 'active',
      used: 2.8,
      total: 5,
      daysRemaining: 8,
      color: 'blue'
    },
    {
      id: '2',
      name: 'Europe Unlimited eSIM',
      network: 'Multiple Networks',
      region: 'Europe',
      activatedOn: 'Mar 25, 2023',
      expiresOn: 'Apr 24, 2023',
      status: 'active',
      used: 12.4,
      total: 'Unlimited',
      daysRemaining: 22,
      color: 'green'
    }
  ];

  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await ordersApi.getOrders(1, 10);
        setOrders(result.items);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        // We'll proceed with mock data if API fails or for demo purposes
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const tabs = [
    { id: 'active', label: 'Active (2)' },
    { id: 'upcoming', label: 'Upcoming (1)' },
    { id: 'expired', label: 'Expired (3)' },
    { id: 'all', label: 'All (6)' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse"></div>
          <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm h-64 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex text-sm mb-8">
          <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
          <span className="mx-2 text-gray-500">/</span>
          <button onClick={() => router.push(`/${locale}/profile`)} className="text-gray-500 hover:text-blue-600">My Account</button>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-800 font-medium">My eSIMs</span>
        </nav>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">My eSIMs</h1>
          <button
            onClick={() => router.push(`/${locale}/products`)}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition flex items-center"
          >
            <i className="fas fa-plus mr-2"></i> Buy New eSIM
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* eSIM Cards */}
        <div className="grid grid-cols-1 gap-6">
          {mockESims.map((esim) => (
            <div key={esim.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                <div className={`lg:w-1/3 xl:w-1/4 p-6 flex flex-col ${esim.color === 'blue' ? 'bg-blue-50' : 'bg-green-50'}`}>
                  <div className="mb-4 flex-grow">
                    <h2 className="text-xl font-semibold text-gray-800 mb-1">{esim.name}</h2>
                    <p className="text-gray-600">{esim.network} Network</p>
                    <div className="flex items-center mt-2">
                      <i className={`fas ${esim.region === 'Asia' ? 'fa-globe-asia' : 'fa-globe-europe'} ${esim.color === 'blue' ? 'text-blue-600' : 'text-green-600'} mr-2`}></i>
                      <span className="text-gray-600">{esim.region}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Activated On:</span>
                      <span className="font-medium">{esim.activatedOn}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Expires On:</span>
                      <span className="font-medium">{esim.expiresOn}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span className="text-green-600 font-medium">Active</span>
                    </div>
                  </div>
                </div>

                <div className="lg:w-2/3 xl:w-3/4 p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div className="mb-4 md:mb-0">
                      <h3 className="font-medium mb-1">Data Usage</h3>
                      <div className="flex items-center">
                        <span className="text-2xl font-bold text-gray-800">{esim.used} GB</span>
                        <span className="text-gray-600 ml-2">/ {esim.total} {esim.total !== 'Unlimited' && 'GB'}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{esim.daysRemaining} days remaining</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className={`${esim.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white py-2 px-4 rounded-md transition text-sm`}>
                        <i className="fas fa-sync-alt mr-1"></i> {esim.total === 'Unlimited' ? 'Extend Validity' : 'Top Up Data'}
                      </button>
                      <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md transition text-sm">
                        <i className="fas fa-qrcode mr-1"></i> Show QR Code
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="h-2 w-full bg-gray-200 rounded-full">
                      <div
                        className={`h-2 rounded-full ${esim.color === 'blue' ? 'bg-blue-600' : 'bg-green-600'}`}
                        style={{ width: esim.total === 'Unlimited' ? '100%' : `${(esim.used / (esim.total as number)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>0 GB</span>
                      <span>{esim.total} {esim.total !== 'Unlimited' && 'GB'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <i className={`fas fa-wifi ${esim.color === 'blue' ? 'text-blue-600' : 'text-green-600'} mr-2`}></i>
                        <h4 className="font-medium">Speed</h4>
                      </div>
                      <p className="text-gray-600">4G/5G High-Speed</p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <i className={`fas fa-signal ${esim.color === 'blue' ? 'text-blue-600' : 'text-green-600'} mr-2`}></i>
                        <h4 className="font-medium">Network</h4>
                      </div>
                      <p className="text-gray-600">{esim.network}</p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <i className={`fas fa-phone-alt ${esim.color === 'blue' ? 'text-blue-600' : 'text-green-600'} mr-2`}></i>
                        <h4 className="font-medium">Support</h4>
                      </div>
                      <p className="text-gray-600">24/7 Available</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Tabs */}
              <div className="bg-gray-50 px-6 py-3 flex items-center flex-wrap gap-4 text-sm">
                <button className="text-blue-600 font-medium hover:underline">
                  <i className="fas fa-cog mr-1"></i> Manage Settings
                </button>
                <button className="text-blue-600 font-medium hover:underline">
                  <i className="fas fa-info-circle mr-1"></i> Device Instructions
                </button>
                <button className="text-blue-600 font-medium hover:underline">
                  <i className="fas fa-headset mr-1"></i> Get Support
                </button>
                <button className="text-blue-600 font-medium hover:underline">
                  <i className="fas fa-file-alt mr-1"></i> View Receipt
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Help Information */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center">
            <div className="mb-6 md:mb-0 md:mr-6 md:w-2/3">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Need help with your eSIM?</h2>
              <p className="text-gray-600 mb-4">Our support team is available 24/7 to help you with any issues regarding your eSIM activation, data usage, or technical problems.</p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition">
                  <i className="fas fa-headset mr-2"></i> Contact Support
                </button>
                <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md transition">
                  <i className="fas fa-book mr-2"></i> View FAQ
                </button>
              </div>
            </div>
            <div className="md:w-1/3 flex justify-center">
              <img src="https://cdn-icons-png.flaticon.com/512/3932/3932768.png" alt="eSIM Support" className="h-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}
