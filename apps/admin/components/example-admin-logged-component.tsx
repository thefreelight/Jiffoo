/**
 * Example Admin Logged Component
 *
 * Demonstrates admin action logging functionality with i18n support.
 */

'use client';

import React, { useState } from 'react';
import { useLogger } from '@/hooks/use-logger';
import { useT } from 'shared/src/i18n/react';

export function ExampleAdminLoggedComponent() {
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };
  const [selectedUser, setSelectedUser] = useState('user-123');
  const [selectedProduct, setSelectedProduct] = useState('product-456');
  
  const { 
    logAdminAction, 
    logAudit, 
    logConfigChange, 
    logUserManagement, 
    logProductManagement,
    logSecurity,
    logError 
  } = useLogger({
    component: 'ExampleAdminLoggedComponent',
    page: 'admin-example',
    adminSection: 'system-management'
  });

  const handleUserAction = (action: string) => {
    try {
      // 模拟用户管理操作
      logUserManagement(action, selectedUser, {
        previousStatus: 'active',
        newStatus: action === 'suspend' ? 'suspended' : 'active',
        reason: 'Admin action from dashboard'
      });
      
      // 记录管理员操作
      logAdminAction(action, 'user', {
        targetUserId: selectedUser,
        source: 'admin_dashboard'
      });
      
      // 记录审计日志
      logAudit(`user_${action}`, {
        targetUserId: selectedUser,
        adminAction: true
      });
      
    } catch (error) {
      logError(error as Error, { action, targetUserId: selectedUser });
    }
  };

  const handleProductAction = (action: string) => {
    try {
      // 模拟产品管理操作
      logProductManagement(action, selectedProduct, {
        previousStatus: 'published',
        newStatus: action === 'unpublish' ? 'draft' : 'published',
        category: 'electronics'
      });
      
      logAdminAction(action, 'product', {
        targetProductId: selectedProduct,
        source: 'admin_dashboard'
      });
      
    } catch (error) {
      logError(error as Error, { action, targetProductId: selectedProduct });
    }
  };

  const handleConfigChange = () => {
    const oldValue = { maxUsers: 1000, allowRegistration: true };
    const newValue = { maxUsers: 2000, allowRegistration: false };
    
    logConfigChange('system_limits', oldValue, newValue);
    logAudit('system_config_changed', {
      setting: 'system_limits',
      changes: { maxUsers: '1000 -> 2000', allowRegistration: 'true -> false' }
    });
  };

  const handleSecurityEvent = () => {
    logSecurity('suspicious_admin_activity', {
      event: 'multiple_failed_operations',
      count: 5,
      timeWindow: '5 minutes',
      actions: ['user_delete', 'product_delete', 'config_change']
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">{getText('merchant.adminLog.title', 'Admin Action Log Example')}</h2>

      <div className="space-y-6">
        {/* User Management */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">{getText('merchant.adminLog.userManagement', 'User Management Actions')}</h3>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="user-123">{getText('merchant.adminLog.user', 'User')} 123</option>
              <option value="user-456">{getText('merchant.adminLog.user', 'User')} 456</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleUserAction('suspend')}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              {getText('merchant.adminLog.suspendUser', 'Suspend User')}
            </button>
            <button
              onClick={() => handleUserAction('activate')}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              {getText('merchant.adminLog.activateUser', 'Activate User')}
            </button>
            <button
              onClick={() => handleUserAction('delete')}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              {getText('merchant.adminLog.deleteUser', 'Delete User')}
            </button>
          </div>
        </div>

        {/* Product Management */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">{getText('merchant.adminLog.productManagement', 'Product Management Actions')}</h3>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="product-456">{getText('merchant.adminLog.product', 'Product')} 456</option>
              <option value="product-789">{getText('merchant.adminLog.product', 'Product')} 789</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleProductAction('publish')}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {getText('merchant.adminLog.publishProduct', 'Publish Product')}
            </button>
            <button
              onClick={() => handleProductAction('unpublish')}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              {getText('merchant.adminLog.unpublishProduct', 'Unpublish Product')}
            </button>
          </div>
        </div>

        {/* System Configuration */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">{getText('merchant.adminLog.systemConfig', 'System Configuration')}</h3>
          <button
            onClick={handleConfigChange}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            {getText('merchant.adminLog.modifyConfig', 'Modify System Config')}
          </button>
        </div>

        {/* Security Events */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">{getText('merchant.adminLog.securityEvents', 'Security Events')}</h3>
          <button
            onClick={handleSecurityEvent}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {getText('merchant.adminLog.logSecurityEvent', 'Log Security Event')}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-medium mb-2">{getText('merchant.adminLog.features', 'Admin Log Features')}:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• {getText('merchant.adminLog.feature1', 'User management action audit')}</li>
          <li>• {getText('merchant.adminLog.feature2', 'Product management action logging')}</li>
          <li>• {getText('merchant.adminLog.feature3', 'System configuration change tracking')}</li>
          <li>• {getText('merchant.adminLog.feature4', 'Security event monitoring')}</li>
          <li>• {getText('merchant.adminLog.feature5', 'Admin behavior analysis')}</li>
          <li>• {getText('merchant.adminLog.feature6', 'Compliance audit support')}</li>
        </ul>
      </div>
    </div>
  );
}

export default ExampleAdminLoggedComponent;