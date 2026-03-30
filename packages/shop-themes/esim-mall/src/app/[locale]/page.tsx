'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productsApi, cartApi, authApi, type Product } from '../../lib/api';

// Sample destination data for static content
const popularDestinations = [
  {
    id: '1',
    name: 'France',
    image: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
    price: 9.99,
    rating: 4.8,
    network: '4G/5G • Multiple networks • Europe',
  },
  {
    id: '2',
    name: 'Japan',
    image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
    price: 12.99,
    rating: 4.9,
    network: '4G/5G • NTT DoCoMo • Asia',
  },
  {
    id: '3',
    name: 'UAE',
    image: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
    price: 14.99,
    rating: 4.7,
    network: '4G/5G • Etisalat • Middle East',
  },
  {
    id: '4',
    name: 'Thailand',
    image: 'https://images.unsplash.com/photo-1568797629192-578ec5f3f5f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
    price: 8.99,
    rating: 4.6,
    network: '4G/5G • AIS • Southeast Asia',
  },
];

const testimonials = [
  {
    id: '1',
    name: 'Sarah Johnson',
    image: 'https://randomuser.me/api/portraits/women/32.jpg',
    rating: 5,
    text: "I used TravelPass for my trip to Europe and it worked flawlessly. The setup was incredibly easy and the connection was fast and reliable throughout my journey.",
  },
  {
    id: '2',
    name: 'Michael Chen',
    image: 'https://randomuser.me/api/portraits/men/54.jpg',
    rating: 4.5,
    text: "As a frequent traveler, I've tried many international SIM options. TravelPass eSIM is by far the most convenient. No more hunting for local SIMs at airports!",
  },
  {
    id: '3',
    name: 'Alicia Rodriguez',
    image: 'https://randomuser.me/api/portraits/women/68.jpg',
    rating: 5,
    text: "The customer service is outstanding! I had a small issue activating my eSIM and the support team helped me resolve it within minutes, even though it was 2 AM!",
  },
];

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [destination, setDestination] = useState('');
  const [dataNeeded, setDataNeeded] = useState('');
  const [duration, setDuration] = useState('');

  const handleFindPlans = () => {
    router.push(`/${locale}/products`);
  };

  const handleViewPackage = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  const handleBrowsePackages = () => {
    router.push(`/${locale}/products`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-black/50 z-10"></div>
        <img
          src="https://images.unsplash.com/photo-1499678329028-101435549a4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
          alt="Travel destinations"
          className="w-full h-[600px] object-cover"
        />

        <div className="container mx-auto px-4 absolute inset-0 flex items-center z-20">
          <div className="max-w-xl text-white mt-20">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Stay Connected Everywhere You Go</h1>
            <p className="text-xl mb-6">Get affordable eSIM travel packages for 190+ countries. No contracts, instant activation.</p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleBrowsePackages}
                className="btn-primary inline-block text-center py-3 px-6 rounded-md bg-blue-600 hover:bg-blue-700 transition"
              >
                Browse Packages
              </button>
              <a
                href="#how-it-works"
                className="btn-secondary inline-block text-center py-3 px-6 rounded-md bg-transparent border border-white text-white hover:bg-white/20 transition"
              >
                How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-white py-8 shadow-md relative -mt-20 z-30 rounded-lg max-w-5xl mx-auto px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <div className="relative">
                <select
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3 border"
                >
                  <option value="">Select country or region</option>
                  <option>United States</option>
                  <option>Europe</option>
                  <option>Japan</option>
                  <option>Thailand</option>
                  <option>Australia</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-globe-americas text-gray-400"></i>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <label htmlFor="data-needed" className="block text-sm font-medium text-gray-700 mb-1">Data Needed</label>
              <div className="relative">
                <select
                  id="data-needed"
                  value={dataNeeded}
                  onChange={(e) => setDataNeeded(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3 border"
                >
                  <option value="">Select data amount</option>
                  <option>1GB - Light Usage</option>
                  <option>3GB - Regular Usage</option>
                  <option>5GB - Heavy Usage</option>
                  <option>10GB - Intensive Usage</option>
                  <option>Unlimited</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-wifi text-gray-400"></i>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <div className="relative">
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3 border"
                >
                  <option value="">Select duration</option>
                  <option>7 days</option>
                  <option>14 days</option>
                  <option>30 days</option>
                  <option>60 days</option>
                  <option>90 days</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-calendar-alt text-gray-400"></i>
                </div>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFindPlans}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md transition"
              >
                <i className="fas fa-search mr-2"></i> Find Plans
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">Popular Destinations</h2>
            <p className="text-gray-600 mt-2">Explore our most popular eSIM travel packages</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {popularDestinations.map((dest) => (
              <div key={dest.id} className="card group">
                <div className="relative">
                  <img src={dest.image} alt={dest.name} className="w-full h-56 object-cover" />
                  <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                    <span className="text-sm font-medium text-gray-800">From ${dest.price}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold text-gray-800">{dest.name}</h3>
                    <div className="flex items-center">
                      <i className="fas fa-star text-yellow-400"></i>
                      <span className="ml-1 text-gray-600">{dest.rating}</span>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-600 mb-4">
                    <i className="fas fa-wifi mr-2"></i>
                    <span>{dest.network}</span>
                  </div>
                  <button
                    onClick={() => handleViewPackage(dest.id)}
                    className="block w-full text-center py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition group-hover:bg-blue-600 group-hover:text-white"
                  >
                    View Plans
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={handleBrowsePackages}
              className="inline-block py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
            >
              View All Destinations <i className="fas fa-chevron-right ml-2"></i>
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">How It Works</h2>
            <p className="text-gray-600 mt-2">Get connected in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-shopping-cart text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">1. Purchase an eSIM</h3>
              <p className="text-gray-600">Choose from our wide range of travel packages based on your destination and data needs.</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-qrcode text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">2. Scan QR Code</h3>
              <p className="text-gray-600">Receive your eSIM QR code instantly via email and scan it with your smartphone.</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-globe text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">3. Connect and Go</h3>
              <p className="text-gray-600">Activate your eSIM when you're ready to travel and stay connected wherever you go.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">Why Choose TravelPass</h2>
            <p className="text-gray-600 mt-2">We make staying connected while traveling simple and affordable</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-stopwatch text-3xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Activation</h3>
              <p className="text-gray-600">Get your eSIM instantly after purchase and activate it when you're ready to travel.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-dollar-sign text-3xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">No Hidden Fees</h3>
              <p className="text-gray-600">Transparent pricing with no contracts or unexpected charges. Pay only for what you need.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-globe-americas text-3xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">Global Coverage</h3>
              <p className="text-gray-600">Stay connected in 190+ countries worldwide with reliable local network coverage.</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-headset text-3xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-2">24/7 Support</h3>
              <p className="text-gray-600">Our customer support team is available around the clock to assist you with any issues.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">What Our Customers Say</h2>
            <p className="text-gray-600 mt-2">Thousands of travelers trust TravelPass for their connectivity needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-semibold">{testimonial.name}</h4>
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <i
                          key={i}
                          className={`fas ${i < Math.floor(testimonial.rating) ? 'fa-star' : testimonial.rating % 1 !== 0 && i === Math.floor(testimonial.rating) ? 'fa-star-half-alt' : 'fa-star text-gray-300'}`}
                        ></i>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready for Your Next Adventure?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">Get connected with TravelPass eSIM and enjoy hassle-free internet access worldwide.</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleBrowsePackages}
              className="inline-block py-3 px-8 bg-white text-blue-600 font-semibold rounded-md hover:bg-gray-100 transition"
            >
              Find Your eSIM
            </button>
            <a
              href="#how-it-works"
              className="inline-block py-3 px-8 bg-transparent text-white font-semibold rounded-md border border-white hover:bg-white/10 transition"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
