'use client';
import * as React from 'react';
import * as Primitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;
export const TooltipContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, sideOffset = 6, ...props }, ref) =>
  <Primitive.Portal><Primitive.Content ref={ref} sideOffset={sideOffset} data-slot="tooltip-content" className={cn('z-90 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-overlay', className)} {...props} /></Primitive.Portal>);
TooltipContent.displayName = 'TooltipContent';
