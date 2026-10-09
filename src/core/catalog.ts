import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// SELLIFY CORE (STAND-IN): the global device catalog. Same for every shop
// and changes only with a migration, so it is cached across users.

export type CatalogModel = { id: number; name: string; storageOptions: number[] };
export type CatalogBrand = { id: number; name: string; models: CatalogModel[] };
export type RepairType = { id: number; name: string; slug: string };
export type Catalog = {
  brands: CatalogBrand[];
  repairTypes: RepairType[];
  /** model id → "Apple iPhone 12" */
  modelLabels: Record<number, string>;
};

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");

  const supabase = createPublicClient();
  const [brands, models, repairTypes] = await Promise.all([
    supabase.from("device_brands").select("id, name").order("sort_order"),
    supabase.from("device_models").select("id, brand_id, name, storage_options").order("sort_order"),
    supabase.from("repair_types").select("id, name, slug").order("sort_order"),
  ]);
  const error = brands.error ?? models.error ?? repairTypes.error;
  if (error) throw new Error(`Could not load the device catalog: ${error.message}`);

  const modelLabels: Record<number, string> = {};
  const result: CatalogBrand[] = (brands.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    models: (models.data ?? [])
      .filter((m) => m.brand_id === b.id)
      .map((m) => {
        modelLabels[m.id] = `${b.name} ${m.name}`;
        return { id: m.id, name: m.name, storageOptions: m.storage_options };
      }),
  }));

  return { brands: result, repairTypes: repairTypes.data ?? [], modelLabels };
}

export function storageLabel(gb: number): string {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}
