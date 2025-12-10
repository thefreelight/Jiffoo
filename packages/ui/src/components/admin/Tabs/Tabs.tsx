'use client';

export interface TabItem {
  /** Unique identifier */
  id: string;
  /** Tab label */
  label: string;
}

export interface AdminTabsProps {
  /** Tab items */
  items: TabItem[];
  /** Currently active tab ID */
  activeTab: string;
  /** Tab change handler */
  onTabChange: (tabId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AdminTabs - Tab navigation component for admin dashboard
 * 
 * Horizontal tab bar with active indicator.
 * Based on Jiffoo Blue Minimal design system.
 */
export function AdminTabs({
  items,
  activeTab,
  onTabChange,
  className = '',
}: AdminTabsProps) {
  return (
    <div 
      className={`
        flex gap-8 border-b border-[#E2E8F0] mb-8
        ${className}
      `}
    >
      {items.map((item) => {
        const isActive = item.id === activeTab;
        
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              relative pb-3 font-medium text-sm
              transition-colors duration-150
              ${isActive 
                ? 'text-[#3B82F6]' 
                : 'text-[#64748B] hover:text-[#0F172A]'
              }
            `}
          >
            {item.label}
            
            {/* Active indicator */}
            {isActive && (
              <span className="
                absolute bottom-[-1px] left-0 right-0
                h-0.5 bg-[#3B82F6]
              " />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AdminTabs;

