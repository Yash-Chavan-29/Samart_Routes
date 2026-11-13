// ==========================================
// IntelliRoute Live Map (PS 01: Routes & Incidents)
// ==========================================

const API_URL = "http://localhost:5000/api";

const map = L.map("map").setView([31.2536, 75.7033], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap Contributors"
}).addTo(map);

// Junction Coordinates (Phagwara / LPU Region)
const junctionCoordinates = {
    1: [31.2536, 75.7033],
    2: [31.2550, 75.7052],
    3: [31.2565, 75.7070],
    4: [31.2580, 75.7090],
    5: [31.2600, 75.7110]
};

let fastestRouteLine = null;
let shortestRouteLine = null;
let sourceMarker = null;
let destinationMarker = null;
let vehicleMarker = null;
let animationInterval = null;
let incidentLayerGroup = L.layerGroup().addTo(map);
let riskLayerGroup = L.layerGroup().addTo(map);

// Load Incidents and display as warning markers on map (PS 01 Requirement)
async function loadMapIncidents() {
    incidentLayerGroup.clearLayers();
    try {
        const response = await fetch(`${API_URL}/incidents`);
        const data = await response.json();
        if (!data.success) return;

        data.incidents.forEach(inc => {
            if (inc.status === 'RESOLVED') return;

            const iconHtml = inc.incident_type === 'ACCIDENT' ? '💥' : inc.incident_type === 'ROADBLOCK' ? '🚧' : '🚦';
            const jCoord = junctionCoordinates[inc.source_junction] || [31.2536, 75.7033];

            // Offset slightly so it doesn't overlap junction marker exactly
            const lat = Number(inc.latitude || jCoord[0]) + (Math.random() - 0.5) * 0.001;
            const lng = Number(inc.longitude || jCoord[1]) + (Math.random() - 0.5) * 0.001;

            const customIcon = L.divIcon({
                html: `<div style="background:#ef4444; color:white; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,0.4); border:2px solid white;">${iconHtml}</div>`,
                className: 'incident-map-pin',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(incidentLayerGroup);
            marker.bindPopup(`
                <div style="font-family:sans-serif; min-width:180px;">
                    <h4 style="color:#ef4444; margin:0 0 4px;">⚠️ ${inc.incident_type} (${inc.severity})</h4>
                    <p style="margin:0 0 6px; font-size:12.5px;"><strong>Location:</strong> ${inc.road_name || 'Road #' + inc.road_id}</p>
                    <p style="margin:0 0 6px; font-size:12px; color:#475569;">${inc.description || 'Active incident reported'}</p>
                    <span style="font-size:11px; background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:700;">Status: ${inc.status}</span>
                </div>
            `);
        });
    } catch (e) {
        console.error("Failed to load map incidents:", e);
    }
}

// Display Base Junction Markers
function renderJunctions() {
    Object.keys(junctionCoordinates).forEach(id => {
        L.circleMarker(junctionCoordinates[id], {
            radius: 8,
            color: "#3b82f6",
            fillColor: "#60a5fa",
            fillOpacity: 0.9,
            weight: 2
        })
        .addTo(map)
        .bindPopup(`<b>Junction ${id}</b>`);
    });
}
renderJunctions();

// Load Junctions in dropdown
async function loadJunctions() {
    try {
        const response = await fetch(`${API_URL}/dashboard/junctions`);
        const data = await response.json();
        if (!data.success) return;

        const source = document.getElementById("source");
        const destination = document.getElementById("destination");
        source.innerHTML = "";
        destination.innerHTML = "";

        data.junctions.forEach(j => {
            source.innerHTML += `<option value="${j.junction_id}">Junction ${j.junction_id}</option>`;
            destination.innerHTML += `<option value="${j.junction_id}">Junction ${j.junction_id}</option>`;
        });

        if (data.junctions.length >= 5) {
            source.value = 1;
            destination.value = 5;
        }
    } catch (err) {
        console.error(err);
    }
}

// Draw Route (Calculates & Compares Routes on Map)
async function drawRoute() {
    const source = Number(document.getElementById("source").value);
    const destination = Number(document.getElementById("destination").value);

    if (source === destination) {
        alert("Source and Destination cannot be the same junction.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/routes/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, destination })
        });
        const data = await response.json();

        if (!data.success) {
            alert(data.message || "Route search failed.");
            return;
        }

        // Clean up previous layers
        if (fastestRouteLine) map.removeLayer(fastestRouteLine);
        if (shortestRouteLine) map.removeLayer(shortestRouteLine);
        if (sourceMarker) map.removeLayer(sourceMarker);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (vehicleMarker) map.removeLayer(vehicleMarker);
        if (animationInterval) clearInterval(animationInterval);

        const fastestPath = data.fastest_route.path_junction_ids;
        const shortestPath = data.shortest_route.path_junction_ids;

        const fastestCoords = fastestPath.map(id => junctionCoordinates[id]);
        const shortestCoords = shortestPath.map(id => junctionCoordinates[id]);

        // Draw Shortest Route (Blue Dashed)
        shortestRouteLine = L.polyline(shortestCoords, {
            color: "#3b82f6",
            dashArray: "8, 8",
            weight: 5,
            opacity: 0.7
        }).addTo(map);

        // Draw Fastest / Recommended Route (Green Solid)
        fastestRouteLine = L.polyline(fastestCoords, {
            color: "#10b981",
            weight: 7,
            opacity: 0.95
        }).addTo(map);

        // Source & Destination Markers
        sourceMarker = L.circleMarker(junctionCoordinates[source], {
            radius: 11,
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 1
        }).addTo(map).bindPopup(`<b>🟢 Source: Junction ${source}</b>`);

        destinationMarker = L.circleMarker(junctionCoordinates[destination], {
            radius: 11,
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 1
        }).addTo(map).bindPopup(`<b>🔴 Destination: Junction ${destination}</b>`);

        // Animated Vehicle
        vehicleMarker = L.marker(fastestCoords[0], {
            icon: L.divIcon({
                html: `<div style="font-size:22px;">🚗</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(map);

        let step = 0;
        animationInterval = setInterval(() => {
            step++;
            if (step >= fastestCoords.length) {
                clearInterval(animationInterval);
                vehicleMarker.bindPopup("<b>Destination Reached!</b>").openPopup();
                return;
            }
            vehicleMarker.setLatLng(fastestCoords[step]);
        }, 1200);

        map.fitBounds(fastestRouteLine.getBounds().pad(0.2));

        alert(`✅ Route Comparison Calculated:
• Fastest Route (Green): ${data.fastest_route.distance_km} km | ETA: ${data.fastest_route.eta_minutes} mins (Reliability: ${data.fastest_route.reliability_score})
• Shortest Route (Blue Dashed): ${data.shortest_route.distance_km} km | ETA: ${data.shortest_route.eta_minutes} mins
${data.recommendation_rationale ? '\n💡 ' + data.recommendation_rationale : ''}`);

    } catch (err) {
        console.error(err);
        alert("Server error calculating route.");
    }
}

window.onload = () => {
    loadJunctions();
    loadMapIncidents();
};
