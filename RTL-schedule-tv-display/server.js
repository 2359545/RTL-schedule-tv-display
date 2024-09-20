import express from 'express';
import fetch from 'node-fetch';
import pkg from 'gtfs-realtime-bindings';
const { transit_realtime } = pkg;

const app = express();
const PORT = 3000;

app.use(express.static('public'));

const apiToken = 'KJBEH7YA0L';
const agencyCode = 'RTL';
const tripUpdateUrl = `https://opendata.exo.quebec/ServiceGTFSR/TripUpdate.pb?token=${apiToken}&agency=${agencyCode}`;

app.get('/bus-schedule', async (req, res) => {
    try {
        const response = await fetch(tripUpdateUrl);
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        const bus83Updates = feed.entity.filter(entity =>
            entity.tripUpdate && entity.tripUpdate.trip.routeId === '8'
        );

        res.json(bus83Updates);
    } catch (error) {
        console.error('Error fetching or decoding Protobuf data:', error);
        res.status(500).json({ error: 'Failed to fetch bus schedule data' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
