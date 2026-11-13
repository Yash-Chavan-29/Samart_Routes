const express = require("express");
const router = express.Router();

const { compareAndRankRoutes } = require("../controllers/routeCompareController");

router.post("/compare", compareAndRankRoutes);
router.get("/compare", compareAndRankRoutes);

module.exports = router;
