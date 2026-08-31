# 🎁 Our Wishlist Space

A beautifully designed, AI-powered shared wishlist application built for families, friends, and couples. Create private groups, share gift ideas, reserve items without ruining the surprise, manage your personal "Style Passport", and use an integrated AI Gift Assistant powered by Retrieval-Augmented Generation (RAG) to find the perfect gift.

---

## ✨ Features

- **Shared Spaces:** Create private groups and invite others using a unique 6-character join code.
- **Surprise Preservation:** Claim/Reserve gifts on other people's lists so no one buys duplicates. The list owner cannot see who claimed their items!
- **Style Passport:** A dedicated profile for every user to store clothing sizes, shoe sizes, preferred fits, and dealbreakers.
- **"Inspo Only" Mode:** Tag gifts as "Inspo Only" to let your friends know you just want the vibe, not necessarily that exact item.
- **AI Gift Assistant (RAG Pipeline):** 
  - Integrated Gemini AI that uses **Vector Search (`pgvector`)** to analyze a user's exact wishlist and Style Passport.
  - Automatically fetches the 3 most mathematically relevant items to prevent AI hallucination.
  - Generates clickable URLs, warns if items are already reserved, and grades outside links against the recipient's style passport.
- **Creator Permissions:** Secure group management. Only the original creator of a group has the power to permanently delete it.
- **Glassmorphism UI:** A stunning, responsive frosted-glass interface built with Tailwind CSS.

---

## 🛠 Tech Stack & Architecture

