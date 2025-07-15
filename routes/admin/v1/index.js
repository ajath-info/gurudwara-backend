import express from "express";
import { db } from "../../../utils/db.js";
import { verifyAdminToken } from "../../../middleware/auth.js";
import {
  loginPage,
  handleLogin,
} from "../../../controllers/admin/authController.js";
// import { getAnalytics } from "../../../controllers/admin/analyticController.js";
import { dashboard } from "../../../controllers/admin/dashboardController.js";
const ADMIN_ROUTER = express.Router();

ADMIN_ROUTER.post("/auth/login", handleLogin);
ADMIN_ROUTER.get("/auth/login", loginPage);

// Dashboard
ADMIN_ROUTER.get("/", verifyAdminToken, dashboard);
// ADMIN_ROUTER.get("/analytics", verifyAdminToken, getAnalytics);
export default ADMIN_ROUTER;
