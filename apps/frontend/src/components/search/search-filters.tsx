'use client';

import React, { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { productsApi } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  count: number;
}

interface PriceRange {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
}

interface SearchFilters {
  categories: string[];
  priceRange: [number, number];
  inStock: boolean | null;
  sortBy: string;
  sortOrder: string;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClearFilters: () => void;
  className?: string;
}

export function SearchFilters({ filters, onFiltersChange, onClearFilters, className }: SearchFiltersProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([]);
  const [priceStats, setPriceStats] = useState({ min: 0, max: 1000, avg: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // Collapsible states
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isStockOpen, setIsStockOpen] = useState(true);

  useEffect(() => {
    const loadFilterData = async () => {
      setIsLoading(true);
      try {
        const [categoriesResponse, priceRangesResponse] = await Promise.all([
          productsApi.getCategories(),
          productsApi.getPriceRanges(),
        ]);

        setCategories(categoriesResponse.data.categories);
        setPriceRanges(priceRangesResponse.data.ranges);
        setPriceStats(priceRangesResponse.data.stats);
      } catch (error) {
        console.error('Failed to load filter data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilterData();
  }, []);

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, categoryId]
      : filters.categories.filter(id => id !== categoryId);
    
    onFiltersChange({
      ...filters,
      categories: newCategories,
    });
  };

  const handlePriceRangeChange = (value: [number, number]) => {
    onFiltersChange({
      ...filters,
      priceRange: value,
    });
  };

  const handleStockFilterChange = (value: string) => {
    let inStock: boolean | null = null;
    if (value === 'in-stock') inStock = true;
    if (value === 'out-of-stock') inStock = false;
    
    onFiltersChange({
      ...filters,
      inStock,
    });
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('-');
    onFiltersChange({
      ...filters,
      sortBy,
      sortOrder,
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.priceRange[0] > priceStats.min || filters.priceRange[1] < priceStats.max) count++;
    if (filters.inStock !== null) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5" />
          <h3 className="font-semibold">{t('search.filters')}</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs"
          >
            {t('search.clearAll')}
          </Button>
        )}
      </div>

      {/* Sort */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t('search.sortBy')}</Label>
        <Select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onValueChange={handleSortChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">{t('search.sort.newest')}</SelectItem>
            <SelectItem value="createdAt-asc">{t('search.sort.oldest')}</SelectItem>
            <SelectItem value="price-asc">{t('search.sort.priceLowToHigh')}</SelectItem>
            <SelectItem value="price-desc">{t('search.sort.priceHighToLow')}</SelectItem>
            <SelectItem value="name-asc">{t('search.sort.nameAZ')}</SelectItem>
            <SelectItem value="name-desc">{t('search.sort.nameZA')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories */}
      <Collapsible open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto">
            <Label className="text-sm font-medium cursor-pointer">{t('search.categories')}</Label>
            {isCategoriesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={category.id}
                checked={filters.categories.includes(category.id)}
                onCheckedChange={(checked) => handleCategoryChange(category.id, checked as boolean)}
              />
              <Label
                htmlFor={category.id}
                className="text-sm cursor-pointer flex-1 flex items-center justify-between"
              >
                <span>{category.name}</span>
                <span className="text-xs text-gray-500">({category.count})</span>
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Price Range */}
      <Collapsible open={isPriceOpen} onOpenChange={setIsPriceOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto">
            <Label className="text-sm font-medium cursor-pointer">{t('search.priceRange')}</Label>
            {isPriceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-3">
          <div className="px-2">
            <Slider
              value={filters.priceRange}
              onValueChange={handlePriceRangeChange}
              max={priceStats.max}
              min={priceStats.min}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>${filters.priceRange[0]}</span>
              <span>${filters.priceRange[1]}</span>
            </div>
          </div>
          
          {/* Quick Price Ranges */}
          <div className="space-y-2">
            {priceRanges.map((range) => (
              <Button
                key={range.id}
                variant="outline"
                size="sm"
                onClick={() => handlePriceRangeChange([range.min, range.max === 999999 ? priceStats.max : range.max])}
                className="w-full justify-between text-xs"
              >
                <span>{range.label}</span>
                <span className="text-gray-500">({range.count})</span>
              </Button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Stock Status */}
      <Collapsible open={isStockOpen} onOpenChange={setIsStockOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto">
            <Label className="text-sm font-medium cursor-pointer">{t('search.availability')}</Label>
            {isStockOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          <Select
            value={
              filters.inStock === true ? 'in-stock' : 
              filters.inStock === false ? 'out-of-stock' : 'all'
            }
            onValueChange={handleStockFilterChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('search.stock.all')}</SelectItem>
              <SelectItem value="in-stock">{t('search.stock.inStock')}</SelectItem>
              <SelectItem value="out-of-stock">{t('search.stock.outOfStock')}</SelectItem>
            </SelectContent>
          </Select>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
