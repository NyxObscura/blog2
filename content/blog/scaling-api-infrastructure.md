---
title: "Scaling Developer Infrastructure for Automation: From Prototype to Production"
description: "How we scaled Obscuraworks from a single-region prototype handling hundreds of requests per minute to a globally distributed platform processing millions — and what we'd do differently if we started today."
date: 2025-04-18T10:00:00Z
author: "Priya Venkatesan"
categories: ["Infrastructure"]
tags: ["scaling", "kubernetes", "distributed-systems", "infrastructure", "devops", "reliability"]
draft: false
---

There's a common failure mode in infrastructure engineering: systems that work beautifully at prototype scale buckle under production load in ways that are entirely predictable in hindsight. This post documents Obscuraworks's journey from a single-region, single-database architecture to a distributed system capable of handling bursty, geographically diverse traffic — and the specific decisions that made that transition survivable.

## Where We Started

Our initial deployment was deliberately simple. One Kubernetes cluster in `us-east-1`, a Postgres instance on RDS, Redis for caching, and an NGINX ingress controller doing basic load balancing. This worked well through the private beta. We had predictable traffic, known customers, and low stakes failures.

The architecture looked roughly like this:

```
Internet
    │
    ▼
NGINX Ingress
    │
    ├── API Service (3 replicas)
    ├── Worker Service (5 replicas)
    └── Media Service (4 replicas)
         │
         ├── PostgreSQL (RDS, Multi-AZ)
         ├── Redis Cluster
         └── S3 (media storage)
```

Simple. Understandable. Completely insufficient for what came next.

## The Breaking Points

When we opened the platform publicly, three failure modes surfaced in the first 72 hours:

### 1. Database Connection Saturation

Our API pods used per-pod connection pools. With 3 API replicas, each maintaining 20 connections, we had 60 total connections to Postgres. Under load, we scaled to 25 replicas — and hit the connection limit on our RDS instance.

We had not deployed PgBouncer. This was an oversight we corrected urgently, but it cost us approximately four hours of degraded performance while we deployed connection pooling into a live system.

**Lesson:** Always deploy PgBouncer (or equivalent) between application pods and Postgres, regardless of current scale.

### 2. Noisy Neighbor in the Job Queue

We used a single Redis stream for all job types: image transforms, video transcodes, webhook deliveries, and background sync tasks. Under load, a burst of video transcode requests (CPU-heavy, long-running) filled the queue and delayed webhook deliveries (lightweight, time-sensitive).

```python
# Before: all jobs in one stream
redis.xadd('jobs', {'type': 'video.transcode', 'payload': ...})
redis.xadd('jobs', {'type': 'webhook.deliver', 'payload': ...})

# After: priority-segregated queues
redis.xadd('jobs:critical', {'type': 'webhook.deliver', ...})
redis.xadd('jobs:standard', {'type': 'image.transform', ...})
redis.xadd('jobs:background', {'type': 'video.transcode', ...})
```

We deployed dedicated worker pools for each queue tier, with different scaling triggers and resource allocations.

### 3. Single-Region Latency

About 35% of our traffic came from Europe during the first week. Routing that traffic to `us-east-1` added 100–150ms of network latency to every request — noticeable in interactive workflows.

## The Path to Multi-Region

Moving to multiple regions is conceptually straightforward but operationally complex. The difficulty is state: databases, caches, and job queues need to be either replicated, centralized, or redesigned.

Our architecture decisions:

### Compute: Regional, Stateless

API and worker pods are deployed to each region independently. They carry no local state. Horizontal scaling within regions happens automatically via KEDA (Kubernetes Event-Driven Autoscaling) based on queue depth and request rate.

```yaml
# keda-scaler.yaml — scale workers based on Redis queue depth
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
spec:
  scaleTargetRef:
    name: worker-deployment
  pollingInterval: 10
  cooldownPeriod: 60
  minReplicaCount: 2
  maxReplicaCount: 50
  triggers:
    - type: redis-streams
      metadata:
        address: redis.internal:6379
        stream: jobs:standard
        consumerGroup: workers
        pendingEntriesCount: "10"
```

### Database: CockroachDB for Global Distribution

