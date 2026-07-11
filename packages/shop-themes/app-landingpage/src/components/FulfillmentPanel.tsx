/**
 * Fulfillment Panel Component
 * Renders dynamic fulfillment inputs based on product type
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FulfillmentFormState, TypeData } from '../lib/fulfillment';
import {
  classifyProductType,
  requiresCardUid,
  requiresShippingAddress,
} from '../lib/fulfillment';

interface FulfillmentPanelProps {
  typeData: TypeData | null;
  formState: FulfillmentFormState;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  onBlur: (field: string) => void;
  scrollIntoView?: boolean;
}

export function FulfillmentPanel({
  typeData,
  formState,
  errors,
  onChange,
  onBlur,
  scrollIntoView = false,
}: FulfillmentPanelProps) {
  const productClass = classifyProductType(typeData);
  const needsCardUid = requiresCardUid(typeData, productClass);
  const needsShipping = requiresShippingAddress(typeData, productClass);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESIM: collapsible advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scroll into view when validation fails
  useEffect(() => {
    if (scrollIntoView && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollIntoView]);

  // Unknown product type - no fulfillment needed
  if (productClass === 'unknown') {
    return null;
  }

  // ESIM: optional cardUid in collapsible section
  if (productClass === 'esim') {
    return (
      <div ref={panelRef} className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-left group"
        >
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
            Advanced (Optional)
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Card UID (Optional)
              </label>
              <input
                type="text"
                value={formState.cardUid}
                onChange={(e) => onChange('cardUid', e.target.value)}
                onBlur={() => onBlur('cardUid')}
                placeholder="Enter card UID if available"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // DATA: required cardUid
  if (needsCardUid) {
    return (
      <div ref={panelRef} className="border-t border-border pt-4">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
          Required Information
        </p>
        <div>
          <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
            Card UID <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={formState.cardUid}
            onChange={(e) => onChange('cardUid', e.target.value)}
            onBlur={() => onBlur('cardUid')}
            placeholder="Enter your card UID"
            className={cn(
              "w-full px-3 py-2 bg-muted border text-foreground font-mono text-sm focus:outline-none transition-colors",
              errors.cardUid
                ? "border-destructive focus:border-destructive"
                : "border-border focus:border-foreground"
            )}
          />
          {errors.cardUid && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
              <span className="font-mono text-[10px] text-destructive">{errors.cardUid}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CARD: required shipping address
  if (needsShipping) {
    return (
      <div ref={panelRef} className="border-t border-border pt-4">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
          Shipping Address <span className="text-destructive">*</span>
        </p>
        <div className="space-y-3">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formState.shippingAddress.firstName}
                onChange={(e) => onChange('shippingAddress.firstName', e.target.value)}
                onBlur={() => onBlur('shippingAddress.firstName')}
                placeholder="First name"
                className={cn(
                  "w-full px-3 py-2 bg-muted border text-foreground font-mono text-sm focus:outline-none transition-colors",
                  errors['shippingAddress.firstName']
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-foreground"
                )}
              />
              {errors['shippingAddress.firstName'] && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                  <span className="font-mono text-[10px] text-destructive">
                    {errors['shippingAddress.firstName']}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={formState.shippingAddress.lastName}
                onChange={(e) => onChange('shippingAddress.lastName', e.target.value)}
                onBlur={() => onBlur('shippingAddress.lastName')}
                placeholder="Last name"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Contact Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={formState.shippingAddress.phone}
                onChange={(e) => onChange('shippingAddress.phone', e.target.value)}
                onBlur={() => onBlur('shippingAddress.phone')}
                placeholder="+1234567890"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={formState.shippingAddress.email}
                onChange={(e) => onChange('shippingAddress.email', e.target.value)}
                onBlur={() => onBlur('shippingAddress.email')}
                placeholder="email@example.com"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Address Line 1 */}
          <div>
            <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
              Address Line 1 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formState.shippingAddress.addressLine1}
              onChange={(e) => onChange('shippingAddress.addressLine1', e.target.value)}
              onBlur={() => onBlur('shippingAddress.addressLine1')}
              placeholder="Street address"
              className={cn(
                "w-full px-3 py-2 bg-muted border text-foreground font-mono text-sm focus:outline-none transition-colors",
                errors['shippingAddress.addressLine1']
                  ? "border-destructive focus:border-destructive"
                  : "border-border focus:border-foreground"
              )}
            />
            {errors['shippingAddress.addressLine1'] && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                <span className="font-mono text-[10px] text-destructive">
                  {errors['shippingAddress.addressLine1']}
                </span>
              </div>
            )}
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
              Address Line 2
            </label>
            <input
              type="text"
              value={formState.shippingAddress.addressLine2}
              onChange={(e) => onChange('shippingAddress.addressLine2', e.target.value)}
              onBlur={() => onBlur('shippingAddress.addressLine2')}
              placeholder="Apartment, suite, etc. (optional)"
              className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
            />
          </div>

          {/* City, State, Postal */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                City <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formState.shippingAddress.city}
                onChange={(e) => onChange('shippingAddress.city', e.target.value)}
                onBlur={() => onBlur('shippingAddress.city')}
                placeholder="City"
                className={cn(
                  "w-full px-3 py-2 bg-muted border text-foreground font-mono text-sm focus:outline-none transition-colors",
                  errors['shippingAddress.city']
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-foreground"
                )}
              />
              {errors['shippingAddress.city'] && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                  <span className="font-mono text-[10px] text-destructive">
                    {errors['shippingAddress.city']}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                State
              </label>
              <input
                type="text"
                value={formState.shippingAddress.state}
                onChange={(e) => onChange('shippingAddress.state', e.target.value)}
                onBlur={() => onBlur('shippingAddress.state')}
                placeholder="State"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
                Postal Code
              </label>
              <input
                type="text"
                value={formState.shippingAddress.postalCode}
                onChange={(e) => onChange('shippingAddress.postalCode', e.target.value)}
                onBlur={() => onBlur('shippingAddress.postalCode')}
                placeholder="12345"
                className="w-full px-3 py-2 bg-muted border border-border text-foreground font-mono text-sm focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">
              Country <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formState.shippingAddress.country}
              onChange={(e) => onChange('shippingAddress.country', e.target.value)}
              onBlur={() => onBlur('shippingAddress.country')}
              placeholder="Country"
              className={cn(
                "w-full px-3 py-2 bg-muted border text-foreground font-mono text-sm focus:outline-none transition-colors",
                errors['shippingAddress.country']
                  ? "border-destructive focus:border-destructive"
                  : "border-border focus:border-foreground"
              )}
            />
            {errors['shippingAddress.country'] && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                <span className="font-mono text-[10px] text-destructive">
                  {errors['shippingAddress.country']}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
