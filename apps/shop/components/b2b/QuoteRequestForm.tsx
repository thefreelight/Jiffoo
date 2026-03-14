/**
 * Quote Request Form Component
 *
 * Form for creating new quote requests with product items
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Send } from 'lucide-react';
import type { QuoteItem } from '@/store/quotes';

interface QuoteRequestFormProps {
  companyId: string;
  onSubmit: (data: {
    companyId: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
      taxRate?: number;
      notes?: string;
    }>;
    notes?: string;
    customerNotes?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  getText: (key: string, fallback: string) => string;
}

interface FormItem {
  productId: string;
  variantId: string;
  quantity: number;
  notes?: string;
}

export function QuoteRequestForm({ companyId, onSubmit, isLoading, getText }: QuoteRequestFormProps) {
  const [items, setItems] = useState<FormItem[]>([
    { productId: '', variantId: '', quantity: 1, notes: '' }
  ]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Add new item row
  const addItem = () => {
    setItems([...items, { productId: '', variantId: '', quantity: 1, notes: '' }]);
  };

  // Remove item row
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Update item field
  const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Validate form
  const validateForm = (): boolean => {
    // Check if at least one item has valid data
    const hasValidItem = items.some(item =>
      item.productId.trim() !== '' &&
      item.variantId.trim() !== '' &&
      item.quantity > 0
    );

    if (!hasValidItem) {
      setError(getText('shop.b2b.errorNoItems', 'Please add at least one item with product ID, variant ID, and quantity.'));
      return false;
    }

    // Validate contact email if provided
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError(getText('shop.b2b.errorInvalidEmail', 'Please enter a valid email address.'));
      return false;
    }

    setError(null);
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Filter out empty items
    const validItems = items.filter(item =>
      item.productId.trim() !== '' &&
      item.variantId.trim() !== '' &&
      item.quantity > 0
    );

    try {
      await onSubmit({
        companyId,
        items: validItems,
        customerNotes: customerNotes.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });

      // Reset form on success
      setItems([{ productId: '', variantId: '', quantity: 1, notes: '' }]);
      setCustomerNotes('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setError(null);
    } catch (err) {
      setError((err as Error).message || getText('shop.b2b.errorCreateQuote', 'Failed to create quote request'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getText('shop.b2b.newQuoteRequest', 'New Quote Request')}</CardTitle>
        <CardDescription>
          {getText('shop.b2b.quoteRequestDescription', 'Submit a request for a custom quote on bulk orders')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                {getText('shop.b2b.items', 'Items')}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                {getText('shop.b2b.addItem', 'Add Item')}
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {getText('shop.b2b.item', 'Item')} {index + 1}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`productId-${index}`}>
                      {getText('shop.b2b.productId', 'Product ID')} *
                    </Label>
                    <Input
                      id={`productId-${index}`}
                      value={item.productId}
                      onChange={(e) => updateItem(index, 'productId', e.target.value)}
                      placeholder={getText('shop.b2b.productIdPlaceholder', 'Enter product ID')}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor={`variantId-${index}`}>
                      {getText('shop.b2b.variantId', 'Variant ID')} *
                    </Label>
                    <Input
                      id={`variantId-${index}`}
                      value={item.variantId}
                      onChange={(e) => updateItem(index, 'variantId', e.target.value)}
                      placeholder={getText('shop.b2b.variantIdPlaceholder', 'Enter variant ID')}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor={`quantity-${index}`}>
                      {getText('shop.b2b.quantity', 'Quantity')} *
                    </Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`notes-${index}`}>
                    {getText('shop.b2b.itemNotes', 'Item Notes')}
                  </Label>
                  <Input
                    id={`notes-${index}`}
                    value={item.notes || ''}
                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                    placeholder={getText('shop.b2b.itemNotesPlaceholder', 'Special requirements or notes')}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              {getText('shop.b2b.contactInfo', 'Contact Information')}
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="contactName">
                  {getText('common.fields.name', 'Name')}
                </Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={getText('shop.b2b.contactNamePlaceholder', 'Your name')}
                />
              </div>

              <div>
                <Label htmlFor="contactEmail">
                  {getText('common.fields.email', 'Email')}
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={getText('shop.b2b.contactEmailPlaceholder', 'your.email@example.com')}
                />
              </div>

              <div>
                <Label htmlFor="contactPhone">
                  {getText('common.fields.phone', 'Phone')}
                </Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={getText('shop.b2b.contactPhonePlaceholder', '+1 (555) 123-4567')}
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="customerNotes">
              {getText('shop.b2b.additionalNotes', 'Additional Notes')}
            </Label>
            <textarea
              id="customerNotes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder={getText('shop.b2b.notesPlaceholder', 'Any additional information or special requests...')}
              className="w-full min-h-[100px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            {isLoading
              ? getText('common.actions.submitting', 'Submitting...')
              : getText('shop.b2b.submitQuoteRequest', 'Submit Quote Request')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
