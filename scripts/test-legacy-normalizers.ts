// scripts/test-legacy-normalizers.ts
import {
    normalizeLegacyEvents,
    normalizeLegacyStatistics,
    normalizeLegacyLineups
} from '../supabase/functions/_shared/sportmonks-normalizer.ts';

// MOCK DATA
const mockFixture = {
    id: 12345,
    participants: [
        { id: 10, name: 'Home FC', image_path: 'home.png', meta: { location: 'home' } },
        { id: 20, name: 'Away United', image_path: 'away.png', meta: { location: 'away' } }
    ],
    statistics: [
        { participant_id: 10, type_id: 42, type: { name: 'Shots Total' }, data: { value: 15 } },
        { participant_id: 20, type_id: 56, type: { name: 'Fouls' }, data: { value: 8 } }
    ],
    events: [
        { minute: 12, extra_minute: null, participant_id: 10, player_id: 101, player_name: 'Striker H', type: { name: 'Goal' } },
        { minute: 45, extra_minute: 2, participant_id: 20, player_id: 202, player_name: 'Defender A', type: { name: 'Yellow Card' } }
    ],
    lineups: [
        { team_id: 10, player_id: 101, player_name: 'Striker H', type_id: 11, jersey_number: 9, position: { code: 'F' } },
        { team_id: 20, player_id: 202, player_name: 'Defender A', type: { code: 'starting-xi' }, jersey_number: 4, position: { code: 'D' } }
    ],
    formations: [
        { participant_id: 10, formation: '4-3-3' },
        { participant_id: 20, formation: '4-4-2' }
    ]
};

console.log('--- TESTING LEGACY NORMALIZERS ---');

try {
    const stats = normalizeLegacyStatistics(mockFixture, 10, 20);
    console.log('STATS (Home shoud have 1, Away 1):');
    console.log(JSON.stringify(stats, null, 2));

    const events = normalizeLegacyEvents(mockFixture);
    console.log('\nEVENTS (Should produce 2 events):');
    console.log(JSON.stringify(events, null, 2));

    const lineups = normalizeLegacyLineups(mockFixture, 10, 20);
    console.log('\nLINEUPS (Should produce 2 lineups):');
    console.log(JSON.stringify(lineups, null, 2));

    console.log('\n--- SUCCESS ---');
} catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
}
