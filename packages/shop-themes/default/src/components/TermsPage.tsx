/**
 * 服务条款页面组件
 * 展示服务条款内容
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { TermsPageProps } from '../../../../shared/src/types/theme';

export function TermsPage({ config }: TermsPageProps) {
  const sections = [
    {
      id: 'acceptance',
      icon: CheckCircle,
      title: 'Acceptance of Terms',
      content: 'By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
    },
    {
      id: 'use-license',
      icon: Info,
      title: 'Use License',
      content: 'Permission is granted to temporarily download one copy of the materials (information or software) on Jiffoo Mall for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:',
    },
    {
      id: 'disclaimer',
      icon: AlertCircle,
      title: 'Disclaimer',
      content: 'The materials on Jiffoo Mall are provided on an "as is" basis. Jiffoo Mall makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.',
    },
    {
      id: 'limitations',
      icon: XCircle,
      title: 'Limitations',
      content: 'In no event shall Jiffoo Mall or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Jiffoo Mall.',
    },
    {
      id: 'accuracy',
      icon: Info,
      title: 'Accuracy of Materials',
      content: 'The materials appearing on Jiffoo Mall could include technical, typographical, or photographic errors. Jiffoo Mall does not warrant that any of the materials on its website are accurate, complete, or current. Jiffoo Mall may make changes to the materials contained on its website at any time without notice.',
    },
    {
      id: 'links',
      icon: Info,
      title: 'Links',
      content: 'Jiffoo Mall has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Jiffoo Mall of the site. Use of any such linked website is at the user\'s own risk.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="prose prose-sm max-w-none"
          >
            <p className="text-lg text-muted-foreground leading-relaxed">
              Welcome to Jiffoo Mall. These terms and conditions outline the rules and regulations for the use of our website and services. By accessing this website, we assume you accept these terms and conditions. Do not continue to use Jiffoo Mall if you do not agree to take all of the terms and conditions stated on this page.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Terms Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-8">
            {sections.map((section, index) => {
              const IconComponent = section.icon;
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
                  className="border-l-4 border-primary pl-6 py-4"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Terms */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-xl font-semibold mb-3">Modifications to Terms</h3>
              <p className="text-muted-foreground leading-relaxed">
                Jiffoo Mall may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Governing Law</h3>
              <p className="text-muted-foreground leading-relaxed">
                These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Jiffoo Mall operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">User Responsibilities</h3>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use this website for any unlawful purpose or in any way that could damage, disable, or impair the website. You agree not to attempt to gain unauthorized access to any portion of the website.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Intellectual Property Rights</h3>
              <p className="text-muted-foreground leading-relaxed">
                Unless otherwise stated, Jiffoo Mall and/or its licensors own the intellectual property rights for all material on this website. All intellectual property rights are reserved. You may access this from Jiffoo Mall for personal use subject to restrictions set in these terms and conditions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

