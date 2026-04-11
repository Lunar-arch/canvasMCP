import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppData, getDefaultData } from "./types.js";

let _client: SupabaseClient | null = null;
let _userId: string | null = null;

async function getAuthedClient(): Promise<{ client: SupabaseClient; userId: string }> {
  if (_client && _userId) return { client: _client, userId: _userId };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.STUDYFLOW_EMAIL;
  const password = process.env.STUDYFLOW_PASSWORD;

  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!email || !password) throw new Error("Missing STUDYFLOW_EMAIL or STUDYFLOW_PASSWORD");

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Sign-in failed: ${error?.message ?? "no user returned"}`);

  _client = client;
  _userId = data.user.id;

  return { client: _client, userId: _userId };
}

export async function readData(): Promise<AppData> {
  const { client, userId } = await getAuthedClient();

  const { data: row, error } = await client
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Supabase read error: ${error.message}`);
  }

  if (!row?.data) return getDefaultData();

  const defaults = getDefaultData();
  const cloud = row.data as Partial<AppData>;
  return {
    ...defaults,
    ...cloud,
    taskRules: cloud.taskRules ?? [],
    settings: { ...defaults.settings, ...(cloud.settings ?? {}) },
  };
}

export async function writeData(data: AppData): Promise<void> {
  const { client, userId } = await getAuthedClient();

  const { error } = await client.from("user_data").upsert(
    { user_id: userId, data, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Supabase write error: ${error.message}`);
}

/** Read, mutate, write — returns the mutated data. */
export async function mutate(fn: (d: AppData) => AppData): Promise<AppData> {
  const data = await readData();
  const next = fn(data);
  await writeData(next);
  return next;
}
