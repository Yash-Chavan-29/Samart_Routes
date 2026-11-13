// ==========================================
// IntelliRoute Emergency Controller (PS 01)
// ==========================================

const { buildGraph } = require("../services/graphService");
const astar = require("../algorithms/astar");
const db = require("../config/db");

const activateEmergency = (req, res) => {
    const { vehicle, source, destination } = req.body;

    if (!vehicle || !source || !destination) {
        return res.status(400).json({
            success: false,
            message: "Vehicle, Source and Destination are required."
        });
    }

    buildGraph((err, graph) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        const result = astar(
            graph,
            Number(source),
            Number(destination)
        );

        if (result.distance === Infinity || !result.path || result.path.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No emergency route found due to complete roadblocks."
            });
        }

        const pathJunctions = result.path;
        const totalDist = Number(result.distance.toFixed(2));

        // Normal civilian route calculation (assumes 30 km/h average + 45s wait at each signal)
        const normalSpeedKmh = 28;
        const normalSignalWaitMinutes = (pathJunctions.length - 1) * 0.75;
        const normalEtaMinutes = Number(((totalDist / normalSpeedKmh) * 60 + normalSignalWaitMinutes).toFixed(1));

        // Emergency Green Corridor calculation (priority speed 55 km/h + 0 signal wait due to green wave)
        const emergencySpeedKmh = 55;
        const emergencyEtaMinutes = Number(((totalDist / emergencySpeedKmh) * 60).toFixed(1));

        const timeSavedMinutes = Number(Math.max(1, normalEtaMinutes - emergencyEtaMinutes).toFixed(1));
        const percentageSaved = Math.round((timeSavedMinutes / normalEtaMinutes) * 100);

        // Turn all signals along this path into 'GREEN' in the database
        if (pathJunctions.length > 0) {
            db.query(
                "UPDATE traffic_signals SET current_signal = 'GREEN', timer = 60 WHERE junction_id IN (?)",
                [pathJunctions],
                () => {}
            );
        }

        res.status(200).json({
            success: true,
            vehicle: vehicle || "Ambulance (Code RED)",
            path: pathJunctions,
            total_distance: totalDist,
            emergency_eta_minutes: emergencyEtaMinutes,
            normal_route_eta_minutes: normalEtaMinutes,
            time_saved_minutes: timeSavedMinutes,
            time_saved_percentage: `${percentageSaved}% faster`,
            priority_junctions_cleared: pathJunctions,
            signal_mode: "Automated Green Wave Preemption Active",
            message: `Green Corridor Activated Successfully. Priority passage saves ${timeSavedMinutes} minutes (${percentageSaved}% faster).`
        });
    });
};

module.exports = {
    activateEmergency
};
