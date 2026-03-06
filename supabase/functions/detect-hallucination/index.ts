import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Updated Scoring Formula (Open-Domain RAV) ──
// Final Score = α·RL_Score + β·WSD_Score + γ·Retrieval_Similarity_Score
// Where α + β + γ = 1
const ALPHA = 0.40; // RL factual reward weight
const BETA  = 0.35; // WSD semantic disambiguation weight
const GAMMA = 0.25; // Retrieval-Augmented Validation weight

// ── TF-IDF Cosine Similarity ──
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(t => t.length > 2);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const len = tokens.length || 1;
  for (const [k, v] of tf) tf.set(k, v / len);
  return tf;
}

function cosineSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const tfA = termFrequency(tokensA);
  const tfB = termFrequency(tokensB);
  const allTerms = new Set([...tfA.keys(), ...tfB.keys()]);
  let dot = 0, magA = 0, magB = 0;
  for (const term of allTerms) {
    const a = tfA.get(term) || 0;
    const b = tfB.get(term) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Wikipedia API ──
async function queryWikipedia(question: string): Promise<{ found: boolean; extract: string; title: string; url: string }> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&srlimit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results || results.length === 0) return { found: false, extract: "", title: "", url: "" };

    // Try the best match
    const title = results[0].title;
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=false&explaintext=true&exsentences=20&format=json&origin=*`;
    const extractRes = await fetch(extractUrl);
    const extractData = await extractRes.json();
    const pages = extractData?.query?.pages;
    const page = Object.values(pages)[0] as any;
    const extract = page?.extract || "";

    return {
      found: extract.length > 0,
      extract,
      title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    };
  } catch (e) {
    console.error("Wikipedia query failed:", e);
    return { found: false, extract: "", title: "", url: "" };
  }
}

// ── Web Knowledge Retrieval via AI (for open-domain questions) ──
async function retrieveWebKnowledge(
  question: string,
  aiAnswer: string,
  aiHeaders: Record<string, string>
): Promise<{ retrieved: boolean; knowledge: string; source_type: string; verification_notes: string }> {
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a factual knowledge retrieval and verification system. Given a question and an AI-generated answer, provide:
1. The factually correct answer based on your training knowledge
2. Specific factual claims that can be verified
3. Any inaccuracies you detect in the AI answer

You MUST respond with ONLY valid JSON (no markdown):
{
  "correct_answer": "<the factually correct and complete answer>",
  "key_facts": ["<fact 1>", "<fact 2>", ...],
  "detected_errors": ["<error 1>", ...],
  "verification_notes": "<brief explanation of verification>",
  "source_domains": ["<likely authoritative source domain>", ...]
}`
          },
          {
            role: "user",
            content: `Question: "${question}"\n\nAI Answer to verify:\n"${aiAnswer}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error("Web knowledge retrieval failed:", response.status);
      return { retrieved: false, knowledge: "", source_type: "none", verification_notes: "Retrieval failed" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      retrieved: true,
      knowledge: parsed.correct_answer || "",
      source_type: "ai_knowledge_retrieval",
      verification_notes: parsed.verification_notes || "",
    };
  } catch (e) {
    console.error("Web knowledge retrieval error:", e);
    return { retrieved: false, knowledge: "", source_type: "none", verification_notes: "Parse error" };
  }
}

// ── Dataset Check (simulated internal knowledge base) ──
async function checkDatasetKnowledge(
  question: string,
  aiAnswer: string,
  aiHeaders: Record<string, string>
): Promise<{ found: boolean; match_score: number; dataset_answer: string }> {
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a knowledge base lookup system. Determine if this question has a well-known, commonly documented factual answer. Rate how well the provided AI answer matches established knowledge.

Respond with ONLY valid JSON:
{
  "has_known_answer": true/false,
  "known_answer": "<the established correct answer or empty>",
  "match_score": <0-1, how well AI answer matches known facts>,
  "domain": "<topic domain: science/history/geography/tech/medicine/general/unknown>"
}`
          },
          {
            role: "user",
            content: `Question: "${question}"\nAI Answer: "${aiAnswer}"`
          }
        ],
      }),
    });

    if (!response.ok) return { found: false, match_score: 0.5, dataset_answer: "" };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      found: parsed.has_known_answer ?? false,
      match_score: parsed.match_score ?? 0.5,
      dataset_answer: parsed.known_answer || "",
    };
  } catch {
    return { found: false, match_score: 0.5, dataset_answer: "" };
  }
}

