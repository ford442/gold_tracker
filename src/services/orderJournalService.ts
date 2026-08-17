import { supabase, isSupabaseConfigured } from '@lib/supabase';
import {
  dbRowToOrderRecord,
  orderRecordToDbRow,
  type DbOrderJournalRow,
} from '@lib/orderSync';
import type { OrderRecord } from '@lib/orderLifecycle';

export const orderJournalService = {
  /**
   * Fetches the user's order history from the durable Postgres order_journal table.
   */
  async fetchUserOrders(userId: string, limit = 200): Promise<OrderRecord[]> {
    if (!isSupabaseConfigured || !userId) return [];
    try {
      const { data, error } = await supabase
        .from<DbOrderJournalRow>('order_journal')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[OrderJournalService] fetch failed:', error.message);
        return [];
      }
      if (!data || !Array.isArray(data)) return [];
      return data.map(dbRowToOrderRecord);
    } catch (err) {
      console.warn('[OrderJournalService] fetch exception:', err);
      return [];
    }
  },

  /**
   * Upserts a single order record into the durable order_journal table.
   * Idempotent by (user_id, client_order_id).
   */
  async upsertOrder(record: OrderRecord, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId || !record.clientOrderId) return false;
    try {
      const row = orderRecordToDbRow(record, userId);
      const { error } = await supabase
        .from('order_journal')
        .upsert(row, { onConflict: 'user_id,client_order_id' });

      if (error) {
        console.warn('[OrderJournalService] upsert failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[OrderJournalService] upsert exception:', err);
      return false;
    }
  },

  /**
   * Batch upserts multiple order records into the durable order_journal table.
   */
  async upsertOrders(records: OrderRecord[], userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId || records.length === 0) return false;
    try {
      const rows = records
        .filter((r) => Boolean(r.clientOrderId))
        .map((r) => orderRecordToDbRow(r, userId));

      if (rows.length === 0) return false;

      const { error } = await supabase
        .from('order_journal')
        .upsert(rows, { onConflict: 'user_id,client_order_id' });

      if (error) {
        console.warn('[OrderJournalService] batch upsert failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[OrderJournalService] batch upsert exception:', err);
      return false;
    }
  },
};
