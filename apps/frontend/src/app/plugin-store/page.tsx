'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Download, Search, Filter, ShoppingCart, Zap, TrendingUp, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PluginMetadata {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price: number;
    currency: string;
    billing: 'monthly' | 'yearly' | 'one-time';
    trialDays?: number;
  };
  features: string[];
  media: {
    icon: string;
    screenshots: string[];
  };
  stats: {
    downloads: number;
    activeInstalls: number;
    rating: number;
    reviewCount: number;
  };
  status: string;
}

interface UserLicense {
  id: string;
  type: string;
  expiresAt?: string;
  features: string[];
}

export default function PluginStorePage() {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState('rating');
  const [loading, setLoading] = useState(true);
  const [userPlugins, setUserPlugins] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlugins();
    fetchCategories();
    fetchUserPlugins();
  }, [searchQuery, selectedCategory, sortBy]);

  const fetchPlugins = async () => {
    try {
      const params = new URLSearchParams({
        ...(searchQuery && { q: searchQuery }),
        ...(selectedCategory && { category: selectedCategory }),
        sort: sortBy,
        limit: '20'
      });

      const response = await fetch(`/api/plugin-store/plugins?${params}`);
      const data = await response.json();
      setPlugins(data.plugins || []);
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load plugins',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/plugin-store/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchUserPlugins = async () => {
    try {
      const response = await fetch('/api/plugin-store/my-plugins', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserPlugins(data.plugins || []);
      }
    } catch (error) {
      console.error('Failed to fetch user plugins:', error);
    }
  };

  const handlePurchase = async (pluginId: string, licenseType: 'trial' | 'monthly' | 'yearly') => {
    try {
      const response = await fetch('/api/plugin-store/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          pluginId,
          licenseType
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Plugin purchased successfully'
        });
        fetchUserPlugins(); // Refresh user plugins
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Purchase failed',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Purchase failed',
        variant: 'destructive'
      });
    }
  };

  const isPluginOwned = (pluginId: string) => {
    return userPlugins.some(p => p.id === pluginId);
  };

  const getPluginIcon = (category: string) => {
    switch (category) {
      case 'Analytics':
        return <TrendingUp className="h-6 w-6" />;
      case 'Marketing':
        return <Users className="h-6 w-6" />;
      case 'Integration':
        return <Zap className="h-6 w-6" />;
      default:
        return <ShoppingCart className="h-6 w-6" />;
    }
  };

  const formatPrice = (pricing: PluginMetadata['pricing']) => {
    if (pricing.type === 'free') return 'Free';
    return `$${pricing.price}/${pricing.billing === 'monthly' ? 'mo' : 'yr'}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Plugin Store</h1>
        <p className="text-gray-600">Extend your store with powerful plugins</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="downloads">Downloads</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="mb-8">
        <TabsList>
          <TabsTrigger value="all">All Plugins</TabsTrigger>
          <TabsTrigger value="my-plugins">My Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {/* Plugin Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plugins.map((plugin) => (
              <Card key={plugin.id} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        {getPluginIcon(plugin.category)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plugin.displayName}</CardTitle>
                        <CardDescription className="text-sm">v{plugin.version}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={plugin.pricing.type === 'free' ? 'secondary' : 'default'}>
                      {formatPrice(plugin.pricing)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="text-sm text-gray-600 mb-4">{plugin.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{plugin.stats.rating}</span>
                      <span>({plugin.stats.reviewCount})</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Download className="h-4 w-4" />
                      <span>{plugin.stats.downloads.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {plugin.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  {isPluginOwned(plugin.id) ? (
                    <Button className="w-full" disabled>
                      Installed
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      {plugin.pricing.trialDays && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handlePurchase(plugin.id, 'trial')}
                        >
                          Start {plugin.pricing.trialDays}-day Trial
                        </Button>
                      )}
                      {plugin.pricing.type !== 'free' && (
                        <Button
                          className="w-full"
                          onClick={() => handlePurchase(plugin.id, 'monthly')}
                        >
                          Buy Now - {formatPrice(plugin.pricing)}
                        </Button>
                      )}
                      {plugin.pricing.type === 'free' && (
                        <Button
                          className="w-full"
                          onClick={() => handlePurchase(plugin.id, 'monthly')}
                        >
                          Install Free
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-plugins" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userPlugins.map((plugin) => (
              <Card key={plugin.id} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        {getPluginIcon(plugin.category)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plugin.displayName}</CardTitle>
                        <CardDescription className="text-sm">v{plugin.version}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="text-sm text-gray-600 mb-4">{plugin.description}</p>
                  
                  {plugin.license && (
                    <div className="text-sm text-gray-500 mb-4">
                      <p>License: {plugin.license.type}</p>
                      {plugin.license.expiresAt && (
                        <p>Expires: {new Date(plugin.license.expiresAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-0">
                  <div className="w-full space-y-2">
                    <Button variant="outline" className="w-full">
                      Configure
                    </Button>
                    <Button variant="outline" className="w-full">
                      View Documentation
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {userPlugins.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins installed</h3>
              <p className="text-gray-500 mb-4">Browse the store to find plugins for your store</p>
              <Button onClick={() => document.querySelector('[value="all"]')?.click()}>
                Browse Plugins
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
