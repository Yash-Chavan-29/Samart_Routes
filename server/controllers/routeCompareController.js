const db = require("../config/db");
const dijkstra = require("../algorithms/dijkstra");

// Multi-Factor Route Optimizer & Shortest vs Fastest Comparator
const compareAndRankRoutes = (req, res) => {
    const source = Number(req.body.source || req.query.source);
    const destination = Number(req.body.destination || req.query.destination);

    if (!source || !destination) {
        return res.status(400).json({
            success: false,
            message: "source and destination junction IDs are required."
        });
    }

    if (source === destination) {
        return res.status(400).json({
            success: false,
            message: "Source and Destination cannot be the same junction."
        });
    }

    // Fetch roads and junction names
    db.query("SELECT * FROM roads", (err, roads) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        db.query("SELECT junction_id, junction_name FROM junctions", (jErr, junctions) => {
            const junctionMap = {};
            (junctions || []).forEach(j => {
                junctionMap[j.junction_id] = j.junction_name;
            });

            // 1. Graph for Shortest Route (Pure Distance)
            const distGraph = {};
            // 2. Graph for Fastest Route (Congestion & Time Weighted)
            const timeGraph = {};
            // 3. Road lookup
            const roadLookup = {};

            roads.forEach(r => {
                const s = Number(r.source_junction);
                const d = Number(r.destination_junction);
                const dist = Number(r.distance);
                const time = Number(r.travel_time);

                roadLookup[`${s}-${d}`] = r;
                roadLookup[`${d}-${s}`] = r;

                // Build Distance Graph
                if (!distGraph[s]) distGraph[s] = [];
                if (!distGraph[d]) distGraph[d] = [];
                // Only consider open roads
                if (r.road_status !== "CLOSED") {
                    distGraph[s].push({ node: d, weight: dist });
                    distGraph[d].push({ node: s, weight: dist });
                }

                // Build Fastest / Congestion Weighted Graph
                if (!timeGraph[s]) timeGraph[s] = [];
                if (!timeGraph[d]) timeGraph[d] = [];
                if (r.road_status !== "CLOSED") {
                    let congestionMultiplier = 1.0;
                    if (r.traffic_level === "MEDIUM") congestionMultiplier = 1.4;
                    if (r.traffic_level === "HIGH") congestionMultiplier = 2.4;
                    const effectiveTimeWeight = time * congestionMultiplier;

                    timeGraph[s].push({ node: d, weight: effectiveTimeWeight });
                    timeGraph[d].push({ node: s, weight: effectiveTimeWeight });
                }
            });

            // Calculate Shortest Route
            const shortestRes = dijkstra(distGraph, source, destination);
            // Calculate Fastest Route
            const fastestRes = dijkstra(timeGraph, source, destination);

            if (shortestRes.distance === Infinity && fastestRes.distance === Infinity) {
                return res.status(404).json({
                    success: false,
                    message: "No navigable route available between the selected junctions due to road closures."
                });
            }

            // Helper to compute full multi-factor metrics for a given node path
            const evaluatePath = (pathNodes, label) => {
                if (!pathNodes || pathNodes.length < 2) return null;

                let totalDist = 0;
                let totalTime = 0;
                let highTrafficCount = 0;
                let roadNames = [];

                for (let i = 0; i < pathNodes.length - 1; i++) {
                    const u = pathNodes[i];
                    const v = pathNodes[i + 1];
                    const r = roadLookup[`${u}-${v}`];
                    if (r) {
                        totalDist += Number(r.distance);
                        let segmentTime = Number(r.travel_time);
                        if (r.traffic_level === "MEDIUM") segmentTime *= 1.35;
                        if (r.traffic_level === "HIGH") {
                            segmentTime *= 2.2;
                            highTrafficCount++;
                        }
                        totalTime += segmentTime;
                        roadNames.push(r.road_name);
                    }
                }

                totalDist = Number(totalDist.toFixed(2));
                totalTime = Number(totalTime.toFixed(1));

                // Multi-Factor Calculations:
                // Fuel consumption: Base 0.08 L/km + 20% penalty for congestion stop-and-go
                const baseFuel = totalDist * 0.08;
                const congestionPenalty = highTrafficCount * 0.18;
                const estimatedFuelLiters = Number((baseFuel + congestionPenalty).toFixed(2));

                // Reliability Index: 100 - penalties for congested segments
                let reliability = Math.max(45, 98 - (highTrafficCount * 22));

                // Composite Rank Score (Normalized Multi-factor evaluation)
                const rankScore = Number(
                    ((100 / Math.max(1, totalTime)) * 0.45 +
                     (100 / Math.max(1, totalDist)) * 0.25 +
                     (reliability * 0.20) +
                     (10 / Math.max(0.1, estimatedFuelLiters)) * 0.10).toFixed(2)
                );

                const namedPath = pathNodes.map(id => junctionMap[id] || `Junction ${id}`);

                return {
                    route_type: label,
                    path_junction_ids: pathNodes,
                    path_names: namedPath,
                    path_display: namedPath.join(" ➔ "),
                    distance_km: totalDist,
                    eta_minutes: totalTime,
                    estimated_fuel_liters: estimatedFuelLiters,
                    reliability_score: `${reliability}%`,
                    reliability_value: reliability,
                    congested_segments: highTrafficCount,
                    roads_traversed: roadNames,
                    multi_factor_rank_score: rankScore
                };
            };

            const shortestRoute = evaluatePath(shortestRes.path, "Shortest Route (Min Distance)");
            const fastestRoute = evaluatePath(fastestRes.path, "Fastest Route (Min Travel Time & Congestion Bypassed)");

            // Determine Recommendation
            let recommended = fastestRoute;
            let whyRecommended = "";

            if (fastestRoute && shortestRoute) {
                if (fastestRoute.eta_minutes < shortestRoute.eta_minutes) {
                    const savedMin = Number((shortestRoute.eta_minutes - fastestRoute.eta_minutes).toFixed(1));
                    recommended = fastestRoute;
                    whyRecommended = `Fastest route is recommended because it saves ${savedMin} mins by bypassing congested road bottlenecks.`;
                } else if (shortestRoute.distance_km < fastestRoute.distance_km) {
                    recommended = shortestRoute;
                    whyRecommended = `Shortest route is recommended because traffic conditions are clear, saving travel distance and fuel.`;
                } else {
                    recommended = fastestRoute;
                    whyRecommended = `Fastest route offers the highest reliability index and optimal fuel efficiency.`;
                }
            }

            // List of ranked options
            const candidates = [shortestRoute, fastestRoute].filter(Boolean);
            // Deduplicate if identical path
            const uniqueRoutes = [];
            const seen = new Set();
            candidates.forEach(c => {
                const key = c.path_junction_ids.join("-");
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueRoutes.push(c);
                }
            });

            uniqueRoutes.sort((a, b) => b.multi_factor_rank_score - a.multi_factor_rank_score);

            res.status(200).json({
                success: true,
                source_junction: { id: source, name: junctionMap[source] },
                destination_junction: { id: destination, name: junctionMap[destination] },
                recommended_route: recommended,
                recommendation_rationale: whyRecommended,
                shortest_route: shortestRoute,
                fastest_route: fastestRoute,
                ranked_options: uniqueRoutes,
                comparison: {
                    distance_difference_km: shortestRoute && fastestRoute ? Number(Math.abs(shortestRoute.distance_km - fastestRoute.distance_km).toFixed(2)) : 0,
                    time_saved_minutes: shortestRoute && fastestRoute ? Number((shortestRoute.eta_minutes - fastestRoute.eta_minutes).toFixed(1)) : 0,
                    fuel_difference_liters: shortestRoute && fastestRoute ? Number((shortestRoute.estimated_fuel_liters - fastestRoute.estimated_fuel_liters).toFixed(2)) : 0
                }
            });
        });
    });
};

module.exports = {
    compareAndRankRoutes
};