We migrated from RDS Postgres to CockroachDB for our transactional data. CockroachDB's multi-region support allowed us to configure per-table regional affinity — accounts and billing data stay local to each region's users, while pipeline configurations and job metadata are globally available.

```sql
-- Declare regional table for low-latency user data access
ALTER TABLE user_sessions SET LOCALITY REGIONAL BY ROW;

-- Global table for infrequently-written, frequently-read config
ALTER TABLE pipeline_definitions SET LOCALITY GLOBAL;
```

The migration was non-trivial. CockroachDB is largely Postgres-compatible, but several behaviors differ — notably around serializable transactions and index handling. We ran both databases in parallel for six weeks before cutting over.

### Cache: Regional Redis, No Cross-Region Replication

Cache invalidation across regions introduces consistency complexity we weren't willing to accept. Our approach: each region has its own Redis cluster. Cache misses are cold in new regions, but cache hit rates reach steady state within minutes of traffic arriving.

For content that must be globally consistent (rate limiting counters, distributed locks), we use a separate coordination service backed by etcd.

### Job Queues: Origin-Regional with Fan-Out

Jobs are enqueued in the region where the request originates. Workers in that region process them. For outputs (webhook deliveries, CDN uploads), we route to the customer's preferred endpoint regardless of origin region.

This avoids cross-region job fan-out for the common case while keeping latency low for heavy compute operations.

## Observability at Scale

As the system grew more distributed, our observability stack became more important. We settled on three layers:

**Structured logging with correlation IDs.** Every request gets a trace ID injected at ingress. All downstream service calls propagate this ID. Logs are shipped to our log aggregation system, where the trace ID enables reconstructing the full request path across services.

```python
import structlog
log = structlog.get_logger()

def handle_transform_request(request_id: str, payload: dict):
    log = log.bind(request_id=request_id, service="media-api")
    log.info("transform_request_received", operation_count=len(payload["ops"]))

    result = execute_pipeline(payload)

    log.info("transform_request_completed",
             duration_ms=result.duration_ms,
             output_size_bytes=result.output_size)
    return result
```

**Distributed tracing with OpenTelemetry.** We emit spans for every significant operation: request handling, database queries, queue operations, external HTTP calls. Traces export to our Grafana Tempo instance.

**Synthetic monitoring.** We run canary requests from multiple regions every 60 seconds, testing critical paths end-to-end. Failures alert before real customer traffic is affected.

## Deployment: Progressive Rollouts

With multiple regions and millions of active pipelines, a bad deployment can cause widespread disruption. We implemented a phased rollout process:

1. **Canary region** — deploy to our lowest-traffic region first, run for 30 minutes
2. **Automated gate** — check error rate, P99 latency, and job failure rate against baseline
3. **Progressive rollout** — 10% → 25% → 50% → 100% of regions, with automated gate at each stage

The CI/CD pipeline enforces this process. Manual overrides require two-person approval.

```yaml
# .github/workflows/deploy.yml (abbreviated)
jobs:
  deploy-canary:
    steps:
      - name: Deploy to canary region
        run: ow deploy --region us-west-2 --tag ${{ github.sha }}

      - name: Run canary health checks
        run: |
          sleep 300
          ow health-check --region us-west-2 \
            --max-error-rate 0.001 \
            --max-p99-latency-ms 300

  deploy-production:
    needs: deploy-canary
    steps:
      - name: Progressive rollout
        run: ow deploy --regions all --strategy progressive --tag ${{ github.sha }}
```

## Current State and What's Next

Today, the platform runs across five regions, handling sustained loads of several thousand requests per second with P99 latency under 120ms for synchronous operations.

The architecture has evolved, but the original principle remains: build simple, observable systems. Complexity should be introduced deliberately to solve specific scale problems — not preemptively.

Our next infrastructure focus areas are:

- **Streaming ingestion** — a Kafka-compatible interface for high-throughput event-driven workflows
- **Cost attribution** — per-tenant compute and bandwidth accounting at the infrastructure level
- **Chaos engineering** — systematic fault injection to validate resilience assumptions

If any of this resonates with problems you're working on, we'd genuinely enjoy the conversation. Find us at engineering@obscuraworks.org.
