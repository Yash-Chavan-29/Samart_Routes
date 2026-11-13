const express = require("express");
const router = express.Router();

const {
    getIncidents,
    reportIncident,
    updateIncidentStatus,
    analyzeNetworkImpact
} = require("../controllers/incidentController");

router.get("/", getIncidents);
router.post("/", reportIncident);
router.patch("/:id/status", updateIncidentStatus);
router.get("/impact/:roadId", analyzeNetworkImpact);

module.exports = router;