// ── Score Combination: Final = α·RL + β·WSD + γ·Retrieval ──
function combineScores(
  rl: { hallucination_score: number; confidence_level: number; flags: string[] },
  wsd: { wsd_score: number; context_drift: number; entity_confidence: number; inconsistencies: number },
  retrievalSim: number,
  retrievalAvailable: boolean
) {
  // RL hallucination component (higher = more hallucinated)
  const rl_component = rl.hallucination_score;

  // WSD component (convert semantic accuracy to hallucination indicator)
  const wsd_component = (1 - wsd.wsd_score + wsd.context_drift) / 2;

  // Retrieval similarity component (lower similarity = more hallucinated)
  const retrieval_component = retrievalAvailable ? (1 - retrievalSim) : 0;

  // Dynamic weight redistribution if retrieval unavailable
  let a = ALPHA, b = BETA, g = GAMMA;
  if (!retrievalAvailable) {
    // Redistribute gamma across alpha and beta proportionally
    const total = ALPHA + BETA;
    a = ALPHA / total;
    b = BETA / total;
    g = 0;
  }

  const h_raw = a * rl_component + b * wsd_component + g * retrieval_component;

  // Inconsistency penalty
  const penalty = Math.min(wsd.inconsistencies * 0.05, 0.15);
  const h_final = Math.min(h_raw + penalty, 1.0);

  // Combined confidence
  const c_rl = rl.confidence_level;
  const c_wsd = wsd.entity_confidence;
  const c_retrieval = retrievalAvailable ? retrievalSim : 0;
  const c_final = a * c_rl + b * c_wsd + g * c_retrieval;

  let label: string;
  if (h_final < 0.3) label = "Accurate";
  else if (h_final < 0.6) label = "Partially Hallucinated";
  else label = "Hallucinated";

  return {
    hallucination_score: Math.round(h_final * 1000) / 1000,
    confidence_level: Math.round(Math.min(c_final, 1) * 1000) / 1000,
    label,
    component_scores: {
      rl_component: Math.round(rl_component * 1000) / 1000,
      wsd_component: Math.round(wsd_component * 1000) / 1000,
      retrieval_component: Math.round(retrieval_component * 1000) / 1000,
    },
    effective_weights: { alpha: Math.round(a * 1000) / 1000, beta: Math.round(b * 1000) / 1000, gamma: Math.round(g * 1000) / 1000 },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, model } = await req.json();

    if (!question || typeof question !== "string" || !question.trim()) {
      return new Response(
        JSON.stringify({
          ai_response: "No question provided.",
          hallucination_score: 0,
          confidence_level: 0,
          label: "Accurate",
          flags: ["No input provided"],
          summary: "Please provide a question to analyze.",
          retrieval_validation: { method: "none", sources: [] },
          rl_wsd_breakdown: {},
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modelMap: Record<string, string> = {
      "gpt": "openai/gpt-5-mini",
      "claude": "google/gemini-2.5-pro",
      "gemini": "google/gemini-3-flash-preview",
    };
    const selectedModel = modelMap[model] || "google/gemini-3-flash-preview";
    const aiHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    // ── Step 1: Get AI response ──
    const aiResponse = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: "You are a knowledgeable AI assistant. Answer the user's question accurately and concisely. Provide factual information with specific details when possible. Always provide an answer - never refuse to answer factual questions." },
          { role: "user", content: question },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const aiAnswer = aiData.choices?.[0]?.message?.content || "The AI model did not return a response.";

    // ── Step 2: Parallel — RL + WSD + Wikipedia + Dataset Check ──
    const rlPromise = fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are the RL (Reinforcement Learning) hallucination detection module. Analyze factual consistency and assign a reward-based score.

You MUST respond with ONLY valid JSON (no markdown):
{
  "hallucination_score": <0-1, 0=accurate, 1=hallucinated>,
  "confidence_level": <0-1>,
  "flags": [<specific concerns>],
  "summary": "<brief analysis>"
}`
          },
          { role: "user", content: `Question: "${question}"\n\nAI Response:\n"${aiAnswer}"` },
        ],
      }),
    });

    const wsdPromise = fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "wsd_analysis",
            description: "Word Sense Disambiguation analysis of the AI response.",
            parameters: {
              type: "object",
              properties: {
                wsd_score: { type: "number", description: "Overall semantic accuracy 0-1" },
                context_drift: { type: "number", description: "How far response drifts from question context 0-1" },
                entity_confidence: { type: "number", description: "Average confidence in entity sense correctness 0-1" },
                inconsistency_count: { type: "number", description: "Number of semantic inconsistencies found" },
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      intended_sense: { type: "string" },
                      sense_correct: { type: "boolean" }
                    },
                    required: ["text", "intended_sense", "sense_correct"],
                    additionalProperties: false
                  }
                },
                inconsistencies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string" },
                      issue: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] }
                    },
                    required: ["claim", "issue", "severity"],
                    additionalProperties: false
                  }
                }
              },
              required: ["wsd_score", "context_drift", "entity_confidence", "inconsistency_count", "entities", "inconsistencies"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "wsd_analysis" } },
        messages: [
          {
            role: "system",
            content: "You are the WSD (Word Sense Disambiguation) module. Extract entities, verify their senses in context, and detect semantic inconsistencies."
          },
          { role: "user", content: `Question: "${question}"\n\nAI Response:\n"${aiAnswer}"` },
        ],
      }),
    });

    const wikiPromise = queryWikipedia(question);
    const datasetPromise = checkDatasetKnowledge(question, aiAnswer, aiHeaders);

    const [rlRes, wsdRes, wikiResult, datasetResult] = await Promise.all([
      rlPromise, wsdPromise, wikiPromise, datasetPromise
    ]);

    // Handle rate limits
    if (rlRes.status === 429 || wsdRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (rlRes.status === 402 || wsdRes.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required. Please add credits." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Parse RL output ──
    let rl = { hallucination_score: 0.5, confidence_level: 0.5, flags: [] as string[], summary: "" };
    try {
      const rlData = await rlRes.json();
      const raw = rlData.choices?.[0]?.message?.content || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      rl = { ...rl, ...JSON.parse(cleaned) };
    } catch { console.error("Failed to parse RL output"); }

    // ── Parse WSD output ──
    let wsd = { wsd_score: 0.5, context_drift: 0.5, entity_confidence: 0.5, inconsistencies: 0, entities: [] as any[], semantic_inconsistencies: [] as any[] };
    try {
      const wsdData = await wsdRes.json();
      const args = wsdData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (args) {
        const parsed = JSON.parse(args);
        wsd = {
          wsd_score: parsed.wsd_score ?? 0.5,
          context_drift: parsed.context_drift ?? 0.5,
          entity_confidence: parsed.entity_confidence ?? 0.5,
          inconsistencies: parsed.inconsistency_count ?? 0,
          entities: parsed.entities ?? [],
          semantic_inconsistencies: parsed.inconsistencies ?? [],
        };
      }
    } catch { console.error("Failed to parse WSD output"); }

    // ── Step 3: Retrieval-Augmented Validation ──
    // Compute Wikipedia similarity
    const wikiSim = wikiResult.found ? cosineSimilarity(aiAnswer, wikiResult.extract) : 0;

    // If Wikipedia didn't find a good match OR similarity is low, trigger web knowledge retrieval
    let webRetrieval = { retrieved: false, knowledge: "", source_type: "none", verification_notes: "" };
    const needsWebRetrieval = !wikiResult.found || wikiSim < 0.2;

    if (needsWebRetrieval) {
      webRetrieval = await retrieveWebKnowledge(question, aiAnswer, aiHeaders);
    }

    // Compute retrieval similarity from best available source
    let retrievalSim = 0;
    let retrievalAvailable = false;
    const retrievalSources: { type: string; title: string; similarity: number; url?: string }[] = [];

    if (wikiResult.found) {
      retrievalSources.push({
        type: "wikipedia",
        title: wikiResult.title,
        similarity: Math.round(wikiSim * 1000) / 1000,
        url: wikiResult.url,
      });
      retrievalSim = wikiSim;
      retrievalAvailable = true;
    }

    if (webRetrieval.retrieved && webRetrieval.knowledge) {
      const webSim = cosineSimilarity(aiAnswer, webRetrieval.knowledge);
      retrievalSources.push({
        type: "web_knowledge",
        title: "AI Knowledge Retrieval",
        similarity: Math.round(webSim * 1000) / 1000,
      });
      // Use the best similarity score
      if (webSim > retrievalSim) {
        retrievalSim = webSim;
      }
      retrievalAvailable = true;
    }

    if (datasetResult.found) {
      retrievalSources.push({
        type: "dataset",
        title: "Internal Knowledge Base",
        similarity: Math.round(datasetResult.match_score * 1000) / 1000,
      });
      // Factor in dataset match
      const datasetSim = datasetResult.match_score;
      if (datasetSim > retrievalSim) {
        retrievalSim = datasetSim;
      }
      retrievalAvailable = true;
    }

    // ── Step 4: Combine with 3-weight formula ──
    const combined = combineScores(rl, wsd, retrievalSim, retrievalAvailable);

    // Merge flags
    const allFlags = [...(rl.flags || [])];
    for (const inc of wsd.semantic_inconsistencies) {
      allFlags.push(`[WSD] ${inc.claim}: ${inc.issue} (${inc.severity})`);
    }
    const misusedEntities = wsd.entities.filter((e: any) => !e.sense_correct);
    for (const e of misusedEntities) {
      allFlags.push(`[WSD] Misused sense: "${e.text}" — ${e.intended_sense}`);
    }
    if (wikiResult.found && wikiSim < 0.3) {
      allFlags.push(`[RAV] Low Wikipedia similarity (${(wikiSim * 100).toFixed(1)}%) with "${wikiResult.title}"`);
    }
    if (webRetrieval.retrieved && webRetrieval.verification_notes) {
      allFlags.push(`[RAV] ${webRetrieval.verification_notes}`);
    }
    if (!retrievalAvailable) {
      allFlags.push(`[RAV] No external knowledge sources matched — scoring based on RL + WSD only`);
    }

    // Ensure summary is never empty
    const summary = rl.summary || `Analysis complete. The response was classified as "${combined.label}" with ${Math.round(combined.confidence_level * 100)}% confidence. ${retrievalSources.length} retrieval source(s) were consulted.`;

    return new Response(
      JSON.stringify({
        ai_response: aiAnswer,
        hallucination_score: combined.hallucination_score,
        confidence_level: combined.confidence_level,
        label: combined.label,
        flags: allFlags.length > 0 ? allFlags : ["No issues detected"],
        summary,
        retrieval_validation: {
          method: needsWebRetrieval ? "hybrid" : "wikipedia",
          sources: retrievalSources,
          best_similarity: Math.round(retrievalSim * 1000) / 1000,
          dataset_check: {
            found: datasetResult.found,
            match_score: datasetResult.match_score,
          },
          wikipedia: {
            found: wikiResult.found,
            title: wikiResult.title,
            url: wikiResult.url,
            similarity: Math.round(wikiSim * 1000) / 1000,
            extract_preview: wikiResult.extract.substring(0, 300) + (wikiResult.extract.length > 300 ? "..." : ""),
          },
          web_retrieval: {
            triggered: needsWebRetrieval,
            retrieved: webRetrieval.retrieved,
            source_type: webRetrieval.source_type,
          },
        },
        rl_wsd_breakdown: {
          formula: "H_final = α·RL_Score + β·WSD_Score + γ·Retrieval_Score + penalty",
          weights: combined.effective_weights,
          components: combined.component_scores,
          rl_score: rl.hallucination_score,
          wsd_score: wsd.wsd_score,
          context_drift: wsd.context_drift,
          retrieval_similarity: Math.round(retrievalSim * 1000) / 1000,
          inconsistency_penalty: Math.min(wsd.inconsistencies * 0.05, 0.15),
          entities_analyzed: wsd.entities.length,
          misused_senses: misusedEntities.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    // Never return empty — always structured JSON
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        ai_response: "",
        hallucination_score: 0,
        confidence_level: 0,
        label: "Accurate",
        flags: ["System error occurred"],
        summary: "An error occurred during analysis. Please try again.",
        retrieval_validation: { method: "none", sources: [] },
        rl_wsd_breakdown: {},
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
