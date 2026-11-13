// ==========================================
// IntelliRoute AI Traffic Prediction Controller (PS 01)
// ==========================================

const db = require("../config/db");

// Weather factors: impact on road capacity
const WEATHER_FACTORS = {
    CLEAR: 1.0,
    OVERCAST: 1.1,
    RAIN: 1.45,
    STORM: 1.8
};

const getPrediction = (req, res) => {
    const roadId = req.query.road;

    if (!roadId) {
        return res.status(400).json({
            success: false,
            message: "Road ID is required."
        });
    }

    const weather = (req.query.weather || "CLEAR").toUpperCase();
    const weatherFactor = WEATHER_FACTORS[weather] || 1.0;

    // Time of day analysis (hour 0-23)
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);
    const timeFactor = isPeakHour ? 1.4 : 0.85;

    const sql = `
        SELECT
            r.road_id,
            r.road_name,
            r.traffic_level,
            r.road_status,
            r.distance,
            r.travel_time,
            COALESCE(AVG(tl.vehicle_count), 95) AS avg_vehicle_count,
            COALESCE(AVG(tl.average_speed), 40) AS avg_speed,
            (SELECT COUNT(*) FROM incidents i WHERE i.road_id = r.road_id AND i.status != 'RESOLVED') AS active_incidents
        FROM roads r
        LEFT JOIN traffic_logs tl ON r.road_id = tl.road_id
        WHERE r.road_id = ?
        GROUP BY r.road_id
    `;

    db.query(sql, [roadId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "Road not found." });
        }

        const road = result[0];
        const baseVehicles = Number(road.avg_vehicle_count);
        const incidentsCount = Number(road.active_incidents);

        // Predictive Model: Calculate projected vehicle density 15m and 30m ahead
        // Road nominal capacity = 150 vehicles/km/lane
        const nominalCapacity = 160;
        const projectedDensity15m = (baseVehicles * timeFactor * weatherFactor) + (incidentsCount * 45);
        const projectedDensity30m = projectedDensity15m * (isPeakHour ? 1.18 : 0.95);

        const congestionRatio15 = Math.min(1.0, projectedDensity15m / nominalCapacity);
        const congestionRatio30 = Math.min(1.0, projectedDensity30m / nominalCapacity);

        const determineRisk = (ratio) => {
            if (ratio >= 0.75) return { level: "HIGH", color: "#ef4444", riskScore: Math.round(ratio * 100) };
            if (ratio >= 0.40) return { level: "MEDIUM", color: "#f59e0b", riskScore: Math.round(ratio * 100) };
            return { level: "LOW", color: "#10b981", riskScore: Math.round(ratio * 100) };
        };

        const risk15 = determineRisk(congestionRatio15);
        const risk30 = determineRisk(congestionRatio30);

        // Preemptive routing suggestion
        let preemptiveSuggestion = "Traffic flow is expected to remain smooth. Proceed on designated route.";
        if (risk30.level === "HIGH") {
            preemptiveSuggestion = `⚠️ High Congestion Predicted in 30 minutes (${risk30.riskScore}% road saturation). Consider preemptive alternate bypass.`;
        } else if (risk30.level === "MEDIUM") {
            preemptiveSuggestion = `Moderate traffic accumulation anticipated (+${Math.round((timeFactor - 1) * 100)}% peak surge). Normal routing optimal.`;
        }

        res.json({
            success: true,
            road_id: road.road_id,
            road: road.road_name,
            current: road.traffic_level,
            prediction: risk30.level,
            confidence: Math.min(96, Math.max(82, 88 + (isPeakHour ? 5 : -2))),
            after: "30 Minutes",
            risk_color: risk30.color,
            ai_features: {
                time_of_day: `${currentHour}:00 (${isPeakHour ? "Rush Hour Peak" : "Off-Peak"})`,
                weather_condition: weather,
                weather_multiplier: weatherFactor,
                active_incidents: incidentsCount,
                road_capacity_utilization_now: `${Math.round((baseVehicles / nominalCapacity) * 100)}%`,
                forecast_15_mins: {
                    predicted_level: risk15.level,
                    saturation_percentage: `${risk15.riskScore}%`,
                    color: risk15.color
                },
                forecast_30_mins: {
                    predicted_level: risk30.level,
                    saturation_percentage: `${risk30.riskScore}%`,
                    color: risk30.color
                }
            },
            preemptive_route_suggestion: preemptiveSuggestion
        });
    });
};

// Network-wide risk level heatmap for all roads
const getNetworkRiskPrediction = (req, res) => {
    const sql = `
        SELECT 
            r.road_id,
            r.road_name,
            r.source_junction,
            r.destination_junction,
            r.traffic_level,
            r.road_status,
            COALESCE(AVG(tl.vehicle_count), 80) AS avg_vehicles
        FROM roads r
        LEFT JOIN traffic_logs tl ON r.road_id = tl.road_id
        GROUP BY r.road_id
    `;

    db.query(sql, (err, roads) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const currentHour = new Date().getHours();
        const isPeak = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);

        const forecast = roads.map(r => {
            const base = Number(r.avg_vehicles);
            const score = Math.min(100, Math.round((base / 160) * (isPeak ? 135 : 95)));
            let predLevel = "LOW";
            let color = "#10b981";
            if (score >= 70 || r.traffic_level === "HIGH") {
                predLevel = "HIGH";
                color = "#ef4444";
            } else if (score >= 40 || r.traffic_level === "MEDIUM") {
                predLevel = "MEDIUM";
                color = "#f59e0b";
            }
            return {
                road_id: r.road_id,
                road_name: r.road_name,
                source_junction: r.source_junction,
                destination_junction: r.destination_junction,
                current_level: r.traffic_level,
                predicted_level_30m: predLevel,
                risk_score: score,
                risk_color: color
            };
        });

        res.status(200).json({ success: true, count: forecast.length, network_forecast_30m: forecast });
    });
};

module.exports = {
    getPrediction,
    getNetworkRiskPrediction
};
