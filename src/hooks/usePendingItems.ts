import { listPendingItems } from '../services/pendingService';
import { useRefreshable } from './useRefreshable';

export function usePendingItems() {
  return useRefreshable(() => listPendingItems());
}
