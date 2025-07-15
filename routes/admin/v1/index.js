import express from "express";
import { db } from "../../../utils/db.js";
import { verifyAdminToken } from "../../../middleware/auth.js";
import {
  loginPage,
  handleLogin,
} from "../../../controllers/admin/authController.js";
// import { getAnalytics } from "../../../controllers/admin/analyticController.js";
import { dashboard } from "../../../controllers/admin/dashboardController.js";
import { userController } from "../../../controllers/admin/userController.js";

const ADMIN_ROUTER = express.Router();

ADMIN_ROUTER.post("/auth/login", handleLogin);
ADMIN_ROUTER.get("/auth/login", loginPage);

// Dashboard
ADMIN_ROUTER.get("/", verifyAdminToken, dashboard);
// ADMIN_ROUTER.get("/analytics", verifyAdminToken, getAnalytics);

ADMIN_ROUTER.get("/users", verifyAdminToken, userController.getAllUsers);
// GET /admin/users/search - Search and filter users
ADMIN_ROUTER.get("/search", userController.searchUsers);

// GET /admin/users/create - Show create user form (Super admin only)
ADMIN_ROUTER.get(
  "/users/create",
  verifyAdminToken,
  userController.showCreateForm
);

// POST /admin/users - Create new user (Super admin only)
ADMIN_ROUTER.post("/users/create", verifyAdminToken, userController.createUser);

// GET /admin/users/:id - View user details
ADMIN_ROUTER.get(
  "/users/:id/view",
  verifyAdminToken,
  userController.getUserById
);

// GET /admin/users/:id/edit - Show edit user form (Super admin only)
ADMIN_ROUTER.get(
  "/users/:id/edit",
  verifyAdminToken,
  userController.showEditForm
);

// PUT /admin/users/:id - Update user (Super admin only)
ADMIN_ROUTER.post("/users/:id", verifyAdminToken, userController.updateUser);

// DELETE /admin/users/:id - Delete user (Super admin only)
ADMIN_ROUTER.post(
  "/users/:id/delete",
  verifyAdminToken,
  userController.deleteUser
);
export default ADMIN_ROUTER;
