// ==========================================
// IntelliRoute Emergency System (PS 01)
// ==========================================

const API_URL = (window.location.origin && window.location.origin.startsWith("http")) ? `${window.location.origin}/api` : "http://localhost:5000/api";

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

        data.junctions.forEach(junction => {
            source.innerHTML += `<option value="${junction.junction_id}">Junction ${junction.junction_id}</option>`;
            destination.innerHTML += `<option value="${junction.junction_id}">Junction ${junction.junction_id}</option>`;
        });

        if (data.junctions.length >= 5) {
            source.value = 1;
            destination.value = 5;
        }
    } catch (err) {
        console.error(err);
    }
}

async function activateEmergency() {
    const vehicle = document.getElementById("vehicle").value;
    const source = Number(document.getElementById("source").value);
    const destination = Number(document.getElementById("destination").value);

    if (source === destination) {
        alert("Source and Destination cannot be the same junction.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/emergency`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle, source, destination })
        });

        const data = await response.json();

        if (!data.success) {
            alert(data.message);
            return;
        }

        document.getElementById("vehicleName").textContent = data.vehicle;
        document.getElementById("routePath").textContent = data.path.join(" ➔ ");
        document.getElementById("distance").textContent = `${Number(data.total_distance).toFixed(2)} KM`;
        document.getElementById("statusBadge").textContent = "🟢 Automated Green Wave Active";

        document.getElementById("emergencyEta").textContent = `${data.emergency_eta_minutes} mins`;
        document.getElementById("normalEta").textContent = `${data.normal_route_eta_minutes} mins`;

        const banner = document.getElementById("savingsBanner");
        banner.style.display = "block";
        document.getElementById("savingsTitle").textContent = `⚡ Time Saved: ${data.time_saved_minutes} Minutes (${data.time_saved_percentage})`;
        document.getElementById("savingsDesc").textContent = `Automated signal preemption turned Junctions [${data.priority_junctions_cleared.join(", ")}] to GREEN. Traffic diverted to prevent blockage.`;

    } catch (err) {
        console.error(err);
        alert("Server Error while activating corridor.");
    }
}

window.onload = () => {
    loadJunctions();
};
