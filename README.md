# 🎁 Our Wishlist Space

A beautifully designed, AI-powered shared wishlist application built for families, friends, and couples. Create private groups, share gift ideas, reserve items without ruining the surprise, manage your personal "Style Passport", and use an integrated AI Gift Assistant powered by Retrieval-Augmented Generation (RAG) to find the perfect gift.

**[🚀 Try the live app here!](https://your-live-website-link-here.com)**

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
- **Automated Link Parsing:** Paste a link into a wish, and the backend automatically fetches OpenGraph metadata (title, description, and image) via Cheerio.
- **Creator Permissions:** Secure group management. Only the original creator of a group has the power to permanently delete it.
- **Glassmorphism UI:** A stunning, responsive frosted-glass interface built with Tailwind CSS.

---

## 🛠 Tech Stack & Architecture

- **Frontend / Framework:** [Next.js](https://nextjs.org/) (App Router), React, TypeScript
- **Styling:** Tailwind CSS (with custom Glassmorphism/frosted-glass aesthetics)
- **Authentication:** [Clerk](https://clerk.com/) (using JWTs for Supabase integration)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Vector Database:** `pgvector` extension in Supabase for semantic search.
- **AI / LLM:** Google Gemini (`@google/generative-ai`) via `gemini-flash-lite-latest`
- **Metadata Scraping:** `cheerio` for parsing OpenGraph metadata from pasted URLs.

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

# Gemini AI Keys
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_EMBEDDING_PROVIDER=gemini
```

### 3. Setting Up the Supabase Database (Schema Replication)

**"How do I store the config for all the tables and settings in Supabase to easily recreate them on a different machine?"**

The best way to recreate a Supabase database is by running a **SQL script** in the Supabase SQL Editor. If you want to backup an existing database locally, you can use the [Supabase CLI](https://supabase.com/docs/guides/cli):
`supabase db dump -f schema.sql` to export the remote database's DDL schema.

To set up a completely fresh Supabase project for this app, run the following SQL script in your Supabase SQL Editor. This will create all tables, enable `pgvector`, and set up the RPC function for the AI Gift Assistant:

```sql
-- 1. Enable the pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Profiles table (Style Passport)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- maps to Clerk User ID
  preferred_unit TEXT,
  height TEXT,
  weight TEXT,
  chest TEXT,
  waist TEXT,
  inseam TEXT,
  shirt_size TEXT,
  pant_size TEXT,
  shoe_size TEXT,
  ring_size TEXT,
  preferred_fit TEXT,
  metal_preference TEXT,
  style_words TEXT,
  favorite_brands TEXT,
  dealbreakers TEXT,
  notes TEXT,
  embedding vector(768) -- Store embeddings for AI search
);

-- 3. Create the Groups table
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL -- Clerk User ID
);

-- 4. Create the Group Members table
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL -- Clerk User ID
);

-- 5. Create the Wishes table
CREATE TABLE wishes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image_url TEXT,
  is_inspo BOOLEAN DEFAULT false,
  user_id TEXT NOT NULL, -- Clerk User ID
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  reserved_by TEXT, -- Clerk User ID of the reserver
  embedding vector(768) -- Store embeddings for AI search
);

-- 6. RPC Function for Vector Similarity Search (AI Assistant)
-- This function allows us to mathematically search for the closest items to a user's query.
CREATE OR REPLACE FUNCTION match_wishes (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_group_id uuid,
  p_user_id text
)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  url text,
  is_inspo boolean,
  reserved_by text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    wishes.id,
    wishes.name,
    wishes.description,
    wishes.url,
    wishes.is_inspo,
    wishes.reserved_by,
    1 - (wishes.embedding <=> query_embedding) AS similarity
  FROM wishes
  WHERE wishes.group_id = p_group_id
    AND wishes.user_id = p_user_id
    AND 1 - (wishes.embedding <=> query_embedding) > match_threshold
  ORDER BY wishes.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Security (Row Level Security):**
Ensure that Row Level Security (RLS) is enabled on all tables, and set up policies to allow Authenticated users (via Clerk JWT) to `SELECT`, `INSERT`, `UPDATE`, and `DELETE` their respective rows.

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

