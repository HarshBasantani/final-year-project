import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function escapeCSV(val: string): string {
  if (val.includes('"') || val.includes(",") || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

const DOMAIN_POOLS = [
  "science, physics, chemistry, biology",
  "world history, ancient civilizations, modern history",
  "geography, countries, capitals, rivers, mountains",
  "technology, programming, computers, AI, internet",
  "medicine, anatomy, diseases, pharmacology",
  "literature, famous authors, classic novels, poetry",
  "mathematics, algebra, geometry, calculus, statistics",
  "economics, finance, trade, currencies",
  "law, constitutions, international law, human rights",
  "sports, Olympics, football, cricket, athletics",
  "astronomy, space exploration, planets, stars",
  "music, composers, instruments, genres",
  "philosophy, ethics, logic, famous philosophers",
  "engineering, architecture, bridges, inventions",
  "environmental science, climate, ecology, conservation",
];

async function generateBatch(
  aiHeaders: Record<string, string>,
  label: string,
  count: number,
  batchSize: number,
  globalOffset: number
): Promise<{ question: string; answer: string; label: string }[]> {
  const results: { question: string; answer: string; label: string }[] = [];
  const batches = Math.ceil(count / batchSize);

  const labelInstructions: Record<string, string> = {
    Accurate: `Generate EXACTLY {COUNT} factual question-answer pairs. Each answer MUST be 100% factually correct with real, verifiable information. Cover diverse topics.`,
    "Partially Hallucinated": `Generate EXACTLY {COUNT} question-answer pairs where each answer is PARTIALLY incorrect. Mix real facts with 1-2 subtle errors (wrong dates, slightly wrong numbers, misattributed discoveries, confused names). The errors should be plausible but verifiably wrong.`,
    Hallucinated: `Generate EXACTLY {COUNT} question-answer pairs where each answer is COMPLETELY fabricated or severely wrong. Include invented facts, fictional events presented as real, entirely wrong attributions, made-up statistics, or nonsensical claims stated confidently.`,
  };

  // Run batches with concurrency limit to avoid rate limits
  const CONCURRENCY = 3;
  const batchIndices = Array.from({ length: batches }, (_, i) => i);

  for (let c = 0; c < batchIndices.length; c += CONCURRENCY) {
    const chunk = batchIndices.slice(c, c + CONCURRENCY);
    const promises = chunk.map(async (b) => {
      const remaining = Math.min(batchSize, count - b * batchSize);
      if (remaining <= 0) return [];

      const startIdx = globalOffset + b * batchSize + 1;
      const domainSet = DOMAIN_POOLS[(b + globalOffset) % DOMAIN_POOLS.length];
      const instruction = labelInstructions[label].replace("{COUNT}", String(remaining));

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: aiHeaders,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `You generate QA datasets for hallucination detection research.
${instruction}

Focus on these domains: ${domainSet}.

Respond with ONLY a valid JSON array, no markdown, no explanation. Each item:
{"id": <number>, "question": "<specific question>", "answer": "<1-3 sentence answer>"}

Start IDs from ${startIdx}. Generate exactly ${remaining} items. Keep answers concise (1-3 sentences). Make questions specific, factual, and diverse — avoid vague or opinion-based questions. Every question must be unique.`,
                },
                {
                  role: "user",
                  content: `Generate ${remaining} ${label.toLowerCase()} QA pairs. IDs start at ${startIdx}. Domains: ${domainSet}. Batch ${b + 1}/${batches}.`,
                },
              ],
            }),
          });

          if (!response.ok) {
            console.error(`Batch ${b + 1} for ${label} failed (attempt ${attempt + 1}):`, response.status);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "[]";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);

          return parsed.map((item: { question: string; answer: string }) => ({
            question: item.question,
            answer: item.answer,
            label,
          }));
        } catch (e) {
          console.error(`Error batch ${b + 1} for ${label} (attempt ${attempt + 1}):`, e);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      return [];
    });

    const batchResults = await Promise.all(promises);
    for (const br of batchResults) {
      results.push(...br);
    }
    console.log(`${label}: ${results.length}/${count} generated so far...`);
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const total = Math.min(body.total || 450, 15000);
    const format = body.format || "csv";

    // Distribution: 50% hallucinated, 37.5% partial, 12.5% accurate
    const hallucinatedCount = Math.round(total * 0.5);
    const partialCount = Math.round(total * 0.375);
    const accurateCount = total - hallucinatedCount - partialCount;

    const batchSize = Math.min(body.batch_size || 40, 50);

    const aiHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    console.log(`Generating ${total} samples: ${hallucinatedCount} hallucinated, ${partialCount} partial, ${accurateCount} accurate (batch size: ${batchSize})...`);

    // Generate all 3 categories in parallel
    const [accurate, partial, hallucinated] = await Promise.all([
      generateBatch(aiHeaders, "Accurate", accurateCount, batchSize, 0),
      generateBatch(aiHeaders, "Partially Hallucinated", partialCount, batchSize, accurateCount),
      generateBatch(aiHeaders, "Hallucinated", hallucinatedCount, batchSize, accurateCount + partialCount),
    ]);

    const allData = [...accurate, ...partial, ...hallucinated];
    // Shuffle
    for (let i = allData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allData[i], allData[j]] = [allData[j], allData[i]];
    }

    const numbered = allData.map((item, idx) => ({ id: idx + 1, ...item }));

    console.log(`Generated ${numbered.length} total: ${accurate.length} accurate, ${partial.length} partial, ${hallucinated.length} hallucinated`);

    if (format === "json") {
      return new Response(
        JSON.stringify({
          total: numbered.length,
          distribution: {
            accurate: accurate.length,
            partially_hallucinated: partial.length,
            hallucinated: hallucinated.length,
          },
          data: numbered,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CSV format
    const csvLines = ["id,question,answer,label"];
    for (const row of numbered) {
      csvLines.push(
        `${row.id},${escapeCSV(row.question)},${escapeCSV(row.answer)},${escapeCSV(row.label)}`
      );
    }
    const csv = csvLines.join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=hallucination_dataset_${numbered.length}.csv`,
      },
    });
  } catch (e) {
    console.error("Dataset generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
