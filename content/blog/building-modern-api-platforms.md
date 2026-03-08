---
title: "Designing High-Performance Media APIs: Lessons from the Pipeline"
description: "A deep dive into the architectural decisions behind our media processing pipeline — from codec selection and adaptive bitrate delivery to latency optimization and cost control at scale."
date: 2025-05-12T08:00:00Z
author: "Marcus Osei"
categories: ["Engineering"]
tags: ["media", "api-design", "performance", "architecture", "video"]
draft: false
---

Building an API that processes video and images at scale exposes engineering tradeoffs that don't appear until you're dealing with real workloads. Over the past 18 months, we've processed billions of media transformation requests on our internal infrastructure before shipping those capabilities in the Obscuraworks platform. This post documents the decisions we made, the mistakes we corrected, and the architectural patterns we landed on.

## The Shape of Media Workloads

Media processing APIs are unusual because their workload profile is fundamentally different from typical web services:

- **CPU and memory intensity are high and spiky.** Transcoding a 1080p video can saturate a modern CPU core for minutes. Image resizing at high concurrency generates significant memory pressure.
- **I/O is non-trivial.** Large binary payloads dominate request size. Network throughput, not compute, often becomes the bottleneck.
- **Latency tolerance varies by operation type.** Real-time thumbnail generation for a product image needs sub-200ms response. Background video transcoding can tolerate minutes.
- **Output quality is subjective.** Unlike correctness in a data API, media quality involves perceptual tradeoffs that vary by use case.

These characteristics pushed us toward an architecture that handles media synchronously for lightweight operations and asynchronously for heavyweight ones — with a consistent interface for both.

## The API Contract

We spent considerable time on the API surface before touching any codec code. A media API that exposes implementation details creates brittle integrations. Our goal was a contract that:

1. Expresses **intent** (what transformation you want), not mechanics (which library to use)
2. Separates **submission** from **result retrieval** cleanly for async operations
3. Returns **structured errors** with actionable codes

```http
POST /v1/media/transform
Content-Type: multipart/form-data
Authorization: Bearer <token>

--boundary
Content-Disposition: form-data; name="file"; filename="hero.jpg"
Content-Type: image/jpeg

<binary data>
--boundary
Content-Disposition: form-data; name="ops"

[
  { "op": "resize", "width": 1200, "height": 630, "fit": "cover", "position": "center" },
  { "op": "sharpen", "sigma": 0.8 },
  { "op": "format", "to": "webp", "quality": 82, "lossless": false }
]
--boundary--
```

The `ops` array is processed in order. Each operation is atomic — if any step fails, the entire request fails with a specific error code indicating which operation and why.

```json
{
  "error": {
    "code": "OPERATION_FAILED",
    "operation_index": 1,
    "operation": "sharpen",
    "message": "Sigma value 0.8 out of range for JPEG source at current quality setting",
    "docs": "https://docs.obscuraworks.org/errors/OPERATION_FAILED"
  }
}
```

## Synchronous vs. Asynchronous Dispatch

For operations completing under 500ms, we return the result directly in the response body. For heavier workloads — full video transcodes, batch image processing — we dispatch to an async job queue and return a job identifier:

```json
{
  "job_id": "job_01HZXK8MNR2V4PQBW3YDCFE9T",
  "status": "queued",
  "estimated_duration_ms": 45000,
  "poll_url": "https://api.obscuraworks.org/v1/jobs/job_01HZXK8MNR2V4PQBW3YDCFE9T",
  "webhook_url": null
}
```

Clients can either poll the job endpoint or register a webhook to receive completion events. We recommend webhooks for production workloads:

```bash
# Register a webhook on a pipeline
ow pipelines update media-ingest \
  --webhook-url https://app.example.com/hooks/media-complete \
  --webhook-events job.completed,job.failed
```

The webhook payload is signed with HMAC-SHA256 using a per-tenant secret:

```http
POST /hooks/media-complete
X-OW-Signature: sha256=a4b8c2...
X-OW-Delivery: del_01HZY...
Content-Type: application/json

{
  "event": "job.completed",
  "job_id": "job_01HZXK8MNR2V4PQBW3YDCFE9T",
  "duration_ms": 38420,
  "output": {
    "url": "https://cdn.obscuraworks.org/assets/job_01HZXK8MNR2V4PQBW3YDCFE9T/output.mp4",
    "size_bytes": 12840193,
    "codec": "h264",
    "resolution": "1920x1080",
    "duration_sec": 142.8,
    "bitrate_kbps": 4012
  }
}
```

