import { MAX_HISTORY_AGE, MAX_HISTORY_POINTS } from "./config.js";
import { toFiniteNumber } from "./utils.js";

export class TimeSeriesQueue {
  constructor({ maxPoints = MAX_HISTORY_POINTS, maxAge = MAX_HISTORY_AGE } = {}) {
    this.maxPoints = maxPoints;
    this.maxAge = maxAge;
    this.samples = [];
  }

  push(sample) {
    if (!sample || !Number.isFinite(sample.time)) return;
    this.samples.push(sample);
    const cutoff = sample.time - this.maxAge;
    while (this.samples.length && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
    if (this.samples.length > this.maxPoints) {
      this.samples.splice(0, this.samples.length - this.maxPoints);
    }
  }

  within(rangeMs, now = Date.now()) {
    const cutoff = now - rangeMs;
    return this.samples.filter((sample) => sample.time >= cutoff);
  }

  clear() {
    this.samples.length = 0;
  }
}

export class NetworkRateCalculator {
  constructor() {
    this.previous = null;
  }

  calculate(sample) {
    const now = (toFiniteNumber(sample?.sampleTime) || Date.now() / 1000) * 1000;
    const sent = toFiniteNumber(sample?.bytesSent);
    const received = toFiniteNumber(sample?.bytesReceived);
    const apiUploadRate = toFiniteNumber(sample?.uploadRate);
    const apiDownloadRate = toFiniteNumber(sample?.downloadRate);

    let uploadRate = apiUploadRate ?? 0;
    let downloadRate = apiDownloadRate ?? 0;
    let derived = false;

    /*
     * Compatibility for older APIs that expose cumulative byte counters only:
     * rate = (current counter - previous counter) / elapsed seconds.
     * The first sample cannot yield a rate. Negative deltas indicate a counter
     * reset (for example after reboot) and are intentionally treated as zero.
     */
    const hadBaseline = Boolean(this.previous);
    if (this.previous && sent !== null && received !== null) {
      const elapsedSeconds = (now - this.previous.time) / 1000;
      const sentDelta = sent - this.previous.sent;
      const receivedDelta = received - this.previous.received;
      if (elapsedSeconds > 0 && sentDelta >= 0 && receivedDelta >= 0) {
        uploadRate = sentDelta / elapsedSeconds;
        downloadRate = receivedDelta / elapsedSeconds;
        derived = true;
      } else if (sentDelta < 0 || receivedDelta < 0) {
        uploadRate = 0;
        downloadRate = 0;
      }
    }

    if (sent !== null && received !== null) {
      this.previous = { time: now, sent, received };
    }

    return {
      time: now,
      uploadRate: Math.max(toFiniteNumber(uploadRate, 0), 0),
      downloadRate: Math.max(toFiniteNumber(downloadRate, 0), 0),
      bytesSent: sent,
      bytesReceived: received,
      derived,
      hasBaseline: hadBaseline,
    };
  }

  reset() {
    this.previous = null;
  }
}
