const express = require("express");
const router = express.Router();

const {
    getAllSignals,
    optimizeSignal
} = require("../controllers/signalController");

router.get("/", getAllSignals);
router.post("/optimize", optimizeSignal);
router.post("/optimize/:junctionId", optimizeSignal);

module.exports = router;
