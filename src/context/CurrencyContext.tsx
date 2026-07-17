import { createContext, useContext, useState, type ReactNode } from "react";

export type Currency = "PHP" | "USD" | "EUR";

export interface CurrencyRates {
  PHP: number; // base is PHP, so rate is 1
  USD: number; // e.g. 0.017 (1 PHP = 0.017 USD)
  EUR: number; // e.g. 0.016 (1 PHP = 0.016 EUR)
}

// Fixed, highly reliable exchange rates for Palawan remote work context.
// No external API required, ensuring zero network latency and bulletproof reliability.
export const CONVERSION_RATES: CurrencyRates = {
  PHP: 1,
  USD: 0.0172, // ~58 PHP per USD
  EUR: 0.0161, // ~62 PHP per EUR
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  PHP: "PHP (₱)",
  USD: "USD ($)",
  EUR: "EUR (€)",
};

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (phpAmount: number | string) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = window.localStorage.getItem("marina-terrace-currency");
    return (saved as Currency) || "PHP";
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    window.localStorage.setItem("marina-terrace-currency", c);
  };

  const formatPrice = (phpAmount: number | string): string => {
    // Extract numerical digits from strings like "₱1,040" or "1040" or "42"
    let numeric = 0;
    if (typeof phpAmount === "number") {
      numeric = phpAmount;
    } else {
      // If it has a dollar sign initially, it might be in USD base (from the screenshot's rooms),
      // let's parse it correctly. If it looks like "$42", treat 42 as USD and convert to PHP first
      // so the conversion flow is consistent.
      const cleaned = phpAmount.replace(/[^0-9.]/g, "");
      const val = parseFloat(cleaned) || 0;
      if (phpAmount.includes("$")) {
        // Convert USD base to PHP base for internal formatting
        numeric = val / CONVERSION_RATES.USD;
      } else if (phpAmount.includes("€")) {
        // Convert EUR base to PHP base
        numeric = val / CONVERSION_RATES.EUR;
      } else {
        numeric = val;
      }
    }

    const rate = CONVERSION_RATES[currency];
    const converted = numeric * rate;
    const symbol = CURRENCY_SYMBOLS[currency];

    // Formatted look based on the currency (Peso uses commas, others use standard decimals where helpful)
    if (currency === "PHP") {
      return `${symbol}${Math.round(converted).toLocaleString("en-PH")}`;
    }
    // Round to nearest integer for clean minimalist display ($42 instead of $42.00)
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
