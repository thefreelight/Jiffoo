'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  Check,
  RefreshCw,
  Settings
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ThemeMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  previewImage?: string;
  source: 'builtin' | 'installed';
}

interface ActiveTheme {
  slug: string;
  config: Record<string, unknown>;
  version: string;
  source: 'builtin' | 'installed';
}

export default function ThemesPage() {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
  const [installedThemes, setInstalledThemes] = useState<ThemeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = '/api';

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const activeRes = await fetch(`${API_BASE}/themes/active`);
      const activeData = await activeRes.json();
      if (activeData.success) {
        setActiveTheme(activeData.data);
      }

      const installedRes = await fetch(`${API_BASE}/themes/installed`);
      const installedData = await installedRes.json();
      if (installedData.success) {
        setInstalledThemes(installedData.data.themes || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const handleActivate = async (slug: string) => {
    try {
      const response = await apiClient.post(`/admin/themes/${slug}/activate`, {});
      if (response.success) {
        loadThemes();
      } else {
        setError(response.message || 'Activation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading themes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Theme Management</h1>
          <p className="text-gray-500 mt-1">
            Manage your store themes
          </p>
        </div>
        <Button variant="outline" onClick={loadThemes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      {activeTheme && (
        <Card className="border-2 border-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Palette className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>Active: {activeTheme.slug}</span>
                    <Badge className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Version {activeTheme.version}
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Customize
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Installed Themes ({installedThemes.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {installedThemes.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No themes installed yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Install themes via offline ZIP upload
                </p>
              </CardContent>
            </Card>
          ) : (
            installedThemes.map((theme) => (
              <Card
                key={theme.slug}
                className={activeTheme?.slug === theme.slug ? 'border-green-500 border-2' : ''}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{theme.name}</CardTitle>
                    {activeTheme?.slug === theme.slug && (
                      <Badge className="bg-green-500">Active</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {theme.description || `Version ${theme.version}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    {activeTheme?.slug !== theme.slug && (
                      <Button
                        size="sm"
                        onClick={() => handleActivate(theme.slug)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Settings className="h-4 w-4 mr-1" />
                      Customize
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
