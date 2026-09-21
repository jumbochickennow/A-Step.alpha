import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/common/Seo';
import { localizedPath, useLocale } from '../hooks/useLocale';
import { whatsappHref } from '../lib/constants';
import { track } from '../services/analytics';
import en from './prices/copy.en.json';
import fr from './prices/copy.fr.json';
import ar from './prices/copy.ar.json';
import '../styles/prices.css';

type Copy = typeof en;
const tierIds = ['standard', 'professional', 'premium'] as const;
const prices = [6000, 32000, 97000];

function Mark({ coral = false }: { coral?: boolean }) {
  return <span className={`price-mark${coral ? ' price-mark--coral' : ''}`} aria-hidden="true"><i /><i /></span>;
}

function Inquiry({ copy, tier, children, className = '', source }: { copy: Copy; tier?: number; children: ReactNode; className?: string; source: string }) {
  const lastClick = useRef(0);
  const message = tier === undefined ? copy.generalMessage : copy.inquiryMessage.replace('{{tier}}', copy.tiers[tier].name).replace('{{price}}', String(prices[tier]));
  return <a className={`price-button ${className}`} href={whatsappHref(message)} target="_blank" rel="noopener noreferrer" onClick={(event) => {
    const now = Date.now();
    if (now - lastClick.current < 3000) { event.preventDefault(); return; }
    lastClick.current = now;
    track('whatsapp_click', { source, tier: tier === undefined ? 'consultation' : tierIds[tier] });
  }}>{children}</a>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="price-heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>;
}

function FeatureList({ items, branded = false }: { items: string[]; branded?: boolean }) {
  return <ul className="price-features">{items.map((item) => <li key={item}>{branded ? <Mark coral /> : <Check aria-hidden="true" size={18} strokeWidth={3} />}<span>{item}</span></li>)}</ul>;
}

function CvExample({ before, after }: { before: string; after: string }) {
  return <div className="price-cv-panels" dir="ltr">
    <article className="price-cv-before" lang="fr" aria-label={before}><div className="price-cv-person"><span className="price-cv-avatar" /><div><strong>Yacine B.</strong><p>Né le 14/03/2003 · Célibataire · Alger<br />yacine.b@example.dz · 0X XX XX XX XX</p></div><b className="price-number">1</b></div>
      <h3>OBJECTIF <b className="price-number">2</b></h3><p>Je suis un étudiant motivé et sérieux, je cherche une opportunité pour continuer mes études à l’étranger dans une grande université.</p>
      <h3>FORMATION <b className="price-number">3</b></h3><p>Bac 2021 mention assez bien · Université — Informatique · Lycée — Sciences expérimentales</p>
      <h3>DIVERS <b className="price-number">4</b></h3><p>Français, Anglais, Arabe · Word, Excel, PowerPoint · Football, lecture, voyages</p>
    </article>
    <article className="price-cv-after" lang="en" aria-label={after}><span className="price-mobile-cv-label">{after}</span><div className="price-cv-person"><div><strong>YACINE BENALI</strong><p>BSc Computer Science (in progress, 2027) · Algiers, Algeria ·<br />yacine.b@example.dz · +213 X XX XX XX XX</p></div></div>
      <h3>EDUCATION</h3><p>BSc Computer Science, USTHB Algiers — 2023–2027 (expected). GPA 14.2/20, equivalent to a UK 2:1 / ECTS grade B. Baccalauréat, Experimental Sciences stream — 2021, 14.8/20.</p>
      <h3>PROFILE</h3><p>Third-year computer science student applying for a Master’s in data engineering for the September 2027 intake. Two internships in data preparation; targeting programmes with an applied thesis.</p>
      <h3>EXPERIENCE <b className="price-number">5</b></h3><p>Data assistant, intern — Algiers, Jul–Sep 2025. Cleaned and documented a 40 000-row dataset; wrote the handover notes used by the team.</p>
    </article>
  </div>;
}

