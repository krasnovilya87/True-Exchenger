
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export interface ExchangeRecord {
  id: string;
  date: string;
  currencyPair: string;
  amountFrom: number;
  amountTo: number;
  rate: number;
  cbRateAtTime: number;
}
