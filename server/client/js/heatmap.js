// ==========================================
// IntelliRoute Heat Map (PS 01)
// ==========================================

const API_URL = (window.location.origin && window.location.origin.startsWith("http")) ? `${window.location.origin}/api` : "http://localhost:5000/api";

const map = L.map("map").setView([31.2536, 75.7033], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap Contributors",
    maxZoom: 19
}).addTo(map);

const junctionCoordinates = {
    1: [31.2536, 75.7033],
    2: [31.2550, 75.7052],
    3: [31.2565, 75.7070],
    4: [31.2580, 75.7090],
    5: [31.2600, 75.7110]
};

async function loadHeatMap() {
    try {
        const response = await fetch(`${API_URL}/roads`);
        const data = await response.json();

        if (!data.success) {
            alert("Unable to load roads.");
            return;
        }

        data.roads.forEach(road => {
            const start = junctionCoordinates[road.source_junction];
            const end = junctionCoordinates[road.destination_junction];
            if (!start || !end) return;

            let color = "#22c55e";
            if (road.road_status === "CLOSED") {
                color = "#6b7280";
            } else if (road.traffic_level === "HIGH") {
                color = "#ef4444";
            } else if (road.traffic_level === "MEDIUM") {
                color = "#facc15";
            }

            L.polyline([start, end], {
                color: color,
                weight: 8,
                opacity: 0.9
            })
            .addTo(map)
            .bindPopup(`
                <div style="font-family:sans-serif;">
                    <h4 style="margin:0 0 4px; color:#0f172a;">${road.road_name}</h4>
                    <p style="margin:2px 0;"><strong>Traffic Level:</strong> ${road.traffic_level}</p>
                    <p style="margin:2px 0;"><strong>Road Status:</strong> ${road.road_status}</p>
                    <p style="margin:2px 0;"><strong>Distance:</strong> ${road.distance} km</p>
                    <p style="margin:2px 0;"><strong>Avg Travel Time:</strong> ${road.travel_time} mins</p>
                </div>
            `);
        });

        // Also fetch active incidents and pin them on the heatmap
        const incResp = await fetch(`${API_URL}/incidents`);
        const incData = await incResp.json();
        if (incData.success) {
            incData.incidents.forEach(inc => {
                if (inc.status === 'RESOLVED') return;
                const jCoord = junctionCoordinates[inc.source_junction] || [31.2536, 75.7033];
                const lat = Number(inc.latitude || jCoord[0]) + 0.0003;
                const lng = Number(inc.longitude || jCoord[1]) + 0.0003;

                L.marker([lat, lng], {
                    icon: L.divIcon({
                        html: `<div style="background:#ef4444; color:white; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:13px; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid #fff;">⚠️</div>`,
                        className: 'heat-incident-pin',
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    })
                })
                .addTo(map)
                .bindPopup(`<b>⚠️ Incident: ${inc.incident_type} (${inc.severity})</b><br>${inc.description}`);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

loadHeatMap();
