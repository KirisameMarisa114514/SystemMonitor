const apiMeta = document.querySelector('meta[name="api-base"]');

export const API_CONFIG = Object.freeze({
  baseUrl: (apiMeta?.content || "/api").replace(/\/$/, ""),
  timeoutMs: 8000,
  processLimit: 500,
  endpoints: Object.freeze({
    system: "/system",
    cpu: "/cpu",
    memory: "/memory",
    disks: "/disks",
    network: "/network",
    processes: "/processes",
  }),
});

export const THRESHOLDS = Object.freeze({
  cpu: Object.freeze({ warning: 70, critical: 85 }),
  memory: Object.freeze({ warning: 75, critical: 90 }),
  disk: Object.freeze({ warning: 80, critical: 90 }),
});

export const REFRESH_INTERVALS = Object.freeze([2000, 5000, 10000, 30000]);
export const DEFAULT_REFRESH_INTERVAL = 5000;

export const TIME_RANGES = Object.freeze({
  fiveMinutes: 5 * 60 * 1000,
  fifteenMinutes: 15 * 60 * 1000,
  oneHour: 60 * 60 * 1000,
});

// One hour at the fastest supported two-second interval is 1,800 samples.
// A small buffer prevents trimming at the exact range boundary.
export const MAX_HISTORY_POINTS = 1900;
export const MAX_HISTORY_AGE = 65 * 60 * 1000;

export const THEME_STORAGE_KEY = "monitor-theme";
