import { clsx } from 'clsx';
import logoSrc from '../assets/opensofalogo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'w-6 h-6', gap: 'gap-2', text: 'text-base' },
  md: { icon: 'w-8 h-8', gap: 'gap-2.5', text: 'text-lg' },
  lg: { icon: 'w-12 h-12', gap: 'gap-3', text: 'text-xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={clsx('flex items-center', config.gap, className)}>
      <img
        src={logoSrc}
        alt="OpenSofa Logo"
        className={clsx(config.icon, 'object-contain')}
        aria-hidden={!showText}
      />
      {showText && (
        <h1 className={clsx('font-semibold gradient-text', config.text)}>
          OpenSofa
        </h1>
      )}
    </div>
  );
}
