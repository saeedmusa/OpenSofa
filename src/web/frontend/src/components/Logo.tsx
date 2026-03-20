import { clsx } from 'clsx';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { text: 'text-sm' },
  md: { text: 'text-base' },
  lg: { text: 'text-xl' },
  xl: { text: 'text-2xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={clsx('flex items-center', className)}>
      {showText && (
        <span className={clsx('font-mono font-bold tracking-tight select-none', config.text)}>
          <span className="text-matrix-green">O</span>
          <span className="text-neon-red">S</span>
          <span className="text-cyan-accent">penofa</span>
        </span>
      )}
    </div>
  );
}
