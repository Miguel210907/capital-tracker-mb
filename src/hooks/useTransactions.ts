import { listTransactions } from '../services/transactionService';
import { useRefreshable } from './useRefreshable';

export function useTransactions() {
  return useRefreshable(() => listTransactions(), []);
}
