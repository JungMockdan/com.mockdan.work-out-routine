import { LocalRepository } from './local';
import { SupabaseRepository } from './supabase';
import type { Repository } from './types';

export type { Repository } from './types';

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

let instance: Repository | null = null;

/** 환경에 따라 저장소 구현을 고른다. 클라이언트에서만 호출할 것. */
export function getRepository(): Repository {
  if (instance) return instance;
  instance = isSupabaseConfigured() ? new SupabaseRepository() : new LocalRepository();
  return instance;
}
