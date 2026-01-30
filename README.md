# AsyncFlow

A **production-ready distributed asynchronous task processing system** implementing industry-standard patterns for decoupling high-latency workloads from RESTful APIs. Built with **message queuing**, **persistent state management**, and **horizontal scalability** in mind.

---

## Architecture Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP POST (task registration)
       │ Returns 202 Accepted
       ▼
┌─────────────────────┐
│   API Producer      │ ───── Persist ────▶ PostgreSQL
│   (Fastify)         │                     (PENDING state)
└──────────┬──────────┘
           │ Publish message (UUID only)
           ▼
      ┌──────────┐
      │ RabbitMQ │ (Durable queues, persistent messages)
      └─────┬────┘
            │ Consume with QoS prefetch(1)
            ▼
      ┌────────────────┐
      │ Worker Consumer│ ───── Update ────▶ PostgreSQL
      │  (Isolated)    │                    (COMPLETED state)
      └────────────────┘
```

**Monorepo structure** using Node.js Workspaces with strict separation of concerns:

- **Ingestion Layer** (API Producer)
- **Broker Layer** (RabbitMQ)
- **Processing Layer** (Worker Consumer)

This enables independent horizontal scaling while maintaining consistency and fault tolerance.

---

## Real-World Applications

This architectural pattern is used in production systems for:

- **Video Streaming Platforms**: Transcoding pipelines, thumbnail generation
- **E-commerce**: Order processing, invoice generation
- **Fintech**: Transaction reconciliation, batch payments
- **Email/SMS**: Bulk notification delivery
- **Data Engineering**: ETL pipelines, large dataset transformations
- **Document Processing**: PDF/Excel generation, OCR processing

---

## Technical Implementation

### API Producer (Ingestion Layer)

**Responsibilities**: HTTP request handling and task registration

- **Framework**: Fastify (high performance, low overhead)
- **Validation**: Zod (type-safe schema validation)
- **Persistence**: Prisma ORM + PostgreSQL
- **Flow**:
  1. Receives HTTP POST request
  2. Validates payload with Zod
  3. Persists task with `PENDING` state
  4. Publishes message to RabbitMQ (UUID only - minimal payload)
  5. Returns `202 Accepted` (HTTP best practice for async processing)
- **Durability**: Messages published with persistent delivery mode

---

### Message Broker (Orchestration Layer)

**Responsibilities**: Reliable message delivery and load distribution

- **Technology**: RabbitMQ 4
- **Configuration**:
  - Durable queues (survive broker restarts)
  - Persistent messages (written to disk)
  - QoS `prefetch(1)` (fair distribution across workers)
  - Manual acknowledgments (explicit success/failure handling)

---

### Worker Consumer (Processing Layer)

**Responsibilities**: Isolated task execution

- **Idempotency**: Database lookup before execution prevents duplicate processing
- **State Machine**: `PENDING → COMPLETED`
- **Acknowledgment Strategy**:
  - `ack()` on successful completion
  - `nack()` with requeue for transient failures
  - Task state updated atomically in PostgreSQL

---

## Engineering Best Practices

### Graceful Shutdown

Signal handlers (`SIGINT`, `SIGTERM`) ensure:

- Prisma connection pool properly closed
- AMQP channels cleanly shut down
- No socket leaks
- In-flight messages completed or requeued

### Prisma Client Singleton

Shared workspace library enforces single `PrismaClient` instance:

- Optimized connection pooling
- Prevents resource exhaustion
- Consistent configuration across services

### Infrastructure as Code

Docker Compose orchestrates:

- PostgreSQL 15 (relational database)
- RabbitMQ 4 (management UI enabled on port 15672)

### Security

- Environment variables centralized in root `.env`
- Secrets excluded from version control
- Sanitized logging (no credential leakage)

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20.x or higher

### Setup

1. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start infrastructure**:

   ```bash
   docker compose up -d
   ```

3. **Run database migrations**:

   ```bash
   npx prisma migrate dev
   ```

4. **Start services** (separate terminals):

   ```bash
   # Terminal 1 - API
   npm run dev -w api

   # Terminal 2 - Worker
   npm run dev -w worker
   ```

5. **Access RabbitMQ Management UI**:
   ```
   http://localhost:15672
   Default credentials: guest/guest
   ```

---

## Testing the System

### Submit a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"name": "sample-task"}'
```

**Expected response**: `202 Accepted` with task UUID

### Monitor processing:

- **RabbitMQ UI**: Watch messages flow through queues
- **Database**: Query task status changes
- **Logs**: Worker processing output

---

## Performance Characteristics

**Local testing results** (MacBook Pro M1, 16GB RAM):

| Metric               | Value                                     |
| -------------------- | ----------------------------------------- |
| API Latency          | ~5ms (task registration)                  |
| Simulated Processing | 5 seconds per task                        |
| Throughput           | 100 tasks/second (API)                    |
| Worker Scalability   | Tested with 1, 3, 5 concurrent workers    |
| Fault Tolerance      | 100% task completion after broker restart |

---

## What I Learned

### Message Broker Patterns

- Differences between **topics**, **queues**, and **exchanges**
- Trade-offs: manual vs automatic acknowledgments
- Handling poison messages and retry strategies
- QoS configuration impact on throughput vs fairness

### Distributed Systems Challenges

- Ensuring **idempotency** in async workflows
- Managing **state consistency** across services
- **Graceful shutdown** to prevent message loss
- Handling **partial failures** and transient errors

### Scalability Considerations

- Horizontal scaling of workers (linear throughput increase)
- Connection pooling and resource management
- Trade-offs between reliability and performance
- Monitoring and observability in distributed systems

---

## Current Status & Design Philosophy

### Focus on Architecture, Not Implementation Details

This project **intentionally simulates processing** (5-second delay) rather than implementing real video conversion. This design choice allows focus on:

✅ **Distributed system fundamentals** (message-driven architecture)  
✅ **Fault tolerance patterns** (acknowledgments, retries, idempotency)  
✅ **Horizontal scalability** (adding workers increases throughput linearly)  
✅ **Operational concerns** (graceful shutdown, connection management)

The worker's processing logic is **intentionally isolated**, making it straightforward to replace simulation with real workloads (FFmpeg, image processing, ML inference, etc.) without architectural changes.

### Why This Approach?

> "Premature optimization is the root of all evil" - Donald Knuth

Implementing real video transcoding would introduce:

- External dependencies (FFmpeg, codecs)
- Platform-specific compilation issues
- Resource-intensive operations masking architectural issues
- Complexity that obscures the core distributed system patterns

By simulating processing, the focus remains on **system design**, **message flow**, and **failure handling** - skills directly transferable to any async processing pipeline.

---

## Potential Evolutions

The architecture supports these extensions without major refactoring:

- **Real Processing**: Swap simulated delay with FFmpeg, ML models, etc.
- **Dead Letter Queues (DLQ)**: Handle poison messages
- **Retry Strategies**: Exponential backoff for transient failures
- **Observability**: Prometheus metrics, OpenTelemetry tracing
- **Rate Limiting**: Consumer-level throttling
- **Multi-tenancy**: Isolated queues per tenant
- **Priority Queues**: Fast-track critical tasks

---

## Tech Stack

**Backend**: Node.js 20, TypeScript  
**API Framework**: Fastify  
**Message Broker**: RabbitMQ 4  
**Database**: PostgreSQL 15  
**ORM**: Prisma  
**Validation**: Zod  
**Infrastructure**: Docker Compose

---

## License

MIT
