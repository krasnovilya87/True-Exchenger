
import { Currency } from './types';

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', flag: '🇬🇪' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
];

export const MOCK_CB_RATES: Record<string, number> = {
  'USD/RUB': 92.45,
  'USD/IDR': 15840.00,
  'RUB/IDR': 171.30,
  'USD/THB': 35.80,
  'USD/TRY': 32.10,
  'USD/GEL': 2.68,
  'EUR/USD': 1.08,
};
