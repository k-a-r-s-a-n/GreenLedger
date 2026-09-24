export interface TelemetryData {
  timestamp: string;
  is_live: boolean;
  mode_label?: string;
  cpu_utilization: number;
  memory_usage: number;
  disk_io: number;
  network_latency: number | null;
  process_count: number;
  thread_count: number | null;
  context_switches: number | null;
  temperature: number | null;
  uptime: number;
  gpu_name?: string | null;
  gpu_utilization?: number | null;
  cpu_frequency?: number | null;
  cpu_per_core?: number[];
  memory_used_gb?: number | null;
  memory_total_gb?: number | null;
  disk_read_mbs?: number;
  disk_write_mbs?: number;
  network_throughput_kbs?: number;
  battery_percentage?: number | null;
  power_plugged?: boolean | null;
  power_meter_raw?: number | null;
  screen_brightness?: number | null;
  power_saver_active?: number | null;
  top_cpu_processes?: {
    pid: number;
    name: string;
    cpu_percent: number;
    memory_percent: number;
    threads?: number;
  }[];
  top_memory_processes?: {
    pid: number;
    name: string;
    cpu_percent: number;
    memory_percent: number;
    threads?: number;
  }[];
}

export interface PredictionResult {
  estimated_power_w: number;
  model_version: string;
  warnings: string[];
  inference_latency_ms: number;
  feature_contributions?: Record<string, number>;
  is_out_of_distribution?: boolean;
}

export interface OptimizationOpportunity {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  estimated_power_reduction_pct?: number | null;
  reversible: boolean;
  description: string;
  action_name: string;
  pid?: number;
  process_name?: string;
  cpu_percent?: number;
  memory_percent?: number;
}

export interface BeforeAfterResult {
  action_id: string;
  before_power_w: number;
  after_power_w: number;
  reduction_watts: number;
  reduction_pct: number;
  hourly_co2_saved_g: number;
  credits_awarded: number;
  new_credit_balance: number;
  streak_days: number;
  action_hash: string;
  unlocked_badge?: string | null;
}

export interface UserCreditState {
  user_id: string;
  credit_balance: number;
  lifetime_reduction_g_co2: number;
  lifetime_energy_saved_kwh: number;
  total_optimizations: number;
  current_streak_days: number;
  rank_title: string;
  recent_transactions: {
    tx_id: string;
    type: string;
    credits: number;
    description: string;
    timestamp: string;
    unlocked_badge?: string | null;
  }[];
}

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  credit_price: number;
  unlock_criteria: string;
  is_unlocked: boolean;
  token_id?: number;
  minted_on_chain?: boolean;
  tx_hash?: string | null;
}
