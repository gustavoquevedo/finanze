import type { Repository } from "@/lib/data";
import { todayIso } from "@/lib/domain/dates";
import { valueAsset, type AssetValuation } from "@/lib/domain/investments";

/** Everything the investment pages need, valued today. */
export async function loadInvestments(repo: Repository, date: string = todayIso()) {
  const [assetTypes, assets, snapshots, properties, recurrings, portfolios] = await Promise.all([
    repo.listAssetTypes(),
    repo.listAssets(),
    repo.listAssetSnapshots(),
    repo.listProperties(),
    repo.listRecurrings(),
    repo.listPortfolios(),
  ]);
  const ctx = { snapshots, properties, recurrings, date };
  const valuations = new Map<string, AssetValuation>(assets.map((a) => [a.id, valueAsset(a, ctx)]));
  return { assetTypes, assets, snapshots, properties, recurrings, portfolios, valuations, date };
}
