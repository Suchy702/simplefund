import polishEagleUrl from '@/assets/polish-eagle.svg'

interface PolishEagleIconProps {
  size?: number
  className?: string
}

// Uses the generated crowned eagle SVG and inherits the surrounding application color.
export const PolishEagleIcon = ({
  size = 16,
  className,
}: PolishEagleIconProps) => (
  <span
    aria-hidden="true"
    className={className}
    style={{
      display: 'inline-block',
      flexShrink: 0,
      width: size,
      height: size,
      backgroundColor: 'currentColor',
      maskImage: `url(${polishEagleUrl})`,
      maskSize: 'contain',
      maskPosition: 'center',
      maskRepeat: 'no-repeat',
      WebkitMaskImage: `url(${polishEagleUrl})`,
      WebkitMaskSize: 'contain',
      WebkitMaskPosition: 'center',
      WebkitMaskRepeat: 'no-repeat',
    }}
  />
)
