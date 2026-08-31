import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Import the exact same embedding function used in the app
import { getTextEmbedding } from '../src/lib/embeddings';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // need service role for raw queries
);
const gemini = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

const testQueries = [
  { query: "Sony WH-1000XM5 headphones", expectedUrl: "https://www.sony.com/electronics/headband-headphones/wh-1000xm5" },
  { query: "Apple AirPods Pro 2", expectedUrl: "https://www.apple.com/airpods-pro/" },
  { query: "Nike Air Force 1 White Size 10", expectedUrl: "https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111" }
];

async function getEmbedding(text: string) {
  const result = await getTextEmbedding(text);
  return `[${result.join(',')}]`;
}

// Industry Standard for Vector Load Testing:
// Generate synthetic normalized vectors for "background noise" to avoid hitting API rate limits
function generateSyntheticEmbedding() {
  const arr = new Array(768);
  let sumSq = 0;
  for (let i = 0; i < 768; i++) {
    const val = Math.random() - 0.5;
    arr[i] = val;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  return `[${arr.map(v => v / norm).join(',')}]`;
}

async function runBenchmark() {
  console.log("🚀 Starting MRR@5 Benchmark (Vector vs Hybrid)...\n");
  
  console.log("🛠️ Injecting dummy data into the database for testing...");
  const dummyGroupId = "00000000-0000-0000-0000-000000000000";
  const dummyUserId = "mock-friend-id";

  const { error: groupErr } = await supabase
    .from("groups")
    .upsert([{ id: dummyGroupId, name: "Benchmark Dummy Group", created_by: dummyUserId }]);
  
  if (groupErr) {
    console.error("Failed to create dummy group:", groupErr);
    return;
  }

  const dummyWishes = [];
  
  // 1. Insert REAL test items (to measure MRR)
  for (const t of testQueries) {
    const embedding = await getEmbedding(t.query);
    dummyWishes.push({
      name: t.query,
      description: "Dummy test item for benchmarking",
      url: t.expectedUrl,
      item_embedding: embedding,
      group_id: dummyGroupId,
      user_id: dummyUserId,
      is_inspo: false,
    });
  }

  // 2. Insert 1,000 SYNTHETIC items to simulate a large database for load testing
  // We use synthetic vectors to save Gemini API costs (Free Tier limit: 15 req/min)
  console.log("🤖 Generating 1,000 synthetic items for background noise...");
  for (let i = 0; i < 1000; i++) {
    dummyWishes.push({
      name: `Synthetic Wishlist Item ${i}`,
      description: "Random noise to test vector search performance under load.",
      url: `https://example.com/item/${i}`,
      item_embedding: generateSyntheticEmbedding(),
      group_id: dummyGroupId,
      user_id: dummyUserId,
      is_inspo: false,
    });
  }

  // 3. Batch insert (Supabase best practice: insert in chunks of 500)
  console.log("🚀 Pushing batch inserts to Supabase...");
  let totalInserted = 0;
  for (let i = 0; i < dummyWishes.length; i += 500) {
    const chunk = dummyWishes.slice(i, i + 500);
    const { error: insertErr } = await supabase.from("wishes").insert(chunk);
    if (insertErr) {
      console.error("Failed to insert dummy data chunk:", insertErr);
      return;
    }
    totalInserted += chunk.length;
  }
  
  console.log(`✅ Successfully injected ${totalInserted} total items (3 real, 997 synthetic).\n`);

  let vectorMrrSum = 0;
  let hybridMrrSum = 0;

  for (const t of testQueries) {
    console.log(`Query: "${t.query}"`);
    const embedding = await getEmbedding(t.query);

    // 1. Pure Vector Search (simulated via match_wishes RPC if it still existed, or direct query)
    const { data: vectorData } = await supabase.rpc("match_wishes", {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: 5
    }); // Fallback handled by vectorData being null

    let vectorRank = 0;
    if (vectorData) {
      const idx = vectorData.findIndex((w: any) => w.url === t.expectedUrl);
      if (idx !== -1) vectorRank = idx + 1;
    }
    const vectorMrr = vectorRank > 0 ? 1 / vectorRank : 0;
    vectorMrrSum += vectorMrr;

    // 2. Hybrid Search (RRF)
    const { data: hybridData, error: hybridError } = await supabase.rpc("match_wishes_hybrid", {
      query_text: t.query,
      query_embedding: embedding,
      match_count: 5
    });

    if (hybridError) console.error("Hybrid Error:", hybridError); let hybridRank = 0;
    if (hybridData) {
      const idx = hybridData.findIndex((w: any) => w.url === t.expectedUrl);
      if (idx !== -1) hybridRank = idx + 1;
    }
    const hybridMrr = hybridRank > 0 ? 1 / hybridRank : 0;
    hybridMrrSum += hybridMrr;

    console.log(`  Vector Rank: ${vectorRank || 'Not Found'} (MRR: ${vectorMrr.toFixed(2)})`);
    console.log(`  Hybrid Rank: ${hybridRank || 'Not Found'} (MRR: ${hybridMrr.toFixed(2)})\n`);
  }

  console.log("📊 Results:");
  console.log(`Average Vector MRR@5: ${(vectorMrrSum / testQueries.length).toFixed(2)}`);
  console.log(`Average Hybrid MRR@5: ${(hybridMrrSum / testQueries.length).toFixed(2)}`);
  console.log(`Improvement: ${((hybridMrrSum - vectorMrrSum) / (vectorMrrSum || 1) * 100).toFixed(0)}%\n`);

  console.log("🧹 Cleaning up dummy data...");
  const { error: deleteWishesErr } = await supabase
    .from("wishes")
    .delete()
    .eq("group_id", dummyGroupId);
  
  const { error: deleteGroupErr } = await supabase
    .from("groups")
    .delete()
    .eq("id", dummyGroupId);
  
  if (deleteWishesErr || deleteGroupErr) {
    console.error("Failed to clean up dummy data:", deleteWishesErr || deleteGroupErr);
  } else {
    console.log("✅ Successfully removed dummy items.");
  }
}

runBenchmark().catch(console.error);
