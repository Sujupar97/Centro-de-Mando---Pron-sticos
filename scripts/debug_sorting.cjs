
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const TEAM_ID = 9; // Man City

async function testSort(label, params) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('participant_id', TEAM_ID);
    url.searchParams.set('per_page', '5');

    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        const data = json.data || [];

        console.log(`\n--- TEST: ${label} ---`);
        if (data.length > 0) {
            console.log(`First Match: ${data[0].name} (${data[0].starting_at})`);
            console.log(`Last Match:  ${data[data.length - 1].name} (${data[data.length - 1].starting_at})`);
        } else {
            console.log("No data returned");
        }
    } catch (e) { console.error(e); }
}

async function runTests() {
    // Current approach
    await testSort("Current (order=starting_at, sort=desc)", { order: 'starting_at', sort: 'desc' });

    // Hypothesis 1: 'order' parameter name is different
    // Docs say 'order' field is usually 'starting_at', but maybe direction is part of it?

    // Hypothesis 2: 'sort_by'
    await testSort("Sort By param", { sort_by: 'starting_at', order: 'desc' });

    // Hypothesis 3: Just 'desc' without key? No.

    // Hypothesis 4: V3 syntax `sort` = `starting_at.desc` ?? (Like some APIs)
    // Actually, looking at V3 docs: It's often `filters`. But for sorting...
    // Let's try to remove 'order' and just use 'sort' map?

    // Wait, let's try just NO sort (default)
    await testSort("Default (No Sort)", {});

    // Test: order=desc (assuming default field is starting_at)
    await testSort("Order=desc", { order: 'desc' });

    // Test: sort=starting_at (maybe default is asc)
    // V3 documentation often mentions 'include' but sorting on `fixtures/between` or `fixtures` endpoint.
    // The `fixtures` endpoint documentation says:
    // "You can sort the response by using the `order` parameter."
    // "The value of the order parameter should be the field name you want to sort by."
    // "To sort in descending order, prepend the field name with a minus sign `-`." 
    // OR "To sort in descending order, add direction?"

    // Let's try the minus sign syntax common in modern APIs
    await testSort("Minus Sign (-starting_at)", { order: '-starting_at' });

    // Let's try `direction` param
    await testSort("Direction Param", { order: 'starting_at', direction: 'desc' });
}

runTests();