## Codec Selection and Quality Presets

Our initial implementation exposed raw codec parameters. This turned out to be a mistake — it created a high learning curve and produced inconsistent results when clients guessed at settings.

We replaced most of the raw parameters with **quality presets** that encode sensible defaults while remaining overridable:

| Preset | Use Case | Video Codec | Audio | Bitrate | Compatibility |
|---|---|---|---|---|---|
| `web-hd` | Web playback, 1080p | H.264 Baseline | AAC 128k | 4 Mbps | Universal |
| `web-4k` | Web playback, 4K | H.265 Main10 | AAC 192k | 15 Mbps | Modern browsers |
| `social` | Social media upload | H.264 High | AAC 128k | 8 Mbps | Universal |
| `archive` | Long-term storage | H.265 CRF 18 | FLAC | Variable | Storage only |
| `thumb` | Thumbnail extraction | JPEG frame | None | — | Image |

Presets dramatically reduced integration time for new customers while cutting the rate of quality-related support tickets.

## Latency Optimization

Our initial P99 latency for image transforms was around 450ms — acceptable, but not impressive given the simple operations (resize + format conversion) involved in most requests.

### Worker Pre-warming

Cold start penalty for our image workers was the biggest contributor to latency variance. Workers needed to initialize libvips, load font caches, and establish connection pools before processing their first request. We implemented a pre-warming strategy where idle workers periodically process synthetic warmup payloads to stay in a hot state.

### Pipeline Fusion

Rather than treating each operation in the `ops` array as a discrete step with intermediate buffer allocation, we fuse compatible operations into single libvips pipeline evaluations. A resize followed by a format conversion that would previously generate an intermediate decoded image now executes as a single evaluation graph:

```
Input → [Decode → Resize → Sharpen → Encode] → Output
         ←————— fused pipeline ————————→
```

This reduced memory allocation per request by approximately 40% and shaved ~80ms off median latency for multi-step operations.

### Result Caching

For deterministic transformations (same input, same ops, same output), we cache results by content-addressed key:

```
cache_key = SHA256(file_content + canonical_ops_json)
```

Cache hits for previously-processed inputs return immediately without any compute. This is particularly impactful for transformations applied repeatedly to the same source assets — common in CMS workflows where the same hero image is transformed into multiple sizes.

After implementing these three optimizations, our P99 image transform latency dropped from 450ms to 95ms.

## Cost Control at Scale

Media processing compute is expensive. A few design decisions significantly influenced cost:

**Tiered job scheduling.** Low-priority batch jobs run on spot instance capacity; real-time jobs run on reserved compute. The scheduling tier is inferred from request characteristics but can be overridden.

**Adaptive quality.** For video transcodes where the source quality is low (high noise, low bitrate input), we automatically reduce the target bitrate rather than padding output with unnecessary bits that don't improve quality.

**Deduplication at ingest.** Identical source files submitted by different tenants transcode to identical outputs. We deduplicate transcode jobs by source content hash, sharing output CDN assets (with per-tenant access control) where content is identical.

## What We Got Wrong

It would be dishonest to only document the things that went well. A few significant mistakes:

**We underestimated metadata handling.** Clients assumed media processing would preserve EXIF data, color profiles, and embedded metadata by default. Our initial implementation stripped everything. We now preserve metadata by default and provide explicit control over what's stripped.

**Error messages were too technical.** Errors referencing codec flags and FFmpeg exit codes aren't useful to application developers. We rewrote the entire error taxonomy.

**Timeout defaults were too aggressive.** A 30-second default timeout for video operations caused failures for legitimate workloads. We now set timeouts based on estimated operation duration, calculated from input file size and requested quality level.

## Conclusion

Building a media processing API that's both powerful and approachable requires sustained attention to the user experience of the API, not just the correctness of the underlying processing. The patterns we've described — intent-based APIs, async-by-default for heavy work, quality presets, pipeline fusion — are now core to how Obscuraworks approaches media processing.

If you're building on top of these capabilities, we'd love to hear about your use case. Our API documentation and SDK references are at [docs.obscuraworks.org](https://obscuraworks.org).
