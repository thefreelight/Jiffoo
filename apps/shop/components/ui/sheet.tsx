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
export const SheetPortal = Primitive.Portal;
export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 p-6', className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-auto flex flex-col gap-2 p-6', className)} {...props} />;
}
const sides = {
  left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  bottom: 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
};
export function SheetContent({ children, className, closeLabel, side = 'right', ...props }: React.ComponentPropsWithoutRef<typeof Primitive.Content> & { closeLabel: string; side?: keyof typeof sides }) {
  return <Primitive.Portal><Primitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-70 bg-black/50" />
    <Primitive.Content data-slot="sheet-content" className={cn('fixed z-80 flex flex-col border-border bg-background text-foreground shadow-overlay data-[state=open]:animate-in data-[state=closed]:animate-out', sides[side], className)} {...props}>
      {children}<Primitive.Close aria-label={closeLabel} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md hover:bg-accent"><X className="size-4" aria-hidden="true" /></Primitive.Close>
    </Primitive.Content></Primitive.Portal>;
}
