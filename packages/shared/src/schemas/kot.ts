export type KotOrder = {
  id: string;
  created_at: string;
  placed_by: string | null;
  status: string;
  total_inr: number;
  session: { table: { label: string } | null } | null;
  items: { name: string; qty: number; notes: string | null; status: string }[];
};
