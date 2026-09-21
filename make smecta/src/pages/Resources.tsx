import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/common/Seo';
import { localizedPath, useLocale } from '../hooks/useLocale';
import { resourcesCopy } from './resources/copy';
import '../styles/resources.css';
import { useResources } from '../hooks/useResources';
import { emptyResourcesCopy } from './resources/copy';

export function Resources() {
  const { locale } = useLocale();
  const copy = resourcesCopy[locale];
  const empty = emptyResourcesCopy[locale];
  const { items, loading } = useResources();
  return (
    <div className="resources-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Seo title={copy.title} description={copy.description} noindex />
      {loading ? <div className="resources-container resources-loading" role="status">{empty.loading}</div> : items.length === 0 ? <section className="resources-container resources-empty" aria-labelledby="resources-empty-title">
        <div><h1 id="resources-empty-title">{empty.title}</h1><p>{empty.body}</p><div className="resources-empty-actions"><Link className="resources-prices" to={localizedPath('/opportunities', locale)}>{empty.opportunities}</Link><Link className="resources-prices" to={localizedPath('/guides', locale)}>{empty.guides}</Link></div></div>
        <img src="/assets/resources/empty-construction.webp" alt="" width="680" height="470" />
      </section> : <><section className="resources-container resources-featured" aria-labelledby="resources-title">
        <h1 id="resources-title"><span className="resources-star" aria-hidden="true">★</span>{copy.title}</h1>
        <div className="resources-grid">
          {items.map((item, index) => {
            const event = item.translations[locale];
            return <article className={`resource-card${item.featured ? ' resource-card--featured' : ''}`} key={item.id} aria-labelledby={`resource-title-${index}`} style={{ animationDelay: `${Math.min(index, 4) * 70}ms` }}>
              <div className="resource-card-content">
                <h2 id={`resource-title-${index}`}>{event.title}</h2>
                <p>{event.description}</p>
                <div className="resource-card-actions">
                  <a className="resource-register" href={item.applyUrl || undefined} target="_blank" rel="noopener noreferrer" aria-label={`${copy.register}: ${event.title} (${copy.newTab})`}>{copy.register}<ArrowRight size={17} aria-hidden="true" /></a>
                  <span className="resource-deadline">{copy.closing} <time dateTime={item.deadline || undefined}>{new Intl.DateTimeFormat(locale, { day:'numeric', month:'long', year:'numeric', timeZone:'Africa/Algiers' }).format(new Date(`${item.deadline}T12:00:00Z`))}</time></span>
                </div>
              </div>
              {item.imagePath && <div className="resource-logo"><img src={item.imagePath} alt="" width="430" height="430" /></div>}
            </article>;
          })}
        </div>
      </section>
      <section className="resources-container resources-journey" aria-labelledby="resources-journey-title">
        <div>
          <h2 id="resources-journey-title">{copy.journey[0]}<br />{copy.journey[1]}</h2>
          <p>{copy.journeyBody}</p>
          <ul>{copy.benefits.map(benefit => <li key={benefit}><Check size={17} aria-hidden="true" />{benefit}</li>)}</ul>
          <Link className="resources-prices" to={localizedPath('/prices', locale)}>{copy.explore}</Link>
        </div>
        <img className="resources-calendar" src="/assets/resources/journey-calendar.webp" alt="" width="670" height="640" loading="lazy" />
      </section></>}
    </div>
  );
}
