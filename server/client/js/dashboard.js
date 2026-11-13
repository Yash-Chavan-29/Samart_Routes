// ==========================================
// IntelliRoute Dashboard (PS 01 Intelligent Traffic Management)
// ==========================================

const API_URL = "http://localhost:5000/api";

// Live Clock
function updateClock() {
    const now = new Date();
    const liveTimeEl = document.getElementById("liveTime");
    if (liveTimeEl) liveTimeEl.innerHTML = now.toLocaleString();
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// Dashboard Summary Cards
// ==========================================
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/summary`);
        const data = await response.json();
        if (!data.success) return;

        document.getElementById("totalRoads").innerHTML = data.summary.total_roads;
        document.getElementById("openRoads").innerHTML = data.summary.open_roads;
        document.getElementById("closedRoads").innerHTML = data.summary.closed_roads;
        document.getElementById("highTraffic").innerHTML = data.summary.high_traffic;
        document.getElementById("lowTraffic").innerHTML = data.summary.low_traffic;
    } catch (err) {
        console.error("Dashboard Error:", err);
    }
}

// ==========================================
// Road Details Table
// ==========================================
async function loadRoads() {
    try {
        const response = await fetch(`${API_URL}/roads`);
        const data = await response.json();
        if (!data.success) return;

        const table = document.getElementById("roadTable");
        const select = document.getElementById("modalRoadSelect");
        table.innerHTML = "";
        if (select) select.innerHTML = "";

        data.roads.forEach((road) => {
            const statusColor = road.road_status === "OPEN" ? "#10b981" : "#ef4444";
            const trafficColor = road.traffic_level === "HIGH" ? "#ef4444" : road.traffic_level === "MEDIUM" ? "#f59e0b" : "#10b981";

            table.innerHTML += `
            <tr>
                <td><strong>#${road.road_id}</strong></td>
                <td><strong>${road.road_name}</strong> (J${road.source_junction} ➔ J${road.destination_junction})</td>
                <td><span style="color:${trafficColor}; font-weight:700; background:${trafficColor}15; padding:3px 8px; border-radius:4px;">${road.traffic_level}</span></td>
                <td><span style="color:${statusColor}; font-weight:700; background:${statusColor}15; padding:3px 8px; border-radius:4px;">${road.road_status}</span></td>
                <td>
                    <button onclick="analyzeImpact(${road.road_id})" style="background:#0284c7; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-diagram-project"></i> Analyze Impact
                    </button>
                </td>
            </tr>
            `;

            if (select) {
                select.innerHTML += `<option value="${road.road_id}">Road #${road.road_id}: ${road.road_name}</option>`;
            }
        });
    } catch (err) {
        console.error("Road Error:", err);
    }
}

// ==========================================
// Adaptive Traffic Signals (PS 01 Mandatory Feature)
// ==========================================
async function loadSignals() {
    try {
        const response = await fetch(`${API_URL}/signals`);
        const data = await response.json();
        if (!data.success) return;

        const signalContainer = document.getElementById("signals");
        signalContainer.innerHTML = "";

        data.signals.forEach((item) => {
            const color = item.current_signal === "GREEN" ? "#10b981" : item.current_signal === "YELLOW" ? "#f59e0b" : "#ef4444";

            signalContainer.innerHTML += `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:15px; box-shadow:0 2px 6px rgba(0,0,0,0.05); text-align:center;">
                <h4 style="margin-bottom:6px; color:#0f172a;">Junction ${item.junction_id}: ${item.junction_name}</h4>
                <div style="display:inline-block; width:16px; height:16px; border-radius:50%; background:${color}; margin-right:6px; vertical-align:middle;"></div>
                <span style="color:${color}; font-weight:700; font-size:15px;">${item.current_signal}</span>
                <p style="margin:8px 0; font-size:13px; color:#64748b;">Cycle Timer: <strong>${item.timer}s</strong></p>
                <button onclick="optimizeSignal(${item.junction_id})" style="background:#10b981; color:white; border:none; padding:6px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px; width:100%;">
                    ⚡ Optimize Timer
                </button>
            </div>
            `;
        });
    } catch (err) {
        console.error("Signal Error:", err);
    }
}

