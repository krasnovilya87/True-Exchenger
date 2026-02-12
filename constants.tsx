
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
  'USD/RUB': 91.50,
  'USD/IDR': 16200.00,
  'RUB/IDR': 210.00,
  'IDR/RUB': 0.0047,
  'USD/THB': 34.50,
  'USD/TRY': 34.20,
  'USD/GEL': 2.72,
  'EUR/USD': 1.09,
};
