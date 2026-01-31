
// Script para diagnosticar paginación de SportMonks
import { writeFileSync } from 'fs';

const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5'; // Token usado previamente
const BASE_URL = 'https://api.sportmonks.com/v3/football';
const DATE = '2026-01-30'; // Fecha futura con partidos (o una pasada con muchos)

async function checkPagination() {
    console.log(`Checking pagination for date ${DATE}...`);

    const url = new URL(`${BASE_URL}/fixtures/date/${DATE}`);
    url.searchParams.set('api_token', API_KEY);

    // Request small page size to force pagination
    url.searchParams.set('per_page', 2);

    try {
        const res = await fetch(url.toString());
        const json = await res.json();

        console.log('--- RESPONSE STRUCTURE ---');
        console.log('Keys:', Object.keys(json));
        if (json.pagination) console.log('Pagination Object:', json.pagination);
        if (json.meta) console.log('Meta Object:', json.meta);

        writeFileSync('scripts/output_pagination.txt', JSON.stringify(json, null, 2));
        console.log('Output saved to scripts/output_pagination.txt');

    } catch (e) {
        console.error('Error:', e);
    }
}

checkPagination();
