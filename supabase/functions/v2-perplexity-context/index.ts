// supabase/functions/v2-perplexity-context/index.ts
// External Context Engine: Uses Perplexity API to gather recent news, injuries, lineup info
// Called in parallel with ETL data fetching from v2-create-job-sportmonks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const PERPLEXITY_MODEL = 'sonar';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { home_team, away_team, competition, date } = await req.json();

        if (!home_team || !away_team) {
            throw new Error('home_team and away_team are required');
        }

        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (!perplexityKey) {
            console.warn('[Perplexity] API key not configured, returning empty context');
            return new Response(JSON.stringify({
                success: false,
                error: 'PERPLEXITY_API_KEY not configured',
                context: null
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[Perplexity] Fetching context for: ${home_team} vs ${away_team} (${competition}, ${date})`);

        // Build the query for Perplexity - single comprehensive query
        const query = `Give me the latest news and updates about the upcoming football match between ${home_team} and ${away_team} in ${competition || 'their league'}${date ? ` scheduled for ${date}` : ''}.

I need the following information in a structured format:

1. HOME TEAM (${home_team}) RECENT NEWS:
   - Any injury updates or player availability concerns (last 7 days)
   - Manager/coach quotes or press conference statements
   - Recent form and morale indicators
   - Any transfer news or squad changes

2. AWAY TEAM (${away_team}) RECENT NEWS:
   - Any injury updates or player availability concerns (last 7 days)
   - Manager/coach quotes or press conference statements
   - Recent form and morale indicators
   - Any transfer news or squad changes

3. MATCH PREVIEW:
   - Expert predictions or analysis from reputable sources
   - Key narratives or storylines for this match
   - Any historical context relevant to this specific matchup
   - Tactical expectations

Please be specific and cite actual recent news. If you cannot find recent information about a topic, say so rather than making assumptions.`;

        const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: PERPLEXITY_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a sports journalism researcher. Provide factual, recent news about football teams and matches. Focus on information that would be relevant for match analysis: injuries, lineups, team morale, tactical approaches, and competitive context. Always be specific about dates and sources when possible.'
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1
            })
        });

        if (!perplexityRes.ok) {
            const errText = await perplexityRes.text();
            console.error(`[Perplexity] API error ${perplexityRes.status}: ${errText}`);
            return new Response(JSON.stringify({
                success: false,
                error: `Perplexity API error: ${perplexityRes.status}`,
                context: null
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const perplexityJson = await perplexityRes.json();
        const rawContent = perplexityJson.choices?.[0]?.message?.content || '';
        const citations = perplexityJson.citations || [];

        console.log(`[Perplexity] Response received: ${rawContent.length} chars, ${citations.length} citations`);

        // Structure the response
        const context = {
            raw_text: rawContent,
            citations: citations,
            home_team: home_team,
            away_team: away_team,
            competition: competition,
            fetched_at: new Date().toISOString()
        };

        return new Response(JSON.stringify({
            success: true,
            context,
            tokens_used: perplexityJson.usage?.total_tokens || 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e: any) {
        console.error('[Perplexity] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            context: null
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
