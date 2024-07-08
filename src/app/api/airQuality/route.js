import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import axios from 'axios';

const client = createClient({
    password: process.env.NEXT_PUBLIC_REDIS_DB_PW,
    socket: {
        host: 'redis-17023.c60.us-west-1-2.ec2.redns.redis-cloud.com',
        port: 17023
    }
});

client.connect();

const AIRNOW_API_KEY = process.env.NEXT_PUBLIC_AIRNOW_API_KEY;
const AIRNOW_ENDPOINT = 'http://www.airnowapi.org/aq/observation/zipCode/current/';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode');

    if (!zipCode) {
        return NextResponse.json({ error: 'Zip code is required' }, { status: 400 });
    }

    const cacheKey = `airnow:${zipCode}`;

    try {
        const cachedData = await client.get(cacheKey);

        if (cachedData) {
            return NextResponse.json(JSON.parse(cachedData));
        } else {
            const params = {
                format: 'application/json',
                zipCode: zipCode,
                distance: '25',
                API_KEY: AIRNOW_API_KEY
            };
            const response = await axios.get(AIRNOW_ENDPOINT, { params });

            if (response.status === 200) {
                const data = response.data;
                await client.setEx(cacheKey, 3600, JSON.stringify(data));
                return NextResponse.json(data);
            } else {
                return NextResponse.json({ error: 'Error fetching data from AirNow API' }, { status: response.status });
            }
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
