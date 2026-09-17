import type { Query } from "../../types/domain";
import type { FunnelDataset } from "../../types/funnel";
import { getFunnelDataset } from "../../data/mock/funnel-repository";

// Additive connector: phase-one Source/Analytics/Retargeting/Ads contracts stay intact.
export interface FunnelConnector { getDataset(query: Query): Promise<FunnelDataset> }
export class MockFunnelConnector implements FunnelConnector {
  async getDataset(query: Query) { return getFunnelDataset(query); }
}
export const mockFunnelConnector: FunnelConnector = new MockFunnelConnector();
