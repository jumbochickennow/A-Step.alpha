import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/Accordion';

export const faqKeys = ['agency', 'located', 'guarantee', 'payments', 'complaint', 'languages'] as const;

export function FaqList({ limit, design = false }: { limit?: number; design?: boolean }) {
  const { t } = useTranslation();
  return (
    <Accordion type="single" collapsible defaultValue={design ? faqKeys[0] : undefined} className={design ? 'space-y-1' : 'card px-5 md:px-8'}>
      {faqKeys.slice(0, limit).map((key) => (
        <AccordionItem key={key} value={key} className={design ? 'overflow-hidden rounded-md border-0 bg-transparent px-5 data-[state=open]:bg-brand-blue' : undefined}>
          <AccordionTrigger className={design ? 'min-h-12 py-3 text-sm' : undefined}>{t(`about.faq.${key}.q`)}</AccordionTrigger>
          <AccordionContent className={design ? 'text-xs text-white/80' : undefined}>{t(`about.faq.${key}.a`)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
