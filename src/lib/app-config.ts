import { supabaseAdmin } from "@/integrations/supabase/client.server";

let cache: Record<string, string | undefined> = {};
let loaded = false;

async function loadAll() {
  if (loaded) return;
  try {
    const { data } = await supabaseAdmin.from("app_config").select("key,value");
    if (data) {
      for (const row of data) {
        cache[row.key] = row.value || undefined;
      }
    }
  } catch {
    // table may not exist yet
  }
  loaded = true;
}

export async function getConfig(key: string): Promise<string | undefined> {
  await loadAll();
  return cache[key];
}

export function invalidateCache() {
  cache = {};
  loaded = false;
}
