import { selectConnectivityReport, selectLogisticsReport } from '@/model/staff/connectivity';
import type { Snapshot } from '../store';

export function selectConnectivityWarnings(snapshot: Snapshot): string[] {
  return selectLogisticsReport(snapshot.game).warnings;
}

export function selectLogisticsWarnings(snapshot: Snapshot): string[] {
  return selectLogisticsReport(snapshot.game).warnings;
}

export { selectConnectivityReport, selectLogisticsReport };
