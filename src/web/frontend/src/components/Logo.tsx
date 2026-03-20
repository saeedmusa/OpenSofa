import { clsx } from 'clsx';
import logoSrc from '../assets/opensofalogo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'w-8 h-8', gap: 'gap-2', text: 'text-base' },
  md: { icon: 'w-12 h-12', gap: 'gap-3', text: 'text-lg' },
  lg: { icon: 'w-20 h-20', gap: 'gap-4', text: 'text-2xl' },
  xl: { icon: 'w-32 h-32', gap: 'gap-4', text: 'text-3xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={clsx('flex flex-col items-center', size === 'xl' ? 'gap-4' : config.gap, className)}>
      <img
        src={logoSrc}
        alt="OpenSofa Logo"
        className={clsx(config.icon, 'object-contain drop-shadow-lg')}
        aria-hidden={!showText}
      />
      {showText && (
        <h1 className={clsx('font-bold gradient-text', config.text, size === 'xl' && 'tracking-wide')}>
          OpenSofa
        </h1>
      )}
    </div>
  );
}
