import { listAccounts } from '../services/accountService';
import { useRefreshable } from './useRefreshable';

export function useAccounts() {
  return useRefreshable(() => listAccounts(), []);
}