export function Prices() {
  const { locale } = useLocale();
  const copy: Copy = { en, fr, ar }[locale];
  const [selectedTier, setSelectedTier] = useState(0);
  const [activeBookingStep, setActiveBookingStep] = useState<number | null>(null);
  const link = (path: string) => localizedPath(path, locale);
  const selectWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else if (event.key === 'ArrowRight') next = (index + (locale === 'ar' ? 2 : 1)) % 3;
    else if (event.key === 'ArrowLeft') next = (index + (locale === 'ar' ? 1 : 2)) % 3;
    else return;
    event.preventDefault(); setSelectedTier(next);
    document.getElementById(`price-tab-${tierIds[next]}`)?.focus();
  };

  return <div className="prices-page" data-surface="light">
    <Seo title={copy.metaTitle} description={copy.metaDescription} noindex />
    <section className="price-intro price-container" aria-labelledby="price-title">
      <h1 id="price-title">{copy.heroTitle}</h1><p className="price-intro-subtitle">{copy.heroSubtitle}</p>
      <div className="price-booking">
        <a href="#packages" className="price-hero-art" aria-label={copy.scrollOffers}><img src="/assets/prices/consultation-hero.jpg" width="660" height="615" alt="" fetchPriority="high" /></a>
        <ol className="price-booking-steps">{copy.booking.map((step, i) => <li key={step.title} className={activeBookingStep === i ? 'price-booking-step--active' : undefined}><span>{i + 1}</span><div><h2>{i === 0 ? <a className="price-step-trigger" href="#packages" onClick={() => setActiveBookingStep(i)}>{step.title}</a> : <button className="price-step-trigger" type="button" aria-pressed={activeBookingStep === i} onClick={() => setActiveBookingStep(activeBookingStep === i ? null : i)}>{step.title}</button>}</h2><p>{step.body}</p></div></li>)}</ol>
      </div>
    </section>

    <section id="packages" className="price-packages price-container" aria-labelledby="packages-title">
      <h2 id="packages-title">{copy.packagesTitle}</h2><p className="price-countries">{copy.countries}</p><ul className="price-country-boxes" aria-label={copy.countries}>{copy.offeredCountries.map((country, index) => <li key={country} tabIndex={0} style={{ animationDelay: `${index * 70}ms` }}>{country}</li>)}</ul>
      <div className="price-tier-grid">{copy.tiers.map((tier, i) => <article className={`price-tier price-tier--${tierIds[i]}`} key={tierIds[i]}>
        <div className="price-tier-label">{tier.name}</div><h3><bdi>{prices[i]}DA</bdi></h3><p className="price-payment">{i === 2 ? copy.installments : copy.upfront}</p>
        <p className="price-audience">{tier.audience}</p><FeatureList items={tier.features} />
        <Inquiry copy={copy} tier={i} source={`prices_${tierIds[i]}`}>{copy.inquire}</Inquiry>
      </article>)}</div>
      <p className="price-booking-note">{copy.bookingNote}</p>
    </section>

    <section className="price-process price-pale"><div className="price-container"><SectionHeading title={copy.processTitle} subtitle={copy.processSubtitle} /><ol className="price-process-grid">{copy.steps.map((step, i) => <li key={step.title}><div className="price-step-index"><Mark /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol></div></section>

    <section className="price-coaching price-container"><div className="price-coaching-copy"><p className="price-eyebrow">{copy.coachingEyebrow}</p><h2>{copy.coachingTitle}</h2><p>{copy.coachingBody}</p><strong className="price-coaching-emphasis">{copy.coachingEmphasis}</strong><div className="price-language-pills"><span>{copy.arabic}</span><span>{copy.english}</span></div><p className="price-coaching-note">{copy.coachingNote}</p></div>
      <div className="price-session"><div className="price-session-top"><strong><i />{copy.session} <span>47:12</span></strong><span className="price-session-tier">{copy.sessionTier}</span></div><div className="price-session-grid"><div><h3>{copy.agenda}</h3>{copy.agendaItems.map(item => <p key={item}>{item}</p>)}</div><div><h3>{copy.documents}</h3>{copy.documentItems.map(item => <p key={item}><span className="price-document-box" />{item}</p>)}</div></div><p className="price-session-note"><Mark />{copy.sessionNote}</p></div>
    </section>

    <section className="price-guides price-container"><SectionHeading title={copy.guidesTitle} subtitle={copy.guidesSubtitle} /><div className="price-guide-grid"><article className="price-guide"><h3>{copy.freeGuide}</h3><p className="price-guide-label">{copy.freeGuideLabel}</p><FeatureList items={copy.freeFeatures} /><Link className="price-button price-button--outline" to={link('/guides')}>{copy.exploreGuides}</Link></article><article className="price-guide price-guide--dark"><h3>{copy.personalGuide}</h3><p className="price-guide-label">{copy.personalGuideLabel}</p><FeatureList branded items={copy.personalFeatures} /><Inquiry copy={copy} tier={0} source="prices_personalized_guide">{copy.request}</Inquiry></article></div><p className="price-guides-note">{copy.guidesNote}</p></section>

    <section className="price-cv price-pale"><div className="price-container"><SectionHeading title={copy.cvTitle} subtitle={copy.cvSubtitle} /><p className="price-fictional">{copy.fictional}</p><div className="price-cv-labels"><span>{copy.before}</span><span>{copy.after}</span></div><CvExample before={copy.before} after={copy.after} /><ol className="price-cv-notes">{copy.cvNotes.map((note, i) => <li key={note}><span>{i + 1}</span><p>{note}</p></li>)}</ol></div></section>

    <section className="price-support price-container"><SectionHeading title={copy.supportTitle} subtitle={copy.supportSubtitle} /><div className="price-tabs" role="tablist" aria-label={copy.tierLabel}>{copy.tiers.map((tier, i) => <button key={tierIds[i]} type="button" role="tab" id={`price-tab-${tierIds[i]}`} aria-selected={selectedTier === i} aria-controls="price-coverage" tabIndex={selectedTier === i ? 0 : -1} onClick={() => setSelectedTier(i)} onKeyDown={event => selectWithKeyboard(event, i)}>{tier.name}</button>)}</div>
      <div className="price-coverage" id="price-coverage" role="tabpanel" tabIndex={0} aria-labelledby={`price-tab-${tierIds[selectedTier]}`}><div className="price-coverage-heading"><h3>{copy.tiers[selectedTier].name}</h3><strong><bdi>{prices[selectedTier]}DA</bdi></strong><span>{selectedTier === 2 ? copy.installments : copy.upfront}</span></div>
        <ul>{copy.coverageLabels.map((label, i) => { const included = selectedTier === 2 || (selectedTier === 1 && i < 3); const guidance = selectedTier === 0 && i === 2; return <li key={label}>{included || guidance ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}<div><h4>{label}</h4><p>{copy.coverage[selectedTier][i]}</p></div><span className={included || guidance ? 'price-covered' : ''}>{included ? copy.included : guidance ? copy.guidance : copy.notCovered}</span></li>; })}</ul><div className="price-coverage-action"><Inquiry copy={copy} tier={selectedTier} source="prices_coverage">{copy.request}</Inquiry><p>{copy.requestNote}</p></div>
      </div>
    </section>

    <section className="price-promises"><div className="price-container"><p className="price-eyebrow">{copy.promiseEyebrow}</p><h2>{copy.promiseTitle}</h2><p className="price-promise-intro">{copy.promiseIntro}</p><div className="price-promise-grid">{copy.promises.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div><p className="price-promise-note">{copy.promiseNote}</p></div></section>

    <section className="price-refund price-container"><SectionHeading title={copy.refundTitle} subtitle={copy.refundSubtitle} /><div className="price-refund-inner"><div className="price-accordions">{copy.refunds.map((item, i) => <details name="price-refunds" key={item.title} open={i === 0}><summary><Mark coral={i === 2} /><span>{item.title}</span><small className={i === 2 ? 'price-refund-warning' : ''}>{item.badge}</small><ChevronDown size={22} aria-hidden="true" /></summary><p>{item.body}</p></details>)}</div><div className="price-terms-note"><p>{copy.termsNote}</p><Link className="price-button price-button--outline" to={link('/terms')}>{copy.termsButton}</Link></div><div className="price-minor-note"><Mark /><p>{copy.minorNote}</p></div></div></section>

    <section className="price-faq price-pale"><div className="price-container"><SectionHeading title={copy.faqTitle} /><div className="price-accordions price-faq-inner">{copy.faqs.map((item, i) => <details name="price-faqs" key={item.q} open={i === 0}><summary><span>{item.q}</span><ChevronDown size={22} aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div></div></section>

    <section className="price-closing price-container" id="prices-contact"><img src="/assets/prices/logo-coral.png" alt="A-Step Immigration Space" width="3020" height="1021" loading="lazy" /><h2>{copy.closingTitle}</h2><p>{copy.closingBody}</p><div className="price-closing-actions"><Inquiry copy={copy} className="price-button--coral" source="prices_closing">{copy.request}</Inquiry><a className="price-button price-button--outline" href="mailto:contact@astepimmigration.space">{copy.email}</a></div><strong>{copy.closingNote}</strong></section>
  </div>;
}
