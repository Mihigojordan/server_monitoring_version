// Canonical metric_name values written by the seed generator and read by
// FeaturesService — kept in one place so the two never drift apart.
export const METRIC = {
  CPU_UTILIZATION_PCT: "cpu_utilization_pct",
  CPU_TEMPERATURE_C: "cpu_temperature_c",
  CPU_FREQUENCY_MHZ: "cpu_frequency_mhz",
  CPU_LOAD_1M: "cpu_load_1m",
  RAM_UTILIZATION_PCT: "ram_utilization_pct",
  RAM_USED_GB: "ram_used_gb",
  SWAP_UTILIZATION_PCT: "swap_utilization_pct",
  DISK_UTILIZATION_PCT: "disk_utilization_pct",
  DISK_READ_IOPS: "disk_read_iops",
  DISK_WRITE_IOPS: "disk_write_iops",
  DISK_READ_THROUGHPUT_MBPS: "disk_read_throughput_mbps",
  DISK_WRITE_THROUGHPUT_MBPS: "disk_write_throughput_mbps",
  NETWORK_RX_MBPS: "network_rx_mbps",
  NETWORK_TX_MBPS: "network_tx_mbps",
  NETWORK_ERRORS: "network_errors",
  PROCESS_COUNT: "process_count",
  UPTIME_HOURS: "uptime_hours",
  FAN_SPEED_RPM: "fan_speed_rpm",
  POWER_CONSUMPTION_W: "power_consumption_w",
  ECC_MEMORY_ERRORS: "ecc_memory_errors",

  STORAGE_USAGE_PCT: "storage_usage_pct",
  STORAGE_READ_IOPS: "storage_read_iops",
  STORAGE_WRITE_IOPS: "storage_write_iops",
  STORAGE_READ_LATENCY_MS: "storage_read_latency_ms",
  STORAGE_WRITE_LATENCY_MS: "storage_write_latency_ms",
  STORAGE_QUEUE_DEPTH: "storage_queue_depth",
  STORAGE_TEMPERATURE_C: "storage_temperature_c",
  STORAGE_REALLOCATED_SECTORS: "storage_reallocated_sectors",
  STORAGE_PENDING_SECTORS: "storage_pending_sectors",
  STORAGE_SSD_WEAR_PCT: "storage_ssd_wear_pct",

  BANDWIDTH_UTILIZATION_PCT: "bandwidth_utilization_pct",
  PACKET_LOSS_PCT: "packet_loss_pct",
  CRC_ERRORS: "crc_errors",
  PORT_ERRORS: "port_errors",
  SWITCH_CPU_PCT: "switch_cpu_pct",
  SWITCH_TEMPERATURE_C: "switch_temperature_c",
  POE_CONSUMPTION_W: "poe_consumption_w",

  ROUTER_CPU_PCT: "router_cpu_pct",
  FIREWALL_ACTIVE_SESSIONS: "firewall_active_sessions",
  FIREWALL_BLOCKED_TRAFFIC_PCT: "firewall_blocked_traffic_pct",
  LB_REQUESTS_PER_SEC: "lb_requests_per_sec",
  LB_RESPONSE_TIME_MS: "lb_response_time_ms",

  UPS_BATTERY_PCT: "ups_battery_pct",
  UPS_LOAD_PCT: "ups_load_pct",
  UPS_BATTERY_TEMPERATURE_C: "ups_battery_temperature_c",
  UPS_RUNTIME_MINUTES: "ups_runtime_minutes",
  PDU_LOAD_PCT: "pdu_load_pct",
  VOLTAGE_V: "voltage_v",

  ROOM_TEMPERATURE_C: "room_temperature_c",
  RACK_TEMPERATURE_C: "rack_temperature_c",
  HUMIDITY_PCT: "humidity_pct",
  AIRFLOW_CFM: "airflow_cfm",

  APP_REQUESTS_PER_SEC: "app_requests_per_sec",
  APP_RESPONSE_TIME_MS: "app_response_time_ms",
  APP_ERROR_RATE_PCT: "app_error_rate_pct",
  APP_RESTART_COUNT: "app_restart_count",

  DB_QUERY_LATENCY_MS: "db_query_latency_ms",
  DB_SLOW_QUERIES: "db_slow_queries",
  DB_ACTIVE_CONNECTIONS: "db_active_connections",
  DB_CACHE_HIT_RATIO_PCT: "db_cache_hit_ratio_pct",
  DB_REPLICATION_LAG_S: "db_replication_lag_s",
  DB_SIZE_GB: "db_size_gb",

  // Generic, cross-domain aliases FeaturesService reads for its named
  // feature columns — each asset type maps its own primary metric onto
  // these at seed time (e.g. a server's cpu_utilization_pct also gets
  // mirrored as GENERIC_UTILIZATION so features work uniformly).
  GENERIC_TEMPERATURE_C: "temperature_c",
  GENERIC_ERROR_RATE_PCT: "error_rate_pct",
} as const;
