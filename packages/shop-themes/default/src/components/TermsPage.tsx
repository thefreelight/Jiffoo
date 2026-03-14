/**
 * Terms of Service Page Component - Admin Style Design
 */

import React from 'react';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { TermsPageProps } from '../../../../shared/src/types/theme';

export function TermsPage({ config }: TermsPageProps) {
  const sections = [
    { id: 'acceptance', icon: CheckCircle, iconColor: 'bg-green-50', iconTextColor: 'text-green-600', title: 'Acceptance of Terms', content: 'By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.' },
    { id: 'use-license', icon: Info, iconColor: 'bg-blue-50', iconTextColor: 'text-blue-600', title: 'Use License', content: 'Permission is granted to temporarily download one copy of the materials (information or software) on Jiffoo Mall for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.' },
    { id: 'disclaimer', icon: AlertCircle, iconColor: 'bg-yellow-50', iconTextColor: 'text-yellow-600', title: 'Disclaimer', content: 'The materials on Jiffoo Mall are provided on an "as is" basis. Jiffoo Mall makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.' },
    { id: 'limitations', icon: XCircle, iconColor: 'bg-red-50', iconTextColor: 'text-red-600', title: 'Limitations', content: 'In no event shall Jiffoo Mall or its suppliers be liable for any damages arising out of the use or inability to use the materials on Jiffoo Mall.' },
    { id: 'accuracy', icon: Info, iconColor: 'bg-purple-50', iconTextColor: 'text-purple-600', title: 'Accuracy of Materials', content: 'The materials appearing on Jiffoo Mall could include technical, typographical, or photographic errors. Jiffoo Mall does not warrant that any of the materials on its website are accurate, complete, or current.' },
    { id: 'links', icon: Info, iconColor: 'bg-blue-50', iconTextColor: 'text-blue-600', title: 'Links', content: 'Jiffoo Mall has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-6">
              <CheckCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">TERMS OF SERVICE</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Terms of Service</h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              LAST UPDATED: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Welcome to Jiffoo Mall. These terms and conditions outline the rules and regulations for the use of our website and services. By accessing this website, we assume you accept these terms and conditions.
            </p>
          </div>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-4 sm:space-y-6">
            {sections.map((section) => {
              const IconComponent = section.icon;
              return (
                <div
                  key={section.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 ${section.iconColor} dark:opacity-80 rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`w-5 h-5 ${section.iconTextColor}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 tracking-tight">{section.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{section.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Terms */}
      <section className="py-12 sm:py-16 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">MODIFICATIONS TO TERMS</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Jiffoo Mall may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">GOVERNING LAW</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Jiffoo Mall operates.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">USER RESPONSIBILITIES</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                You agree not to use this website for any unlawful purpose or in any way that could damage, disable, or impair the website.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">INTELLECTUAL PROPERTY</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Unless otherwise stated, Jiffoo Mall and/or its licensors own the intellectual property rights for all material on this website. All intellectual property rights are reserved.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