- **Frontend / Framework:** [Next.js](https://nextjs.org/) (App Router), React, TypeScript
- **Styling:** Tailwind CSS (with custom Glassmorphism/frosted-glass aesthetics)
- **Authentication:** [Clerk](https://clerk.com/) (using JWTs for Supabase integration)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **AI & ML:** Google Gemini Flash-Lite, `pgvector` (HNSW/IVFFlat indexes)
- **Performance & Testing:** k6 for high-concurrency load testing, Custom Sliding-Window Rate Limiter

---

## 🧠 Core Engineering Features

### 1. Hybrid Search (Dense Vectors + Sparse FTS) with RRF
Traditional semantic search struggles with exact keyword matching (e.g., specific brand names or model numbers). This application solves this by implementing **Hybrid Search**:
- **Dense Retrieval**: Extracts semantic meaning using Google Gemini embedding models and matches them using `pgvector`.
- **Sparse Retrieval**: Uses PostgreSQL's Full-Text Search (FTS) for exact keyword matches.
- **Reciprocal Rank Fusion (RRF)**: Mathematically fuses the scores from both retrieval methods directly inside a highly optimized PostgreSQL RPC, eliminating the need to process large result sets in the Node.js runtime.

### 2. Edge-Optimized Semantic Caching
To protect against LLM API rate limits and drastically reduce cloud costs, the platform utilizes a context-aware **Semantic Cache**:
- **Vector-Based Hits**: Incoming queries are embedded and compared against a cache table using `pgvector`. If the cosine similarity exceeds `0.95`, the application bypasses the LLM entirely and serves the cached response.
- **Context Hashing**: The cache implements MD5 hashing of the user's conversational history and active group context, ensuring that cached responses are only served if the conversation state is identical.
- **24-Hour TTL**: Cached items strictly adhere to a 24-hour Time-to-Live (TTL) enforced at the database level to prevent data staleness.

### 3. Resilient Infrastructure & Anti-Spam
The architecture is designed to withstand DDoS-style traffic spikes without crashing the Node.js runtime or exhausting third-party API quotas:
- **Custom Rate Limiting Middleware**: Implements a sliding-window rate limiter utilizing in-memory TTL maps, successfully deflecting malicious traffic bursts before they hit the database or LLM endpoints.

---

## 📊 Performance Benchmarks

The system was rigorously stress-tested using `k6` to validate architectural decisions under heavy concurrent load (50 Virtual Users).

### 1. Hybrid Search Accuracy (MRR@5)
*Objective: Measure the improvement in retrieval accuracy by comparing pure Vector Search against Hybrid Search.*

| Metric | Pure Vector Search | Hybrid Search (RRF) | Impact |
|--------|--------------------|---------------------|--------|
| **Average MRR@5** | `0.66` | `1.00` | **+51% Accuracy** |

### 2. Semantic Cache Performance
*Objective: Quantify the latency reduction under a high-concurrency burst.*

| Metric | Without Cache (100% LLM API) | With Semantic Cache (Mixed Traffic) | Impact |
|--------|------------------------------|-------------------------------------|--------|
| **Median Latency** | `~3.2s` | `195ms` | **94% Latency Reduction** |
| **p90 Latency** | `~4.1s` | `470ms` | **88% Latency Reduction** |
| **p99 Latency** | `~6.5s` | `1.38s` | **78% Latency Reduction** |

> **Analysis**: The Semantic Cache successfully handles high-traffic bursts. The 195ms median indicates that the vast majority of requests are instantly served from the database cache. The p99 latency of 1.38s accounts for the system correctly falling back to the LLM for completely unique Cache Misses.

### 3. Overall Resilience (Soak Test)
*Objective: Ensure the application remains stable under a DDoS-style spike, testing the custom rate-limiting middleware.*

| Metric | Result | Target |
|--------|--------|--------|
| **Total Requests** | `3,752 reqs` | `> 2,000 reqs` |
| **Throughput** | `36.5 req/sec` | `> 20 req/sec` |
| **Blocked by Rate Limiter**| `33.36% (HTTP 429)` | `N/A (Proves protection)` |
| **System Uptime** | `100%` | `100%` |

> **Analysis**: The system perfectly defended itself against an unauthenticated DDoS spike, automatically issuing HTTP 429 errors while serving 100% of legitimate page requests without crashing or leaking memory.

---

## 💻 System Design & Setup

Want to fork this project or run your own instance locally? Follow these steps exactly to recreate the environment.

### 1. Clone and Install
Clone this repository and install the dependencies:

```bash
git clone https://github.com/yourusername/our-wishlist.git
cd our-wishlist
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory. You will need API keys from your Clerk, Supabase, and Google Gemini accounts.

```env
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase Database Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Gemini AI Keys
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_EMBEDDING_PROVIDER=gemini
```

### 3. Setting Up the Supabase Database (Schema Replication)

The database architecture is fully version-controlled using the Supabase CLI. 
To set up a completely fresh Supabase project with all tables, `pgvector` indexes, and the Semantic Cache RPCs, simply apply the migrations:

```bash
supabase link --project-ref your_project_ref
supabase db push
```

Alternatively, you can manually run the SQL scripts found in the `supabase/migrations/` directory directly in your Supabase SQL Editor. These files are kept strictly up to date with the latest schema and cache TTLs.

### 4. Run the Development Server
Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to interact with your local instance of the app.

---

## 🔒 Security & Architecture Notes
- **Row Level Security (RLS):** Supabase RLS policies are strictly tied to the `user_id` for inserts and updates. 
- **Group Deletion:** The backend safely checks the `created_by` field on the `groups` table before executing a delete operation.
- **RAG Architecture:** The AI assistant enforces anti-hallucination policies by restricting the LLM's context window purely to data retrieved by `pgvector`. The model is isolated from directly executing queries or hallucinating products outside the database.

---

## 🔮 Future Work & System Design Roadmap (Deep Backend Optimizations)

The following architectural enhancements are planned to push the system further vertically, focusing on extreme performance and reduced LLM reliance, while adhering to a zero-budget open-source constraint.

### 1. Zero-Cost Cross-Encoder Re-Ranking (Local Transformers)
* **Problem:** Standard cosine similarity (Bi-Encoders) is fast but sometimes misses deep semantic nuance between a user's query and the retrieved items.
* **Architecture:** 
  - Integrate a small HuggingFace Cross-Encoder model (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`) directly into the Next.js Edge Runtime via `transformers.js` (WebAssembly).
  - After Supabase returns the Top 20 `pgvector` candidates, the Edge function re-ranks them locally before picking the Top 3 to send to the Gemini LLM.
* **System Design Highlight:** Demonstrates edge-compute ML integration, zero-cost accuracy scaling, and multi-stage retrieval pipelines.

### 2. Automated pgvector Index Optimization Pipeline
* **Problem:** As the `wishes` table grows into the millions, the `IVFFlat` vector index degrades in performance unless `lists` are recalculated, causing latency drift.
* **Architecture:** 
  - Establish a stateless cron job that monitors table cardinality.
  - Automatically triggers `REINDEX INDEX CONCURRENTLY` and dynamically adjusts the `lists` parameter (`lists = rows / 1000`) during low-traffic hours to maintain sub-10ms vector lookups.
* **System Design Highlight:** Demonstrates automated database maintenance, index lifecycle management, and production-grade SLA maintenance.

### 3. LLM Prompt Batching & Request Coalescing
* **Problem:** High concurrency causes identical or similar LLM requests to eat through rate limits, even with caching for exact matches.
* **Architecture:** 
  - Implement a request-coalescing queue in the Node.js runtime. If 5 users ask for gift advice simultaneously, intercept the requests, aggregate the contexts into a single multi-prompt array, and send exactly 1 HTTP request to the Gemini API.
  - De-multiplex the array response back to the 5 waiting HTTP client connections.
* **System Design Highlight:** Demonstrates advanced Node.js concurrency, queue theory, and extreme third-party API rate-limit optimization.
