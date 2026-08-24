const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatUsd(amount: number): string {
  return usd.format(amount);
}

export function formatUsdRange([low, high]: readonly [number, number]): string {
  if (low === high) return formatUsd(low);
  return `${formatUsd(low)} – ${formatUsd(high)}`;
}
