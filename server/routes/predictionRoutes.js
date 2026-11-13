const express = require("express");
const router = express.Router();

const {
    getPrediction,
    getNetworkRiskPrediction
} = require("../controllers/predictionController");

router.get("/", getPrediction);
router.get("/network-risk", getNetworkRiskPrediction);

module.exports = router;
