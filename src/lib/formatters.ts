import { parseStoredDateToLocal } from './stored-date';

export const formatDisplayDate = (value: Date | string): string => {
  const date = typeof value === 'string' ? parseStoredDateToLocal(value) : value;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatCurrencyINR = (amount: number): string => {
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
};

export const formatDateForFilename = (value: Date | string): string => {
  const date = typeof value === 'string' ? parseStoredDateToLocal(value) : value;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

