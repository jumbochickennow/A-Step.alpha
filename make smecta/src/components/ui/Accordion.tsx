import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../../lib/utils';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<ElementRef<typeof AccordionPrimitive.Item>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>>(
  ({ className, ...props }, ref) => <AccordionPrimitive.Item ref={ref} className={cn('border-b border-border', className)} {...props} />,
);
AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = forwardRef<ElementRef<typeof AccordionPrimitive.Trigger>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger ref={ref} className={cn('group flex min-h-14 w-full items-center justify-between gap-4 py-4 text-start font-semibold text-white', className)} {...props}>
        {children}
        <ChevronDown className="ms-auto shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" size={18} aria-hidden="true" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  ),
);
AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = forwardRef<ElementRef<typeof AccordionPrimitive.Content>, ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Content ref={ref} className="overflow-hidden text-ink-muted data-[state=closed]:animate-[fade-rise_150ms_reverse] data-[state=open]:animate-[fade-rise_200ms_ease-out]" {...props}>
      <div className={cn('pb-5 pe-8 leading-relaxed', className)}>{children}</div>
    </AccordionPrimitive.Content>
  ),
);
AccordionContent.displayName = 'AccordionContent';
