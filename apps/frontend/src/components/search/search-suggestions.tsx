'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Clock, TrendingUp, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useDebounce } from '@/hooks/use-debounce';
import { productsApi } from '@/lib/api';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'product' | 'category' | 'popular';
}

interface SearchSuggestionsProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchSuggestions({ onSearch, placeholder, className }: SearchSuggestionsProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [popularTerms, setPopularTerms] = useState<Array<{ term: string; count: number }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Load popular terms on mount
  useEffect(() => {
    const loadPopularTerms = async () => {
      try {
        const response = await productsApi.getPopularSearchTerms();
        setPopularTerms(response.data.popularTerms);
      } catch (error) {
        console.error('Failed to load popular terms:', error);
      }
    };
    loadPopularTerms();
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await productsApi.getSearchSuggestions(debouncedQuery);
        setSuggestions(response.data.suggestions);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allSuggestions = [...suggestions, ...popularTerms.map(term => ({ 
      id: term.term, 
      text: term.term, 
      type: 'popular' as const 
    }))];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allSuggestions[selectedIndex]) {
          handleSuggestionClick(allSuggestions[selectedIndex].text);
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
      setIsOpen(false);
      setSelectedIndex(-1);
      // Save to search history (localStorage)
      saveToSearchHistory(query.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
    saveToSearchHistory(suggestion);
  };

  const saveToSearchHistory = (term: string) => {
    try {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const newHistory = [term, ...history.filter((h: string) => h !== term)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const showSuggestions = isOpen && (suggestions.length > 0 || popularTerms.length > 0 || query.length === 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('search.placeholder')}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearQuery}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Product Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
                {t('search.suggestions')}
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 ${
                    selectedIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="flex-1">{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Terms */}
          {popularTerms.length > 0 && query.length === 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1 flex items-center space-x-1">
                <TrendingUp className="w-3 h-3" />
                <span>{t('search.popular')}</span>
              </div>
              {popularTerms.slice(0, 5).map((term, index) => (
                <button
                  key={term.term}
                  onClick={() => handleSuggestionClick(term.term)}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                    selectedIndex === suggestions.length + index ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  <span className="flex items-center space-x-3">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span>{term.term}</span>
                  </span>
                  <span className="text-xs text-gray-400">{term.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto"></div>
              <span className="text-sm mt-2">{t('search.loading')}</span>
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.length >= 2 && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('search.noResults')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
