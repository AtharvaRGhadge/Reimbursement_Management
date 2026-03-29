import axios from 'axios';

const cache = new Map();
const TTL_MS = 1000 * 60 * 30;

export async function fetchCountries() {
  const { data } = await axios.get(
    'https://restcountries.com/v3.1/all?fields=name,currencies,cca2',
    { timeout: 20000 }
  );
  return data.map((c) => {
    const cur = c.currencies ? Object.entries(c.currencies)[0] : null;
    return {
      name: c.name?.common || '',
      countryCode: c.cca2,
      currencyCode: cur ? cur[0] : 'USD',
      currencySymbol: cur ? cur[1].symbol : '$',
      currencyName: cur ? cur[1].name : 'US Dollar',
    };
  });
}

export async function getExchangeRate(base, target) {
  const b = base.toUpperCase();
  const t = target.toUpperCase();
  if (b === t) return 1;
  const key = b;
  const now = Date.now();
  let entry = cache.get(key);
  if (!entry || now - entry.at > TTL_MS) {
    const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${b}`, {
      timeout: 15000,
    });
    entry = { at: now, rates: data.rates };
    cache.set(key, entry);
  }
  const rate = entry.rates[t];
  if (rate == null) throw new Error(`No rate for ${t}`);
  return rate;
}

export async function convertToCurrency(amount, fromCurrency, toCurrency) {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return { amount: Math.round(amount * rate * 100) / 100, rate };
}
