// ==========================================
// IntelliRoute - Route Finder & Multi-Factor Comparator (PS 01)
// ==========================================

const API_URL = "http://localhost:5000/api";

// Load Junctions
async function loadJunctions() {
    try {
        const response = await fetch(`${API_URL}/dashboard/junctions`);
        const data = await response.json();

        if (!data.success) {
            alert("Unable to load junctions.");
            return;
        }

        const source = document.getElementById("source");
        const destination = document.getElementById("destination");

        source.innerHTML = "";
        destination.innerHTML = "";

        data.junctions.forEach((j, index) => {
            const opt1 = document.createElement("option");
            opt1.value = j.junction_id;
            opt1.textContent = `Junction ${j.junction_id}: ${j.junction_name || 'Junction ' + j.junction_id}`;
            source.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = j.junction_id;
            opt2.textContent = `Junction ${j.junction_id}: ${j.junction_name || 'Junction ' + j.junction_id}`;
            destination.appendChild(opt2);
        });

        // Set default source=1 and destination=5
        if (data.junctions.length >= 5) {
            source.value = 1;
            destination.value = 5;
        }
    } catch (err) {
        console.error(err);
    }
}

// Compare & Rank Routes
async function findRoute() {
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

        // 1. Recommendation Banner
        const recBanner = document.getElementById("recBanner");
        recBanner.style.display = "block";
        document.getElementById("recTitle").textContent = data.recommended_route ? data.recommended_route.route_type : "Optimal Path";
        document.getElementById("recRationale").textContent = data.recommendation_rationale;

        // 2. Comparison Grid
        const compGrid = document.getElementById("comparisonGrid");
        compGrid.style.display = "grid";

        if (data.shortest_route) {
            document.getElementById("shortestPath").textContent = data.shortest_route.path_display;
            document.getElementById("shortestDist").textContent = `${data.shortest_route.distance_km} km`;
            document.getElementById("shortestEta").textContent = `${data.shortest_route.eta_minutes} mins`;
            document.getElementById("shortestFuel").textContent = `${data.shortest_route.estimated_fuel_liters} L`;
            document.getElementById("shortestRel").textContent = data.shortest_route.reliability_score;
        }

        if (data.fastest_route) {
            document.getElementById("fastestPath").textContent = data.fastest_route.path_display;
            document.getElementById("fastestDist").textContent = `${data.fastest_route.distance_km} km`;
            document.getElementById("fastestEta").textContent = `${data.fastest_route.eta_minutes} mins`;
            document.getElementById("fastestFuel").textContent = `${data.fastest_route.estimated_fuel_liters} L`;
            document.getElementById("fastestRel").textContent = data.fastest_route.reliability_score;
        }

        // 3. Multi-Factor Ranking Table
        const rankingSection = document.getElementById("rankingSection");
        const tbody = document.getElementById("rankingTableBody");
        rankingSection.style.display = "block";
        tbody.innerHTML = "";

        data.ranked_options.forEach((opt, idx) => {
            const isTop = idx === 0;
            tbody.innerHTML += `
            <tr style="border-bottom:1px solid #f1f5f9; ${isTop ? 'background:#f0fdf4; font-weight:600;' : ''}">
                <td style="padding:10px;"><span style="background:${isTop ? '#22c55e' : '#94a3b8'}; color:white; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">#${idx + 1}</span></td>
                <td style="padding:10px; color:${isTop ? '#15803d' : '#0f172a'};">${opt.route_type}</td>
                <td style="padding:10px; font-size:12.5px;">${opt.path_display}</td>
                <td style="padding:10px;">${opt.distance_km} km</td>
                <td style="padding:10px;">${opt.eta_minutes} mins</td>
                <td style="padding:10px;">${opt.estimated_fuel_liters} L</td>
                <td style="padding:10px;"><span style="color:#10b981;">${opt.reliability_score}</span></td>
                <td style="padding:10px;"><strong style="color:#2563eb;">${opt.multi_factor_rank_score}</strong></td>
            </tr>
            `;
        });

    } catch (err) {
        console.error(err);
        alert("Server error occurred while calculating routes.");
    }
}

window.onload = () => {
    loadJunctions();
};
