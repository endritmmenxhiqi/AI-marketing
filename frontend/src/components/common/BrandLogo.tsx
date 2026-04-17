import logoMark from '../../assets/logo-mark-ui.png';

type BrandLogoProps = {
  className?: string;
  darkMode?: boolean;
};

export default function BrandLogo({ className = '', darkMode }: BrandLogoProps) {
  const sizeClassName = className.trim() || 'h-14 w-14';

  return (
    <img
      src={logoMark}
      alt="Brand logo"
      className={`${sizeClassName} rounded-lg object-cover`}
    />
  );
}
