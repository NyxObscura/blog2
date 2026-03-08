---
title: "Platform v1.0 — General Availability"
description: "Obscuraworks API Platform reaches general availability with full media processing, workflow execution, and multi-region support."
date: 2025-06-01T09:00:00Z
version: "v1.0.0"
type: "Major"
draft: false
---

## What's New

### General Availability

The Obscuraworks API Platform is now generally available. All APIs covered in this release are stable and covered by our SLA.

### API Gateway

- Programmable request pipelines with YAML/JSON configuration
- JWT and API key authentication strategies
- Per-tenant rate limiting with burst handling
- Request/response transformation with JSONata expressions
- Upstream health checks and automatic failover

### Media Processing

- Image operations: resize, crop, format conversion (JPEG, WebP, AVIF, PNG), watermark, thumbnail
- Video operations: transcode (H.264, H.265), resolution scaling, clip extraction, audio strip
- Synchronous processing for operations under 500ms
- Async job queue for longer operations with webhook delivery
- Result caching by content hash

### Workflow Engine

- Multi-step workflow definitions in JavaScript or YAML
- HTTP, media, and conditional step types
- Automatic retry with exponential backoff
- Execution history and real-time status streaming

### Developer Experience

- CLI (`@obscuraworks/cli`) for project management and deployments
- Node.js and Python SDKs
- OpenAPI 3.1 specification for all endpoints
- Interactive API playground at [api.obscuraworks.org/playground](https://obscuraworks.org)

## Breaking Changes

None. This is the first stable release.

## Deprecations

None.

## Known Issues

- Video transcoding to HEVC on Safari 16 and below may require client-side fallback. This will be resolved in v1.1.
- Batch image operations exceeding 500 items in a single request return a `429` rather than a descriptive error. Fix scheduled for v1.0.1.

## Upgrading

New accounts start on v1.0 automatically. Private beta users should migrate from `api.beta.obscuraworks.org` to `api.obscuraworks.org`. Beta endpoints will continue operating until 2025-09-01.
