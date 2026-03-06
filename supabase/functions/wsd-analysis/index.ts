import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, ai_response } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!ai_response || !question) {
      return new Response(
        JSON.stringify({ error: "Both 'question' and 'ai_response' are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Step 1: Entity Extraction (WordNet-inspired)
    const entityPromise = fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "extract_entities",
            description: "Extract named entities and key concepts from text, with their intended meanings.",
            parameters: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string", description: "The entity or concept" },
                      type: { type: "string", enum: ["person", "place", "organization", "date", "number", "concept", "event", "other"] },
                      intended_sense: { type: "string", description: "The meaning/sense used in context" },
                      alternative_senses: {
                        type: "array",
                        items: { type: "string" },
                        description: "Other possible meanings (WordNet-style synsets)"
                      },
                      sense_correct: { type: "boolean", description: "Whether the intended sense is used correctly in context" },
                      confidence: { type: "number", description: "Confidence 0-1 that the sense is correct" }
                    },
                    required: ["text", "type", "intended_sense", "alternative_senses", "sense_correct", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["entities"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_entities" } },
        messages: [
          {
            role: "system",
            content: `You are a Word Sense Disambiguation (WSD) module inspired by WordNet and contextual embeddings (BERT).
Your task is to extract key entities and concepts from an AI response, determine their intended sense/meaning in context, list alternative senses (like WordNet synsets), and evaluate whether the correct sense is being used.
Focus on entities where ambiguity could lead to factual errors or hallucinations.`
          },
          {
            role: "user",
            content: `Question: "${question}"\n\nAI Response to analyze:\n"${ai_response}"`
          }
        ]
      }),
    });

    // Step 2: Semantic Consistency Analysis (BERT-inspired embedding comparison)
    const semanticPromise = fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "analyze_semantics",
            description: "Analyze semantic consistency of the AI response.",
            parameters: {
              type: "object",
              properties: {
                question_response_alignment: {
                  type: "number",
                  description: "How well the response addresses the question (0-1)"
                },
                internal_coherence: {
                  type: "number",
                  description: "Internal logical consistency of the response (0-1)"
                },
                semantic_inconsistencies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string", description: "The inconsistent claim" },
                      issue: { type: "string", description: "What makes it semantically inconsistent" },
                      severity: { type: "string", enum: ["low", "medium", "high"] }
                    },
                    required: ["claim", "issue", "severity"],
                    additionalProperties: false
                  }
                },
                context_drift_score: {
                  type: "number",
                  description: "How much the response drifts from the original question context (0=on-topic, 1=completely off-topic)"
                },
                factual_density: {
                  type: "number",
                  description: "Ratio of verifiable claims to total statements (0-1)"
                }
              },
              required: ["question_response_alignment", "internal_coherence", "semantic_inconsistencies", "context_drift_score", "factual_density"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_semantics" } },
        messages: [
          {
            role: "system",
            content: `You are a semantic analysis module that simulates BERT-style contextual embedding comparison.
Evaluate the AI response for:
1. Question-response alignment: Does the response actually answer what was asked?
2. Internal coherence: Are all claims logically consistent with each other?
3. Semantic inconsistencies: Identify specific claims that are semantically problematic.
4. Context drift: Does the response stay on topic or wander?
5. Factual density: What proportion of statements are verifiable factual claims?`
          },
          {
            role: "user",
            content: `Question: "${question}"\n\nAI Response to analyze:\n"${ai_response}"`
          }
        ]
      }),
    });

    const [entityRes, semanticRes] = await Promise.all([entityPromise, semanticPromise]);

    if (!entityRes.ok || !semanticRes.ok) {
      if (entityRes.status === 429 || semanticRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (entityRes.status === 402 || semanticRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("WSD analysis error:", entityRes.status, semanticRes.status);
      throw new Error("WSD analysis gateway error");
    }

    const entityData = await entityRes.json();
    const semanticData = await semanticRes.json();

    // Parse tool call responses
    let entities = [];
    let semantics = {
      question_response_alignment: 0.5,
      internal_coherence: 0.5,
      semantic_inconsistencies: [],
      context_drift_score: 0.5,
      factual_density: 0.5,
    };

    try {
      const entityArgs = entityData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (entityArgs) entities = JSON.parse(entityArgs).entities || [];
    } catch { console.error("Failed to parse entity extraction"); }

    try {
      const semArgs = semanticData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (semArgs) semantics = JSON.parse(semArgs);
    } catch { console.error("Failed to parse semantic analysis"); }

    // Compute aggregate WSD score
    const entityScores = entities.map((e: any) => e.sense_correct ? e.confidence : 1 - e.confidence);
    const avgEntityScore = entityScores.length > 0
      ? entityScores.reduce((a: number, b: number) => a + b, 0) / entityScores.length
      : 0.5;

    const wsd_score = (
      avgEntityScore * 0.3 +
      semantics.question_response_alignment * 0.25 +
      semantics.internal_coherence * 0.25 +
      (1 - semantics.context_drift_score) * 0.2
    );

    return new Response(
      JSON.stringify({
        wsd_score: Math.round(wsd_score * 1000) / 1000,
        entities,
        semantic_analysis: semantics,
        disambiguation_summary: {
          total_entities: entities.length,
          ambiguous_entities: entities.filter((e: any) => e.alternative_senses.length > 1).length,
          misused_senses: entities.filter((e: any) => !e.sense_correct).length,
          inconsistency_count: semantics.semantic_inconsistencies?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("WSD Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
