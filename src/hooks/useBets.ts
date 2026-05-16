import { listBets } from '../services/bettingService';
import { useRefreshable } from './useRefreshable';

export function useBets() {
  return useRefreshable(() => listBets(), []);
}
