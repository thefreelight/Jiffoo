'use client';

import React from 'react';

export interface AdminLayoutProps {
  /** Sidebar content */
  sidebar: React.ReactNode;
  /** Header content */
  header: React.ReactNode;
  /** Main content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AdminLayout - Main layout container for admin dashboard
 * 
 * Provides a fixed sidebar + header layout with scrollable content area.
 * Based on Jiffoo Blue Minimal design system.
 * 
 * @example
 * ```tsx
 * <AdminLayout
 *   sidebar={<Sidebar />}
 *   header={<TopHeader title="Dashboard" />}
 * >
 *   <DashboardContent />
 * </AdminLayout>
 * ```
 */
export function AdminLayout({
  sidebar,
  header,
  children,
  className = '',
}: AdminLayoutProps) {
  return (
    <div 
      className={`admin-layout flex h-screen overflow-hidden bg-admin-bg-body font-outfit ${className}`}
      style={{ 
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
      }}
    >
      {/* Sidebar */}
      {sidebar}
      
      {/* Main Wrapper (Header + Content) */}
      <div className="admin-main flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {header}
        
        {/* Content Area */}
        <main className="admin-content flex-1 overflow-y-auto p-8 bg-[#F1F5F9]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

