const db = require("../config/db");
const { buildGraph } = require("../services/graphService");
const dijkstra = require("../algorithms/dijkstra");

// ============================================
// 1. Fetch All Incidents (with Road Details)
// ============================================
const getIncidents = (req, res) => {
    const sql = `
        SELECT 
            i.incident_id,
            i.road_id,
            r.road_name,
            r.source_junction,
            r.destination_junction,
            r.road_status,
            i.incident_type,
            i.severity,
            i.description,
            i.reported_by,
            i.status,
            i.reported_at,
            COALESCE(i.latitude, j.latitude) AS latitude,
            COALESCE(i.longitude, j.longitude) AS longitude
        FROM incidents i
        LEFT JOIN roads r ON i.road_id = r.road_id
        LEFT JOIN junctions j ON r.source_junction = j.junction_id
        ORDER BY i.reported_at DESC
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.status(200).json({ success: true, count: rows.length, incidents: rows });
    });
};

// ============================================
// 2. Report Incident + Duplicate Detection & Severity
// ============================================
const reportIncident = (req, res) => {
    const { road_id, incident_type, description, reported_by, latitude, longitude } = req.body;

    if (!road_id || !incident_type) {
        return res.status(400).json({
            success: false,
            message: "Road ID and Incident Type are required."
        });
    }

    // Step A: Duplicate Detection (Same road & type within last 30 minutes)
    const dupCheckSql = `
        SELECT incident_id, severity, status, reported_at 
        FROM incidents 
        WHERE road_id = ? 
          AND incident_type = ? 
          AND status != 'RESOLVED'
          AND reported_at >= NOW() - INTERVAL 30 MINUTE
        LIMIT 1
    `;

    db.query(dupCheckSql, [road_id, incident_type], (err, duplicates) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        if (duplicates && duplicates.length > 0) {
            const existing = duplicates[0];
            return res.status(200).json({
                success: true,
                is_duplicate: true,
                duplicate_of: existing.incident_id,
                message: `Duplicate report detected for Road #${road_id}. Merged with existing active Incident #${existing.incident_id}.`,
                incident: existing
            });
        }

        // Step B: Intelligent Severity Estimation
        let calculatedSeverity = "MEDIUM";
        const descUpper = (description || "").toUpperCase();

        if (incident_type === "ACCIDENT") {
            if (descUpper.includes("FATAL") || descUpper.includes("MAJOR") || descUpper.includes("FIRE") || descUpper.includes("PILEUP")) {
                calculatedSeverity = "CRITICAL";
            } else {
                calculatedSeverity = "HIGH";
            }
        } else if (incident_type === "ROADBLOCK") {
            calculatedSeverity = "HIGH";
        } else if (incident_type === "CONGESTION") {
            if (descUpper.includes("GRIDLOCK") || descUpper.includes("HEAVY") || descUpper.includes("JAM")) {
                calculatedSeverity = "HIGH";
            } else {
                calculatedSeverity = "MEDIUM";
            }
        } else if (incident_type === "HAZARD") {
            calculatedSeverity = "MEDIUM";
        }

        // Step C: Insert into database
        const insertSql = `
            INSERT INTO incidents 
            (road_id, incident_type, severity, description, reported_by, status, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, 'REPORTED', ?, ?)
        `;

        const reporter = reported_by || "Citizen / Sensor";

        db.query(insertSql, [road_id, incident_type, calculatedSeverity, description || "", reporter, latitude || null, longitude || null], (insErr, result) => {
            if (insErr) {
                return res.status(500).json({ success: false, message: insErr.message });
            }

            const newIncidentId = result.insertId;

            // Step D: Network Impact Action - Automatically adjust road status if Critical/High
            if (calculatedSeverity === "CRITICAL" || incident_type === "ROADBLOCK") {
                db.query("UPDATE roads SET road_status = 'CLOSED', traffic_level = 'HIGH' WHERE road_id = ?", [road_id]);
            } else if (calculatedSeverity === "HIGH") {
                db.query("UPDATE roads SET traffic_level = 'HIGH' WHERE road_id = ?", [road_id]);
            }

            res.status(201).json({
                success: true,
                is_duplicate: false,
                incident_id: newIncidentId,
                severity: calculatedSeverity,
                message: `Incident reported successfully. Severity assessed as ${calculatedSeverity}.`
            });
        });
    });
};

