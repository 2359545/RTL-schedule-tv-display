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

function calculateTime(startTime, delay) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const arrivalDate = new Date();
    arrivalDate.setHours(hours);
    arrivalDate.setMinutes(minutes + Math.floor(delay / 60) + (delay % 60));
    return arrivalDate;
}

function calculateDepartureTime(arrivalTime, stopDuration) {
    const departureDate = new Date(arrivalTime);
    departureDate.setMinutes(departureDate.getMinutes() + stopDuration); // Assuming stopDuration is in minutes
    return departureDate;
}

app.get('/bus-schedule/:routeId/:stopId?', async (req, res) => {
    const { routeId, stopId } = req.params;

    try {
        const response = await fetch(tripUpdateUrl);
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        const busUpdates = feed.entity.filter(entity =>
            entity.tripUpdate && entity.tripUpdate.trip.routeId === routeId
        );

        const scheduleEntries = [];
        const currentTime = new Date();

        console.log(`Bus Updates for Route ID ${routeId}:`, busUpdates);

        busUpdates.forEach(entity => {
            entity.tripUpdate.stopTimeUpdate.forEach(stop => {
                const startTime = entity.tripUpdate.trip.startTime;
                const arrivalTime = calculateTime(startTime, stop.arrival.delay);
                const stopDuration = stop.departure ? stop.departure.delay : 0; // Assuming you can retrieve this, adjust as needed
                const departureTime = calculateDepartureTime(arrivalTime, stopDuration);

                if (arrivalTime >= currentTime) {
                    if (!stopId || stop.stopId === stopId) {
                        scheduleEntries.push({
                            routeId,
                            stopId: stop.stopId,
                            arrivalTime,
                            departureTime
                        });
                    }
                }
            });
        });

        scheduleEntries.sort((a, b) => a.arrivalTime - b.arrivalTime);

        console.log('Schedule Entries:', scheduleEntries);

        res.json(scheduleEntries);
    } catch (error) {
        console.error('Error fetching or decoding Protobuf data:', error);
        res.status(500).json({ error: 'Failed to fetch bus schedule data' });
    }
});

app.get('/stops/:routeId', async (req, res) => {
    const { routeId } = req.params;

    try {
        const response = await fetch(tripUpdateUrl);
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        const stops = new Set();
        feed.entity.forEach(entity => {
            if (entity.tripUpdate && entity.tripUpdate.trip.routeId === routeId) {
                entity.tripUpdate.stopTimeUpdate.forEach(stop => {
                    stops.add(stop.stopId);
                });
            }
        });

        const sortedStops = Array.from(stops).sort((a, b) => a.localeCompare(b));
        res.json(sortedStops);
    } catch (error) {
        console.error('Error fetching or decoding Protobuf data:', error);
        res.status(500).json({ error: 'Failed to fetch stops data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
