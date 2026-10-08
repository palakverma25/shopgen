import type { Money, SelectedOption } from "../types.js";

const SYMBOLS: Record<string, string> = {
  CAD: "CA$",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  JPY: "¥"
};

export function formatMoney(money: Money): string {
  const amount = Number(money.amount);
  const symbol = SYMBOLS[money.currencyCode] ?? `${money.currencyCode} `;
  if (Number.isNaN(amount)) {
    return `${symbol}${money.amount}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

export function unitMoney(unit: Money | undefined, lineTotal: Money, quantity: number): Money {
  if (unit) return unit;
  const qty = quantity > 0 ? quantity : 1;
  const total = Number(lineTotal.amount);
  if (Number.isNaN(total)) return lineTotal;
  return { amount: (total / qty).toFixed(2), currencyCode: lineTotal.currencyCode };
}

export function moneyAmount(money: Money): number {
  const amount = Number(money.amount);
  return Number.isNaN(amount) ? 0 : amount;
}

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function optionValue(options: SelectedOption[], name: string): string | null {
  const match = options.find((option) => normalize(option.name) === normalize(name));
  return match?.value ?? null;
}

export function normalizeSize(value: string): string {
  const compact = normalize(value).replace(/\s+/g, "");
  const aliases: Record<string, string> = {
    s: "small",
    sm: "small",
    m: "medium",
    md: "medium",
    med: "medium",
    l: "large",
    lg: "large",
    xl: "x-large",
    xlarge: "x-large",
    "x-large": "x-large",
    xxl: "xx-large",
    xxlarge: "xx-large"
  };
  return aliases[compact] ?? compact;
}

export function sameSize(left: string, right: string): boolean {
  return normalizeSize(left) === normalizeSize(right);
}

export function sameLabel(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

export function redactCartId(cartId: string): string {
  return cartId.replace(/(\?|&)key=[^&]+/i, "$1key=REDACTED");
}

export function optionNames(options: { name: string; values: string[] }[]): string {
  return options
    .map((option) => `${option.name}: ${option.values.join(", ")}`)
    .join("; ");
}