// ============================================
// 3. Admin Update Incident Status (VERIFY / RESOLVE)
// ============================================
const updateIncidentStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["REPORTED", "VERIFIED", "RESOLVED"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status." });
    }

    db.query("SELECT road_id FROM incidents WHERE incident_id = ?", [id], (findErr, rows) => {
        if (findErr || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Incident not found." });
        }

        const roadId = rows[0].road_id;

        db.query("UPDATE incidents SET status = ? WHERE incident_id = ?", [status, id], (upErr) => {
            if (upErr) {
                return res.status(500).json({ success: false, message: upErr.message });
            }

            // If resolved, verify whether any other active incidents exist on this road before reopening
            if (status === "RESOLVED") {
                db.query("SELECT COUNT(*) AS activeCount FROM incidents WHERE road_id = ? AND status != 'RESOLVED'", [roadId], (cErr, cRows) => {
                    if (!cErr && cRows[0].activeCount === 0) {
                        db.query("UPDATE roads SET road_status = 'OPEN', traffic_level = 'LOW' WHERE road_id = ?", [roadId]);
                    }
                });
            } else if (status === "VERIFIED") {
                db.query("UPDATE roads SET traffic_level = 'HIGH' WHERE road_id = ?", [roadId]);
            }

            res.status(200).json({
                success: true,
                message: `Incident #${id} marked as ${status}.`
            });
        });
    });
};

// ============================================
// 4. Graph-Based Network Impact Analysis
// ============================================
const analyzeNetworkImpact = (req, res) => {
    const roadId = Number(req.params.roadId);

    db.query("SELECT * FROM roads WHERE road_id = ?", [roadId], (rErr, rRows) => {
        if (rErr || rRows.length === 0) {
            return res.status(404).json({ success: false, message: "Road not found." });
        }

        const targetRoad = rRows[0];
        const src = Number(targetRoad.source_junction);
        const dest = Number(targetRoad.destination_junction);

        // Find connected neighboring roads
        db.query(
            "SELECT * FROM roads WHERE road_id != ? AND (source_junction IN (?, ?) OR destination_junction IN (?, ?))",
            [roadId, src, dest, src, dest],
            (cErr, connectedRoads) => {
                if (cErr) {
                    return res.status(500).json({ success: false, message: cErr.message });
                }

                // Simulate closure and compute alternative diversion route using Dijkstra
                buildGraph((gErr, fullGraph) => {
                    if (gErr) {
                        return res.status(500).json({ success: false, message: gErr.message });
                    }

                    // Build graph without the affected road to simulate closure
                    db.query("SELECT * FROM roads WHERE road_id != ?", [roadId], (simErr, otherRoads) => {
                        const simGraph = {};
                        otherRoads.forEach((r) => {
                            if (r.road_status === "CLOSED") return;
                            const s = Number(r.source_junction);
                            const d = Number(r.destination_junction);
                            if (!simGraph[s]) simGraph[s] = [];
                            if (!simGraph[d]) simGraph[d] = [];
                            const dist = Number(r.distance);
                            const time = Number(r.travel_time);
                            const w = dist * 0.7 + time * 0.3;
                            simGraph[s].push({ node: d, weight: w });
                            simGraph[d].push({ node: s, weight: w });
                        });

                        const diversion = dijkstra(simGraph, src, dest);
                        const isReachable = diversion.distance !== Infinity && diversion.path.length > 0;

                        res.status(200).json({
                            success: true,
                            road: targetRoad,
                            affected_connected_roads: connectedRoads.map(cr => ({
                                road_id: cr.road_id,
                                road_name: cr.road_name,
                                connected_at: (cr.source_junction === src || cr.source_junction === dest) ? cr.source_junction : cr.destination_junction,
                                predicted_spillover_risk: cr.traffic_level === "HIGH" ? "CRITICAL" : "ELEVATED"
                            })),
                            simulated_closure: {
                                direct_distance: targetRoad.distance,
                                direct_time: targetRoad.travel_time,
                                diversion_available: isReachable,
                                diversion_route: isReachable ? diversion.path : [],
                                diversion_distance: isReachable ? Number(diversion.distance.toFixed(2)) : null,
                                delay_penalty_minutes: isReachable ? Number((diversion.distance * 2 - targetRoad.travel_time).toFixed(1)) : null,
                                recommended_action: isReachable ? `Divert traffic along junctions ${diversion.path.join(" ➔ ")}` : "Emergency bottleneck: No alternate path available! Priority clearance required."
                            }
                        });
                    });
                });
            }
        );
    });
};

module.exports = {
    getIncidents,
    reportIncident,
    updateIncidentStatus,
    analyzeNetworkImpact
};
