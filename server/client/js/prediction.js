// ==========================================
// IntelliRoute AI Prediction (PS 01: 15-30 Min Ahead Forecast)
// ==========================================

const API_URL = (window.location.origin && window.location.origin.startsWith("http")) ? `${window.location.origin}/api` : "http://localhost:5000/api";

async function predictTraffic() {
    const roadId = document.getElementById("road").value;
    const weather = document.getElementById("weather").value;

    try {
        const response = await fetch(`${API_URL}/prediction?road=${roadId}&weather=${weather}`);
        const data = await response.json();

        if (!data.success) {
            alert(data.message);
            return;
        }

        document.getElementById("roadName").textContent = data.road;
        document.getElementById("currentTraffic").textContent = data.current;
        document.getElementById("currentTraffic").style.color = data.current === "HIGH" ? "#ef4444" : data.current === "MEDIUM" ? "#f59e0b" : "#10b981";

        if (data.ai_features) {
            document.getElementById("timeStatus").textContent = data.ai_features.time_of_day;
            document.getElementById("activeIncidents").textContent = `${data.ai_features.active_incidents} active`;

            const f15 = data.ai_features.forecast_15_mins;
            const f30 = data.ai_features.forecast_30_mins;

            document.getElementById("forecast15").innerHTML = `<span style="color:${f15.color}; background:${f15.color}15; padding:3px 8px; border-radius:4px;">${f15.predicted_level} (${f15.saturation_percentage})</span>`;
            document.getElementById("forecast30").innerHTML = `<span style="color:${f30.color}; background:${f30.color}15; padding:3px 8px; border-radius:4px;">${f30.predicted_level} (${f30.saturation_percentage})</span>`;
        }

        document.getElementById("confidence").textContent = `${data.confidence}%`;
        document.getElementById("preemptiveText").textContent = data.preemptive_route_suggestion;

    } catch (err) {
        console.error(err);
    }
}

window.onload = () => {
    predictTraffic();
};

document.getElementById("road").addEventListener("change", predictTraffic);
