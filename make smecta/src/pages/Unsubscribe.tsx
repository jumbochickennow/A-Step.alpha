import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Seo } from '../components/common/Seo';
import { unsubscribeNewsletter } from '../services/email.service';

export function Unsubscribe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const token = params.get('token') ?? '';
  const submit = async () => {
    setStatus('loading');
    try { await unsubscribeNewsletter(token); setStatus('success'); } catch { setStatus('error'); }
  };
  return (
    <section className="container-shell flex min-h-[65svh] items-center justify-center py-16 text-center">
      <Seo title={t('unsubscribe.metaTitle')} description={t('unsubscribe.body')} noindex />
      <div className="card max-w-xl p-8">
        <h1 className="page-title">{t('unsubscribe.title')}</h1>
        <p className="mt-4 leading-relaxed text-ink-muted">{t('unsubscribe.body')}</p>
        {status === 'success' ? <p className="mt-6 text-[var(--success)]" role="status">{t('unsubscribe.success')}</p> : <><Button className="mt-6" disabled={!token || status === 'loading'} onClick={() => void submit()}>{t('unsubscribe.submit')}</Button>{(status === 'error' || !token) ? <p className="mt-5 text-[var(--danger)]" role="alert">{t('unsubscribe.error')}</p> : null}</>}
      </div>
    </section>
  );
}
