'use client';
import * as React from 'react';
import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;
export const SheetTitle = Primitive.Title;
export const SheetDescription = Primitive.Description;
export function SheetContent({ children, className, closeLabel, ...props }: React.ComponentPropsWithoutRef<typeof Primitive.Content> & { closeLabel: string }) {
  return <Primitive.Portal><Primitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-70 bg-overlay-ink" />
    <Primitive.Content data-slot="sheet-content" className={cn('fixed inset-y-0 left-0 z-80 w-60 border-r bg-background text-foreground shadow-overlay', className)} {...props}>
      {children}<Primitive.Close aria-label={closeLabel} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md hover:bg-accent"><X className="size-4" aria-hidden="true" /></Primitive.Close>
    </Primitive.Content></Primitive.Portal>;
}
