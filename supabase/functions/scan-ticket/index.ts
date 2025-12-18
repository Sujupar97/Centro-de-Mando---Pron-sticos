import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

// Declare Deno for TypeScript
declare const Deno: any;

Deno.serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { image } = await req.json()

        if (!image) {
            throw new Error("No image data provided.")
        }

        // Initialize Supabase Client to verify user
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            throw new Error("Authentication failed.")
        }

        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAiKey) {
            throw new Error("Configuration Error: OPENAI_API_KEY is missing.")
        }

        // Call OpenAI GPT-4o
        const strats = [
            {
                role: "system",
                content: `You are an expert sports betting assistant. Your task is to extract structured data from an image of a betting ticket.
            
            Extract the following fields and return ONLY a valid JSON object:
            - date: Date of the bet (YYYY-MM-DD format). If year is missing, assume current year or upcoming.
            - time: Time of the bet (HH:MM format).
            - event: Main event name (e.g., "Real Madrid vs Barcelona").
            - market: Type of bet (e.g., "Match Winner", "Over 2.5 Goals").
            - selection: What was gathered/selected (e.g., "Real Madrid", "Over").
            - stake: Amount brewed/wagered (number).
            - odds: Odds (decimal format).
            - potential_payout: Potential return (number).
            - bookmaker: Name of the betting site/app (e.g., "Bet365", "Codere").
            - status: "pending" by default unless explicitly "won" or "lost".
            - type: "single" or "parlay".
            - legs: Array of objects if it's a parlay. Each leg should have:
                - sport: Sport name (e.g. "Soccer", "Tennis").
                - date: Date of event.
                - event: Event name.
                - market: Market name.
                - selection: Selection.
                - odds: Leg odds.
                - status: Leg status.

            If some fields are missing or unclear, try to infer reasonably or set to null.
            Ensure keys are exactly as requested. Do not include markdown formatting like \`\`\`json. Just the raw JSON string.`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Extract data from this ticket." },
                    {
                        type: "image_url",
                        image_url: {
                            url: image, // Supports base64 data url or public http url
                        },
                    },
                ],
            }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: strats,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI API Error:", err);
            throw new Error("Failed to process image with AI provider.");
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Clean up markdown if present (just in case)
        const jsonStr = content.replace(/```json\n?|```/g, "").trim();
        let extractedData;
        try {
            extractedData = JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON Parse Error:", content);
            throw new Error("Failed to parse AI response.");
        }

        return new Response(JSON.stringify(extractedData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("Error in scan-ticket:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
