/**
 * Terms of Service Page — TravelPass Design
 * eSIM-themed terms page with Font Awesome icons and blue palette.
 */

import React from 'react';
import type { TermsPageProps } from '../types';

const sections = [
  { id: 'acceptance', icon: 'fas fa-check-circle', iconBg: 'bg-green-50', iconColor: 'text-green-600', title: 'Acceptance of Terms', content: 'By accessing and using TravelPass eSIM services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by the above, please do not use this service.' },
  { id: 'use-license', icon: 'fas fa-info-circle', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', title: 'Use License', content: 'eSIM profiles provided by TravelPass are licensed for your personal use only. You may not resell, redistribute, or share your eSIM activation credentials with third parties. Each eSIM profile is tied to a single device.' },
  { id: 'disclaimer', icon: 'fas fa-exclamation-circle', iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600', title: 'Disclaimer', content: 'eSIM services are provided on an "as is" basis. Network coverage, speeds, and availability depend on local carrier infrastructure. TravelPass makes no warranties regarding uninterrupted service in all locations.' },
  { id: 'limitations', icon: 'fas fa-times-circle', iconBg: 'bg-red-50', iconColor: 'text-red-600', title: 'Limitations', content: 'In no event shall TravelPass or its carrier partners be liable for any damages arising out of the use or inability to use the eSIM services, including but not limited to loss of data or connectivity.' },
  { id: 'accuracy', icon: 'fas fa-info-circle', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', title: 'Accuracy of Materials', content: 'Package details including data allowances, validity periods, and coverage areas are subject to change. While we strive for accuracy, carrier-level modifications may affect the specifications listed.' },
  { id: 'refunds', icon: 'fas fa-undo', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', title: 'Refund Policy', content: 'Unused and unactivated eSIM profiles are eligible for a full refund within 7 days of purchase. Once an eSIM has been activated, refunds are evaluated on a case-by-case basis by our support team.' },
];

export const TermsPage = React.memo(function TermsPage({ config }: TermsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-blue-100 text-lg">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-lg text-gray-600 leading-relaxed">
            Welcome to TravelPass. These terms and conditions outline the rules and regulations for the use of our eSIM services. By accessing this website, we assume you accept these terms and conditions.
          </p>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-5">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 ${section.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <i className={`${section.icon} ${section.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{section.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{section.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Terms */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Modifications to Terms</h3>
            <p className="text-gray-600 leading-relaxed">
              TravelPass may revise these terms of service at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Governing Law</h3>
            <p className="text-gray-600 leading-relaxed">
              These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which TravelPass operates.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">User Responsibilities</h3>
            <p className="text-gray-600 leading-relaxed">
              You agree not to use our eSIM services for any unlawful purpose or in any way that could damage, disable, or impair the network infrastructure of our carrier partners.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Intellectual Property Rights</h3>
            <p className="text-gray-600 leading-relaxed">
              Unless otherwise stated, TravelPass and/or its licensors own the intellectual property rights for all material on this website. All intellectual property rights are reserved.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
});
