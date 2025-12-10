'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Palette,
  Store,
  Check,
  RefreshCw,
  Settings,
  Download,
  Globe,
  Star,
  Eye
} from 'lucide-react';

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

interface MarketplaceTheme {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  price: number;
  currency: string;
  previewImage: string;
  rating: number;
  downloads: number;
}

export default function ThemesPage() {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
  const [installedThemes, setInstalledThemes] = useState<ThemeMeta[]>([]);
  const [marketplaceThemes, setMarketplaceThemes] = useState<MarketplaceTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load active theme
      const activeRes = await fetch(`${API_BASE}/api/themes/active`);
      const activeData = await activeRes.json();
      if (activeData.success) {
        setActiveTheme(activeData.data);
      }

      // Load installed themes
      const installedRes = await fetch(`${API_BASE}/api/themes/installed`);
      const installedData = await installedRes.json();
      if (installedData.success) {
        setInstalledThemes(installedData.data.themes || []);
      }

      // Load marketplace themes
      const marketRes = await fetch(`${API_BASE}/api/marketplace/themes`);
      const marketData = await marketRes.json();
      if (marketData.success) {
        setMarketplaceThemes(marketData.data.items || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const handleActivate = async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/themes/${slug}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        loadThemes();
      } else {
        setError(data.error || 'Activation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    }
  };

  const handleMarketplaceInstall = async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/themes/${slug}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        loadThemes();
      } else {
        setError(data.error || 'Install failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Theme Marketplace</h1>
          <p className="text-gray-500 mt-1">
            Customize your store appearance with beautiful themes
          </p>
        </div>
        <Button variant="outline" onClick={loadThemes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      {/* Active Theme Card */}
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

      {/* Tabs */}
      <Tabs defaultValue="marketplace" className="w-full">
        <TabsList>
          <TabsTrigger value="marketplace">
            <Globe className="h-4 w-4 mr-2" />
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="installed">
            <Store className="h-4 w-4 mr-2" />
            My Themes ({installedThemes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketplaceThemes.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No themes available yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Check back soon for new themes
                  </p>
                </CardContent>
              </Card>
            ) : (
              marketplaceThemes.map((theme) => (
                <Card key={theme.slug} className="overflow-hidden">
                  {theme.previewImage && (
                    <div className="h-40 bg-gray-100 relative">
                      <img
                        src={theme.previewImage}
                        alt={theme.name}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{theme.name}</CardTitle>
                      <Badge variant={theme.price === 0 ? 'secondary' : 'default'}>
                        {theme.price === 0 ? 'Free' : `$${theme.price}`}
                      </Badge>
                    </div>
                    <CardDescription>{theme.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 mr-1" />
                        {theme.rating}
                      </span>
                      <span>{theme.downloads} installs</span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleMarketplaceInstall(theme.slug)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Install Theme
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {installedThemes.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No themes installed yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Browse the marketplace to find themes
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
