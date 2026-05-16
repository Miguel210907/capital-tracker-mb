import { getDashboardSummary } from '../services/dashboardService';
import { useRefreshable } from './useRefreshable';

export function useDashboard() {
  return useRefreshable(getDashboardSummary, []);
}