async function optimizeSignal(junctionId) {
    try {
        const response = await fetch(`${API_URL}/signals/optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ junction_id: junctionId, vehicle_density: 50, queue_length: 22 })
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || "Optimization failed");
            return;
        }

        const banner = document.getElementById("signalOptBanner");
        banner.style.display = "block";
        banner.innerHTML = `
            <strong>⚡ Adaptive Signal Optimization Successful for ${data.junction_name}!</strong><br>
            • Green Phase adjusted: <strong>${data.before_optimization.signal_timer_seconds}s ➔ ${data.after_optimization.optimized_green_timer_seconds}s</strong><br>
            • Queue Waiting Time: reduced from <strong>${data.before_optimization.average_waiting_time_seconds}s to ${data.after_optimization.average_waiting_time_seconds}s</strong> (Delay Reduction: <strong>${data.comparison.waiting_time_reduction_percentage}</strong>)<br>
            • Throughput: <strong>${data.comparison.traffic_throughput_gain}</strong>
        `;

        await loadSignals();
    } catch (err) {
        console.error("Signal optimization failed:", err);
    }
}

// ==========================================
// Reported Incidents & Admin Review (PS 01)
// ==========================================
async function loadIncidents() {
    try {
        const response = await fetch(`${API_URL}/incidents`);
        const data = await response.json();
        if (!data.success) return;

        const table = document.getElementById("incidentsTable");
        if (!table) return;

        if (data.incidents.length === 0) {
            table.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:15px;">No incidents currently reported. Roads are clear.</td></tr>`;
            return;
        }

        table.innerHTML = "";
        data.incidents.forEach((inc) => {
            const sevColor = inc.severity === "CRITICAL" ? "#ef4444" : inc.severity === "HIGH" ? "#f97316" : inc.severity === "MEDIUM" ? "#f59e0b" : "#10b981";
            const statColor = inc.status === "RESOLVED" ? "#10b981" : inc.status === "VERIFIED" ? "#f59e0b" : "#3b82f6";
            const timeStr = new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            table.innerHTML += `
            <tr>
                <td><strong>#${inc.incident_id}</strong></td>
                <td>${inc.road_name || 'Road #' + inc.road_id}</td>
                <td><span style="font-weight:600;">${inc.incident_type}</span></td>
                <td><span style="background:${sevColor}15; color:${sevColor}; padding:3px 8px; border-radius:4px; font-weight:700; font-size:12px;">${inc.severity}</span></td>
                <td><span style="background:${statColor}15; color:${statColor}; padding:3px 8px; border-radius:4px; font-weight:700; font-size:12px;">${inc.status}</span></td>
                <td style="font-size:12.5px; max-width:240px;">${inc.description || 'No description provided'}</td>
                <td style="font-size:12px; color:#64748b;">${timeStr}</td>
                <td style="white-space:nowrap;">
                    ${inc.status !== 'VERIFIED' && inc.status !== 'RESOLVED' ? `<button onclick="updateIncidentStatus(${inc.incident_id}, 'VERIFIED')" style="background:#f59e0b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-right:4px;">Verify</button>` : ''}
                    ${inc.status !== 'RESOLVED' ? `<button onclick="updateIncidentStatus(${inc.incident_id}, 'RESOLVED')" style="background:#10b981; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-right:4px;">Resolve</button>` : '<span style="color:#10b981; font-weight:600; font-size:12px;">Cleared</span>'}
                    <button onclick="analyzeImpact(${inc.road_id})" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Impact</button>
                </td>
            </tr>
            `;
        });
    } catch (err) {
        console.error("Incidents load error:", err);
    }
}

async function updateIncidentStatus(id, newStatus) {
    try {
        const response = await fetch(`${API_URL}/incidents/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await response.json();
        if (data.success) {
            await refreshDashboard();
        } else {
            alert(data.message || "Status update failed");
        }
    } catch (err) {
        console.error("Status update error:", err);
    }
}

// Modal controls
function openIncidentModal() {
    const m = document.getElementById("incidentModal");
    if (m) m.style.display = "flex";
}
function closeIncidentModal() {
    const m = document.getElementById("incidentModal");
    if (m) m.style.display = "none";
}

async function submitIncident(e) {
    e.preventDefault();
    const road_id = document.getElementById("modalRoadSelect").value;
    const incident_type = document.getElementById("modalIncidentType").value;
    const description = document.getElementById("modalDescription").value;
    const reported_by = document.getElementById("modalReporter").value || "Citizen";

    try {
        const response = await fetch(`${API_URL}/incidents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ road_id, incident_type, description, reported_by })
        });
        const data = await response.json();
        closeIncidentModal();

        if (data.is_duplicate) {
            alert(`ℹ️ Duplicate Detection Alert:\n${data.message}`);
        } else {
            alert(`✅ Incident Reported Successfully!\nAssessed Severity: ${data.severity}\nStatus: OPEN (Diversions active if road is closed)`);
        }

        document.getElementById("modalDescription").value = "";
        await refreshDashboard();
    } catch (err) {
        alert("Failed to report incident: " + err.message);
    }
}

