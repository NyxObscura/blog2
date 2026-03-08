---
title: "Introducing the Obscuraworks API Platform"
description: "Today we're launching Obscuraworks — a developer-first API platform built for teams that need reliable, high-performance infrastructure to power their automation workflows and media pipelines."
date: 2025-06-01T09:00:00Z
author: "Lena Hartmann"
categories: ["Announcements"]
tags: ["api", "platform", "launch", "developer-tools"]
image: "/images/og-default.png"
draft: false
---

After nearly two years of internal development, thousands of hours of load testing, and valuable feedback from our private beta partners, we're ready to share what we've built.

Obscuraworks is a developer-first API platform designed for teams that need reliable, composable infrastructure for automation, media processing, and API orchestration. Today, we're opening the platform to the public.

## The Problem We Set Out to Solve

Modern engineering teams spend a disproportionate amount of time stitching together fragmented tooling. You might use one service for webhooks, another for media transcoding, a third for workflow orchestration, and yet another for API gateway management. Every boundary between these systems is a potential point of failure — and a maintenance burden your team carries indefinitely.

We've felt this pain firsthand. Before founding Obscuraworks, our team built and operated high-throughput media pipelines and API gateways at scale. The same problems kept appearing:

- **Handoff complexity** between pipeline stages introduces latency and error surface area
- **Vendor coupling** makes infrastructure decisions hard to reverse
- **Observability gaps** at service boundaries mean incidents are diagnosed too slowly
- **Configuration sprawl** across multiple platforms creates drift and security debt

We built Obscuraworks to collapse these layers into a single, coherent platform.

## What Obscuraworks Provides

### A Unified API Execution Layer

At the core of the platform is a high-performance API execution engine. Every inbound request passes through a programmable request pipeline where you can apply authentication, rate limiting, transformation, and routing logic — all defined in code, not dashboards.

```yaml
# pipeline.yaml — a simple authenticated proxy with rate limiting
pipeline:
  name: media-ingest
  stages:
    - auth:
        strategy: bearer
        jwks_uri: https://auth.example.com/.well-known/jwks.json
    - rate_limit:
        requests_per_second: 50
        burst: 200
        key: "{{request.headers['x-tenant-id']}}"
    - proxy:
        upstream: https://internal.media-service.example.com
        timeout_ms: 8000
```

Pipelines are declared in YAML or JSON and deployed via the CLI, the API, or your CI/CD system. Every stage is versioned, auditable, and independently testable.

### Native Media Processing

One of our most-requested private beta features is built-in media processing. Rather than routing video and image workloads through a separate transcoding service, Obscuraworks handles common media operations inline with your request pipeline:

```bash
# Resize and convert an image via the Obscuraworks media endpoint
curl -X POST https://api.obscuraworks.org/v1/media/transform \
  -H "Authorization: Bearer $OW_API_KEY" \
  -F "file=@original.png" \
  -F 'ops=[{"op":"resize","width":800,"fit":"contain"},{"op":"format","to":"webp","quality":85}]'
```

Supported operations include resize, crop, format conversion, watermarking, and thumbnail generation for images; transcoding, clipping, and audio extraction for video.

### Automation Workflows

Beyond request proxying, Obscuraworks supports durable workflow execution. Workflows are sequences of steps — HTTP calls, media operations, conditional branches, and custom scripts — that execute reliably even when individual steps fail.

```javascript
// workflow.js — fetch, transcode, and deliver a video asset
export default defineWorkflow({
  id: 'video-ingest-pipeline',
  steps: [
    {
      id: 'fetch-source',
      type: 'http',
      config: {
        method: 'GET',
        url: '{{input.sourceUrl}}',
        responseType: 'binary',
      },
    },
    {
      id: 'transcode',
      type: 'media.transcode',
      config: {
        codec: 'h264',
        resolution: '1080p',
        bitrateKbps: 4000,
        audioCodec: 'aac',
      },
    },
    {
      id: 'deliver',
      type: 'http',
      config: {
        method: 'PUT',
        url: '{{env.STORAGE_ENDPOINT}}/{{input.assetId}}.mp4',
        headers: {
          Authorization: 'Bearer {{env.STORAGE_TOKEN}}',
        },
        body: '{{steps.transcode.output.data}}',
      },
    },
  ],
});
```

Workflows include automatic retries with configurable backoff, dead-letter queues, execution history, and real-time status streaming via WebSocket.

## Platform Architecture

Obscuraworks is built on a few architectural principles that shape every design decision:

**Stateless compute, stateful coordination.** Request handlers are stateless and horizontally scalable. State lives in a durable coordination layer that handles locking, ordering, and delivery guarantees.

**Edge-first routing.** API traffic is handled close to origin using our globally distributed PoPs, with consistent hashing for tenant isolation.

**Structured observability.** Every request, workflow execution, and media operation emits structured logs and spans. Traces are compatible with OpenTelemetry collectors and export to Datadog, Grafana, and others.

## Getting Started

Getting your first pipeline running takes under five minutes:

```bash
# Install the CLI
npm install -g @obscuraworks/cli

# Authenticate
ow auth login

# Initialize a new project
ow init my-project
cd my-project

# Deploy your first pipeline
ow deploy
```

The platform is available today at [obscuraworks.org](https://obscuraworks.org). Documentation, quickstart guides, and SDK references are all live.

## What's Next

We're publishing our public roadmap. Some highlights for the coming quarters:

- **GraphQL gateway** for composing multiple upstream APIs into a single schema
- **Streaming pipelines** for real-time event processing with Kafka compatibility
- **Team permissions** with fine-grained RBAC and audit logging
- **Terraform provider** for infrastructure-as-code management of platform resources

We're grateful to our beta partners for their patience, feedback, and trust. This launch is the beginning of a longer journey, and we're building it in public.

If you have questions, feedback, or want to talk about your use case, reach out at engineering@obscuraworks.org.
