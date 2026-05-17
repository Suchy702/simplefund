interface TickerBadgeProps {
  ticker: string;
  color: string;
}

export function TickerBadge({ ticker, color }: TickerBadgeProps) {
  const initials = ticker.slice(0, 4);
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-tiny font-semibold text-primary-foreground"
      style={{ background: color }}
    >
      {initials}
    </span>
  );
}
