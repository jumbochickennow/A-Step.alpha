import { Link } from 'react-router-dom';
import { useLocale, localizedPath } from '../../hooks/useLocale';

export function Brand({ light = false }: { light?: boolean }) {
  const { locale } = useLocale();
  return (
    <Link to={localizedPath('/', locale)} aria-label="A-Step Immigration Space" className="inline-flex min-h-11 items-center">
      <img
        src={light ? '/assets/logo/logo-white.png' : '/assets/logo/logo-blue.png'}
        width="3020"
        height="1021"
        alt="A-Step Immigration Space"
        loading={light ? 'lazy' : 'eager'}
        decoding="async"
        className="aspect-[3020/1021] h-auto w-[92px] object-contain xs:w-[116px] sm:w-[132px]"
      />
    </Link>
  );
}
