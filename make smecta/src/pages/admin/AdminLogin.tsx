import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Seo } from '../../components/common/Seo';
import { Brand } from '../../components/layout/Brand';
import { signInAdmin } from '../../services/admin.service';
import { ApiError } from '../../services/api-client';

export function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [passkey, setPasskey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      await signInAdmin(passkey);
      navigate('/astep-control-vault/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('admin.error'));
    } finally { setLoading(false); }
  };
  return (
    <main className="container-shell flex min-h-screen items-center justify-center py-16">
      <Seo title={t('admin.metaTitle')} description={t('admin.loginBody')} noindex />
      <div className="w-full max-w-md">
        <Brand />
        <form onSubmit={submit} className="card mt-8 p-6 md:p-8">
          <h1 className="page-title">{t('admin.loginTitle')}</h1>
          <p className="mt-3 leading-relaxed text-ink-muted">{t('admin.loginBody')}</p>
          <label htmlFor="admin-passkey" className="mt-6 block text-sm font-semibold">{t('admin.passkey')}</label>
          <input
            id="admin-passkey"
            type="password"
            className="field mt-2"
            placeholder={t('admin.passkeyPlaceholder')}
            autoComplete="current-password"
            required
            maxLength={256}
            value={passkey}
            onChange={(event) => setPasskey(event.target.value)}
          />
          {error ? <p role="alert" className="mt-5 text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="submit" disabled={loading} className="mt-6 w-full">{loading ? t('admin.signingIn') : t('admin.signIn')}</Button>
        </form>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-brand-blue-text">← {t('admin.back')}</Link>
      </div>
    </main>
  );
}
