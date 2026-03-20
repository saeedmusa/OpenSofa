import { clsx } from 'clsx';
import logoSrc from '../assets/opensofalogo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'w-8 h-8', gap: 'gap-2', text: 'text-sm' },
  md: { icon: 'w-10 h-10', gap: 'gap-3', text: 'text-base' },
  lg: { icon: 'w-16 h-16', gap: 'gap-4', text: 'text-xl' },
  xl: { icon: 'w-24 h-24', gap: 'gap-4', text: 'text-2xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={clsx('flex items-center', config.gap, className)}>
      <img
        src={logoSrc}
        alt="OpenSofa"
        className={clsx(config.icon, 'object-contain')}
        aria-hidden={!showText}
      />
      {showText && (
        <span className={clsx('font-mono font-bold text-[#00FF41] tracking-tight', config.text)}>
          OPENSOFA
        </span>
      )}
    </div>
  );
}
