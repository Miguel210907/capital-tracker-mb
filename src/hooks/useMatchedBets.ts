import { listMatchedBets } from '../services/matchedBettingService';
import { useRefreshable } from './useRefreshable';

export function useMatchedBets() {
  return useRefreshable(() => listMatchedBets(), []);
}
