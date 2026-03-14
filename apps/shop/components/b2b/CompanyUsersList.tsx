/**
 * Company Users List Component
 *
 * Displays list of users in a company for B2B account management
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface CompanyUser {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  permissions: string[];
  approvalLimit: number | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface CompanyUsersListProps {
  users: CompanyUser[];
  isLoading?: boolean;
  getText: (key: string, fallback: string) => string;
}

export function CompanyUsersList({ users, isLoading, getText }: CompanyUsersListProps) {
  // Format currency
  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return getText('shop.b2b.unlimited', 'Unlimited');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get role badge variant
  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500 text-white';
      case 'BUYER':
        return 'bg-blue-500 text-white';
      case 'APPROVER':
        return 'bg-green-500 text-white';
      case 'VIEWER':
        return 'bg-gray-500 text-white';
      default:
        return '';
    }
  };

  // Format role for display
  const formatRole = (role: string): string => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  // Get user display name
  const getUserDisplayName = (user: CompanyUser['user']): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.username) {
      return user.username;
    }
    return user.email;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getText('shop.b2b.companyUsers', 'Company Users')}</CardTitle>
        <CardDescription>
          {getText('shop.b2b.companyUsersDescription', 'View all users in your company and their roles')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">
                {getText('common.actions.loading', 'Loading...')}
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {getText('shop.b2b.noUsers', 'No users found in this company')}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{getText('common.fields.name', 'Name')}</TableHead>
                  <TableHead>{getText('common.fields.email', 'Email')}</TableHead>
                  <TableHead>{getText('shop.b2b.role', 'Role')}</TableHead>
                  <TableHead>{getText('shop.b2b.approvalLimit', 'Approval Limit')}</TableHead>
                  <TableHead>{getText('common.fields.status', 'Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((companyUser) => (
                  <TableRow key={companyUser.id}>
                    <TableCell className="font-medium">
                      {getUserDisplayName(companyUser.user)}
                    </TableCell>
                    <TableCell>{companyUser.user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRoleBadgeClass(companyUser.role)}>
                        {formatRole(companyUser.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(companyUser.approvalLimit)}
                    </TableCell>
                    <TableCell>
                      {companyUser.isActive ? (
                        <Badge variant="default" className="bg-green-500">
                          {getText('common.status.active', 'Active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {getText('common.status.inactive', 'Inactive')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
