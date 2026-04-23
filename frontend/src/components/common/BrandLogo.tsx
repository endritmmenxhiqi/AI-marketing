import logoMark from '../../assets/logo-mark-ui-1.png';

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export default function BrandLogo({ className = '', alt = 'Brand logo' }: BrandLogoProps) {
  const sizeClassName = className.trim() || 'h-14 w-14';

  return (
    <img
      src={logoMark}
      alt={alt}
      className={`${sizeClassName} rounded-lg object-contain`}
    />
  );
}