// ==========================================
// Network Impact & Diversion Analysis (PS 01)
// ==========================================
async function analyzeImpact(roadId) {
    const modal = document.getElementById("impactModal");
    const body = document.getElementById("impactModalBody");
    if (modal) modal.style.display = "flex";
    if (body) body.innerHTML = "<p>Running graph reachability & network spillover analysis...</p>";

    try {
        const response = await fetch(`${API_URL}/incidents/impact/${roadId}`);
        const data = await response.json();

        if (!data.success) {
            body.innerHTML = `<p style="color:#ef4444;">Error: ${data.message}</p>`;
            return;
        }

        const sim = data.simulated_closure;
        body.innerHTML = `
            <div style="margin-bottom:14px; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                <h4 style="color:#0f172a; margin-bottom:4px;">Target Segment: Road #${data.road.road_id} (${data.road.road_name})</h4>
                <p style="font-size:13px; color:#64748b;">Direct Distance: ${data.road.distance} km | Direct Travel Time: ${data.road.travel_time} mins</p>
            </div>

            <h4 style="margin:12px 0 6px; color:#1e293b;">Connected Neighboring Roads Affected:</h4>
            <ul style="list-style:none; padding:0; margin-bottom:15px;">
                ${data.affected_connected_roads.map(cr => `
                    <li style="padding:6px 10px; margin-bottom:5px; background:#fff; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; display:flex; justify-content:space-between;">
                        <span><strong>${cr.road_name}</strong> (via Junction ${cr.connected_at})</span>
                        <span style="color:${cr.predicted_spillover_risk === 'CRITICAL' ? '#ef4444' : '#f59e0b'}; font-weight:700;">${cr.predicted_spillover_risk} Spillover</span>
                    </li>
                `).join('')}
            </ul>

            <div style="padding:14px; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe;">
                <h4 style="color:#1e40af; margin-bottom:6px;"><i class="fa-solid fa-route"></i> Graph-Based Diversion Recommendation</h4>
                <p style="font-size:13.5px; color:#1e3a8a; font-weight:600; margin-bottom:4px;">
                    ${sim.diversion_available ? `Alternate Route: Junctions ${sim.diversion_route.join(' ➔ ')}` : '⚠️ Complete Bottleneck: No alternate paths reachable!'}
                </p>
                ${sim.diversion_available ? `
                    <p style="font-size:13px; color:#3b82f6;">Diversion Distance: ${sim.diversion_distance} km | Expected Delay: +${sim.delay_penalty_minutes} mins</p>
                ` : ''}
                <div style="margin-top:8px; font-size:12.5px; background:#fff; padding:8px 12px; border-radius:6px; color:#0f172a; font-weight:500;">
                    <strong>Action:</strong> ${sim.recommended_action}
                </div>
            </div>
        `;
    } catch (err) {
        body.innerHTML = `<p style="color:#ef4444;">Failed to analyze impact: ${err.message}</p>`;
    }
}

function closeImpactModal() {
    const modal = document.getElementById("impactModal");
    if (modal) modal.style.display = "none";
}

// ==========================================
// Charts
// ==========================================
let trafficChart;
let roadChart;

async function loadCharts() {
    try {
        const response = await fetch(`${API_URL}/dashboard/summary`);
        const data = await response.json();
        if (!data.success) return;

        const summary = data.summary;

        if (trafficChart) trafficChart.destroy();
        const ctxTraffic = document.getElementById("trafficChart");
        if (ctxTraffic) {
            trafficChart = new Chart(ctxTraffic, {
                type: "pie",
                data: {
                    labels: ["Low Traffic", "High Traffic"],
                    datasets: [{
                        data: [Number(summary.low_traffic), Number(summary.high_traffic)],
                        backgroundColor: ["#10b981", "#ef4444"]
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: "bottom" } } }
            });
        }

        if (roadChart) roadChart.destroy();
        const ctxRoad = document.getElementById("roadChart");
        if (ctxRoad) {
            roadChart = new Chart(ctxRoad, {
                type: "bar",
                data: {
                    labels: ["Open Roads", "Closed Roads"],
                    datasets: [{
                        label: "Road Count",
                        data: [Number(summary.open_roads), Number(summary.closed_roads)],
                        backgroundColor: ["#3b82f6", "#ef4444"]
                    }]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true } } }
            });
        }
    } catch (err) {
        console.error("Charts error:", err);
    }
}

// ==========================================
// Refresh Dashboard
// ==========================================
async function refreshDashboard() {
    await loadDashboard();
    await loadRoads();
    await loadSignals();
    await loadIncidents();
    await loadCharts();
}

window.onload = () => {
    refreshDashboard();
};

setInterval(refreshDashboard, 15000);
