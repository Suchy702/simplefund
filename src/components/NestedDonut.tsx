interface Segment {
  pct: number;
  color: string;
}

interface NestedDonutProps {
  outer: Segment[];
  inner: Segment[];
  size?: number;
  outerThickness?: number;
  innerThickness?: number;
  gap?: number;
}

export function NestedDonut({
  outer,
  inner,
  size = 220,
  outerThickness = 22,
  innerThickness = 16,
  gap = 4,
}: NestedDonutProps) {
  const rOuter = (size - outerThickness) / 2;
  const rInner = (size - 2 * outerThickness - 2 * gap - innerThickness) / 2;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  let oOff = 0;
  let iOff = 0;
  const outerSegs = outer.map((d, i) => {
    const len = (d.pct / 100) * cOuter;
    const seg = (
      <circle
        key={`o-${i}`}
        cx={size / 2}
        cy={size / 2}
        r={rOuter}
        fill="none"
        stroke={d.color}
        strokeWidth={outerThickness}
        strokeDasharray={`${len} ${cOuter - len}`}
        strokeDashoffset={-oOff}
      />
    );
    oOff += len;
    return seg;
  });
  const innerSegs = inner.map((d, i) => {
    const len = (d.pct / 100) * cInner;
    const seg = (
      <circle
        key={`i-${i}`}
        cx={size / 2}
        cy={size / 2}
        r={rInner}
        fill="none"
        stroke={d.color}
        strokeWidth={innerThickness}
        strokeDasharray={`${len} ${cInner - len}`}
        strokeDashoffset={-iOff}
      />
    );
    iOff += len;
    return seg;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {outerSegs}
      {innerSegs}
    </svg>
  );
}
