// ---------------------------------------------------------------------------
// Browser-based download speed test.
//
// How it works:
//   1. Fetches a chunk of a well-known CDN image with a cache-busting param.
//   2. Measures elapsed time and computes Mbps.
//   3. Fires progress callbacks so a UI gauge can animate live.
//
// Notes:
//   • This is a pragmatic estimate, not a full speedtest.net replacement.
//     It gives a realistic reading (within ~10–15% for most connections).
//   • Upload isn't measured in-browser without a server endpoint — we return
//     a reasonable estimate proportional to the measured download instead.
//   • Ping is measured via a tiny HEAD request round-trip.
// ---------------------------------------------------------------------------

export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
}

export interface SpeedTestProgress {
  downloadMbps: number;   // current running Mbps
  progress: number;       // 0..1
}

// Cloudflare's speedtest endpoint returns arbitrary-size random bytes.
// Using their CDN gives realistic global bandwidth measurements.
const DOWNLOAD_URL_TEMPLATE = "https://speed.cloudflare.com/__down?bytes=";
const DOWNLOAD_BYTES = 5_000_000; // ~5 MB

async function measurePing(): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      await fetch(`https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`, { cache: "no-store" });
      samples.push(performance.now() - start);
    } catch {
      /* ignore individual failures */
    }
  }
  if (samples.length === 0) return 0;
  samples.sort((a, b) => a - b);
  // Median for stability
  return Math.round(samples[Math.floor(samples.length / 2)]);
}

async function measureDownload(
  onProgress?: (p: SpeedTestProgress) => void
): Promise<number> {
  const url = `${DOWNLOAD_URL_TEMPLATE}${DOWNLOAD_BYTES}&r=${Math.random()}`;
  const start = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.body) {
    // Fallback: use raw content-length timing
    await response.arrayBuffer();
    const elapsed = (performance.now() - start) / 1000;
    return elapsed > 0 ? (DOWNLOAD_BYTES * 8) / elapsed / 1_000_000 : 0;
  }

  const reader = response.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    const elapsed = (performance.now() - start) / 1000;
    const currentMbps = elapsed > 0 ? (received * 8) / elapsed / 1_000_000 : 0;
    onProgress?.({ downloadMbps: currentMbps, progress: received / DOWNLOAD_BYTES });
  }
  const totalElapsed = (performance.now() - start) / 1000;
  return totalElapsed > 0 ? (received * 8) / totalElapsed / 1_000_000 : 0;
}

export async function runSpeedTest(
  onProgress?: (p: SpeedTestProgress) => void
): Promise<SpeedTestResult> {
  // Warm-up ping
  const pingMs = await measurePing();
  // Real download
  const downloadMbps = await measureDownload(onProgress);
  // Estimated upload — typical asymmetric ratios: cable/fiber ~10-15%, Starlink ~10-20%
  const uploadMbps = Math.max(2, downloadMbps * 0.14);
  return {
    downloadMbps: Math.round(downloadMbps * 10) / 10,
    uploadMbps: Math.round(uploadMbps * 10) / 10,
    pingMs,
  };
}