## 🔮 Future Work & System Design Roadmap (Unimplemented Concepts)

The following architectural and feature enhancements are planned to expand the application from a seasonal gifting tool into a high-retention, daily-utility product while demonstrating advanced backend and distributed system design principles.

### 1. Daily Utility: "Cooling-Off" Impulsive Shopping Filter
* **Problem:** Wishlist applications suffer from low daily active usage because gifting occurs seasonally.
* **Architecture:** Introduce a personal shopping quarantine zone ("30-Day Cooling Off Queue"). Users drop items they want to buy for themselves into a temporary holding state. The UI locks purchase triggers for 30 days. After the cooldown expires, users can either fulfill the purchase or convert it into a public gift request.
* **Impact:** Transforms the platform into a daily personal finance and anti-impulsive shopping organizer.

### 2. Atomic Concurrency & Idempotent Gift Reservations (Anti-Double Booking)
* **Problem:** In high-traffic group events (e.g., holidays), concurrent requests could allow two users to claim the same item simultaneously due to race conditions.
* **Architecture:** 
  - Migrate reservation updates to atomic PostgreSQL stored procedures with row-level locks (`SELECT ... FOR UPDATE SKIP LOCKED` or conditional atomic updates).
  - Implement client-side idempotency keys passed via HTTP headers (`Idempotency-Key: <uuid>`) to prevent duplicate transactions caused by network retries.
* **System Design Highlight:** Demonstrates distributed concurrency control, race-condition mitigation, and idempotent API design.

### 3. Group Gift Pooling (Crowdfunding / Fractional Ledger System)
* **Problem:** High-ticket wishlist items (e.g., $300+ electronics) frequently go unfulfilled because individual friends cannot afford the entire purchase.
* **Architecture:** 
  - Implement a double-entry transaction ledger table (`gift_contributions`) tracking user contributions toward target goal amounts.
  - Compute campaign fulfillment progress dynamically using SQL aggregations and database triggers with automated state transitions when the funding threshold is reached.
* **System Design Highlight:** Demonstrates financial ledger design, transactional consistency, and multi-party payment coordination models.

### 4. Hybrid Retrieval Engine (pgvector Dense Search + BM25 Sparse Search via RRF)
* **Problem:** Vector embeddings excel at abstract semantic matching but struggle with exact alphanumeric model queries (e.g., "Sony WH-1000XM5" or exact SKU codes).
* **Architecture:** 
  - Combine PostgreSQL full-text search (`tsvector` + `tsquery`) with `pgvector` cosine similarity embeddings.
  - Merge and rank the result sets using **Reciprocal Rank Fusion (RRF)** directly within an optimized SQL query before passing the top-ranked candidates to the Gemini context window.
* **System Design Highlight:** Demonstrates advanced Information Retrieval (IR) optimization and modern production RAG engineering.

### 5. Automated Price Drop Tracker & Background Job Pipelines
* **Problem:** Gift URLs can go out of stock or have price drops without the user's knowledge.
* **Architecture:** 
  - Establish a scheduled background worker pipeline (via Vercel Cron or Supabase Edge Functions) that parses OpenGraph and schema.org JSON-LD structured price data from product URLs.
  - Maintain a `price_history` time-series table to calculate percentage drops and notify group members when an item hits an all-time low.
* **System Design Highlight:** Demonstrates asynchronous background worker orchestration, rate limiting, and time-series data modeling.

### 6. Multi-Tenant Real-Time Sync via Supabase WebSockets (Change Data Capture)
* **Problem:** Multiple active group members viewing the same wishlist require manual refreshes to see claimed items or new additions.
* **Architecture:** 
  - Subscribe to PostgreSQL Change Data Capture (CDC) events via Supabase Realtime Channels over WebSockets.
  - Implement optimistic UI updates with automatic reconciliation on the client to provide zero-latency collaborative list management.
* **System Design Highlight:** Demonstrates event-driven frontend architecture, WebSocket connection lifecycles, and real-time state synchronization.
