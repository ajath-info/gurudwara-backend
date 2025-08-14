import express from "express";
import fileUpload from "express-fileupload";
import { verifyAdminToken } from "../../../middleware/auth.js";
import { authController } from "../../../controllers/admin/authController.js";
import { dashboard } from "../../../controllers/admin/dashboardController.js";
import { userController } from "../../../controllers/admin/userController.js";
import { gurudwaraController } from "../../../controllers/admin/gurdwara.js";
import { rewardController } from "../../../controllers/admin/rewardsController.js";
import { quizController } from "../../../controllers/admin/quizController.js";
import { pointsTrackingController } from "../../../controllers/admin/pointsTracking.js";
import { rewardRedemptionsController } from "../../../controllers/admin/rewardsRedemptions.js";
import { attendanceController } from "../../../controllers/admin/attendance.js";
const ADMIN_ROUTER = express.Router();

ADMIN_ROUTER.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    abortOnLimit: true,
  })
);

// =============================================================================
// Authentication Routes
// =============================================================================
// These routes handle admin authentication, including login page rendering and
// processing login requests.

// GET /admin/auth/login - Render the admin login page
ADMIN_ROUTER.get("/auth/login", authController.loginPage);

// POST /admin/auth/login - Handle admin login form submission
ADMIN_ROUTER.post("/auth/login", authController.handleLogin);

ADMIN_ROUTER.get("/auth/logout", verifyAdminToken, authController.handleLogout);

// =============================================================================
// Dashboard Routes
// =============================================================================
// These routes manage the admin dashboard and related analytics.

// GET /admin - Render the admin dashboard
// Requires admin authentication via verifyAdminToken middleware
ADMIN_ROUTER.get("/", verifyAdminToken, dashboard);

// =============================================================================
// User Management Routes
// =============================================================================
// These routes handle user-related operations, including listing, searching,
// creating, viewing, editing, deleting, and restoring users.

// GET /admin/users - List all users with pagination
// Requires admin authentication
ADMIN_ROUTER.get("/users", verifyAdminToken, userController.getAllUsers);

// GET /admin/users/search - Search and filter users by name, phone, or status
// Requires admin authentication
ADMIN_ROUTER.get("/search", verifyAdminToken, userController.searchUsers);

// GET /admin/users/create - Render the create user form
// Restricted to super admins only
ADMIN_ROUTER.get(
  "/users/create",
  verifyAdminToken,
  userController.showCreateForm
);

// POST /admin/users/create - Create a new user
// Restricted to super admins only
ADMIN_ROUTER.post("/users/create", verifyAdminToken, userController.createUser);

// GET /admin/users/:id/view - View details of a specific user
// Requires admin authentication
ADMIN_ROUTER.get(
  "/users/:id/view",
  verifyAdminToken,
  userController.getUserById
);

// GET /admin/users/:id/edit - Render the edit user form
// Restricted to super admins only
ADMIN_ROUTER.get(
  "/users/:id/edit",
  verifyAdminToken,
  userController.showEditForm
);

// POST /admin/users/:id - Update user details
// Restricted to super admins only
ADMIN_ROUTER.post("/users/:id", verifyAdminToken, userController.updateUser);

// POST /admin/users/:id/delete - Mark a user as inactive (soft delete)
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/users/:id/delete",
  verifyAdminToken,
  userController.deleteUser
);

// POST /admin/users/:id/restore - Restore a previously deleted (inactive) user
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/users/:id/restore",
  verifyAdminToken,
  userController.restoreUser
);

// =============================================================================
// Gurudwara Management Routes
// =============================================================================
// These routes manage gurudwara-related operations, including listing, searching,
// creating, viewing, editing, deleting, restoring, and viewing QR codes.

// GET /admin/gurudwaras - List all gurudwaras with search, filter, and pagination
// Requires admin authentication
ADMIN_ROUTER.get(
  "/gurudwaras",
  verifyAdminToken,
  gurudwaraController.getAllGurudwaras
);

// GET /admin/gurudwaras/search - Search and filter gurudwaras by name, address, or status
// Requires admin authentication
ADMIN_ROUTER.get(
  "/gurudwaras/search",
  verifyAdminToken,
  gurudwaraController.getAllGurudwaras
);

// GET /admin/gurudwaras/create - Render the create gurudwara form
// Restricted to super admins only
ADMIN_ROUTER.get(
  "/gurudwaras/create",
  verifyAdminToken,
  gurudwaraController.showCreateForm
);

// POST /admin/gurudwaras/create - Create a new gurudwara
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/gurudwaras/create",
  verifyAdminToken,
  gurudwaraController.createGurudwara
);

// GET /admin/gurudwaras/:id - View details of a specific gurudwara
// Requires admin authentication
ADMIN_ROUTER.get(
  "/gurudwaras/:id",
  verifyAdminToken,
  gurudwaraController.getGurudwaraById
);

// GET /admin/gurudwaras/:id/details - Get gurudwara details for modal display
// Requires admin authentication
ADMIN_ROUTER.get(
  "/gurudwaras/:id/details",
  verifyAdminToken,
  gurudwaraController.getGurudwaraDetails
);

// GET /admin/gurudwaras/:id/edit - Render the edit gurudwara form
// Restricted to super admins only
ADMIN_ROUTER.get(
  "/gurudwaras/:id/edit",
  verifyAdminToken,
  gurudwaraController.showEditForm
);

// POST /admin/gurudwaras/:id/edit - Update gurudwara details
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/gurudwaras/:id/edit",
  verifyAdminToken,
  gurudwaraController.updateGurudwara
);

// POST /admin/gurudwaras/:id/delete - Mark a gurudwara as inactive (soft delete)
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/gurudwaras/:id/delete",
  verifyAdminToken,
  gurudwaraController.deleteGurudwara
);

// POST /admin/gurudwaras/:id/restore - Restore a previously deleted (inactive) gurudwara
// Restricted to super admins only
ADMIN_ROUTER.post(
  "/gurudwaras/:id/restore",
  verifyAdminToken,
  gurudwaraController.restoreGurudwara
);

// GET /admin/gurudwaras/:id/qr - View the QR code for a specific gurudwara
// Requires admin authentication
ADMIN_ROUTER.get(
  "/gurudwaras/:id/qr",
  verifyAdminToken,
  gurudwaraController.showQRCode
);

// =============================================================================
// Reward Management Routes
// =============================================================================
// These routes manage reward-related operations, including listing, viewing,
// creating, editing, and deleting rewards.

// GET /admin/rewards - List all rewards with search and pagination
// Requires admin authentication; super admins see all rewards, local admins see only their gurudwara's rewards
ADMIN_ROUTER.get("/rewards", verifyAdminToken, rewardController.getAllRewards);

// GET /admin/rewards/create - Render the create reward form
// Restricted to local admins only
ADMIN_ROUTER.get(
  "/rewards/create",
  verifyAdminToken,
  rewardController.showCreateForm
);

// POST /admin/rewards/create - Create a new reward
// Restricted to local admins only
ADMIN_ROUTER.post(
  "/rewards/create",
  verifyAdminToken,
  rewardController.createReward
);

// GET /admin/rewards/:id - View details of a specific reward
// Requires admin authentication; super admins can view any reward, local admins restricted to their gurudwara
ADMIN_ROUTER.get(
  "/rewards/:id",
  verifyAdminToken,
  rewardController.getRewardById
);

// GET /admin/rewards/:id/edit - Render the edit reward form
// Restricted to local admins for their gurudwara's rewards
ADMIN_ROUTER.get(
  "/rewards/:id/edit",
  verifyAdminToken,
  rewardController.showEditForm
);

// POST /admin/rewards/:id/update - Update reward details
// Restricted to local admins for their gurudwara's rewards
ADMIN_ROUTER.post(
  "/rewards/:id/update",
  verifyAdminToken,
  rewardController.updateReward
);

// POST /admin/rewards/:id/delete - Mark a reward as inactive (soft delete)
// Restricted to local admins for their gurudwara's rewards
ADMIN_ROUTER.post(
  "/rewards/:id/delete",
  verifyAdminToken,
  rewardController.deleteReward
);

ADMIN_ROUTER.post(
  "/rewards/:id/restore",
  verifyAdminToken,
  rewardController.restoreReward
);

// Quizzes Routes
ADMIN_ROUTER.get("/quizzes", verifyAdminToken, quizController.getAllQuizzes);
ADMIN_ROUTER.get(
  "/quizzes/create",
  verifyAdminToken,
  quizController.showCreateForm
);
ADMIN_ROUTER.post(
  "/quizzes/create",
  verifyAdminToken,
  quizController.createQuiz
);
ADMIN_ROUTER.get("/quizzes/:id", verifyAdminToken, quizController.getQuizById);
ADMIN_ROUTER.get(
  "/quizzes/:id/edit",
  verifyAdminToken,
  quizController.showEditForm
);
ADMIN_ROUTER.post(
  "/quizzes/:id/update",
  verifyAdminToken,
  quizController.updateQuiz
);
ADMIN_ROUTER.post(
  "/quizzes/:id/delete",
  verifyAdminToken,
  quizController.deleteQuiz
);
ADMIN_ROUTER.post(
  "/quizzes/:id/restore",
  verifyAdminToken,
  quizController.restoreQuiz
);

// Points tracking routes
ADMIN_ROUTER.get(
  "/points-tracking",
  verifyAdminToken,
  pointsTrackingController.getPointsTracking
);
ADMIN_ROUTER.get(
  "/api",
  verifyAdminToken,
  pointsTrackingController.getPointsAPI
);
ADMIN_ROUTER.get(
  "/export",
  verifyAdminToken,
  pointsTrackingController.exportPoints
);

// Reward Redemptions Routes
ADMIN_ROUTER.get(
  "/redemptions",
  verifyAdminToken,
  rewardRedemptionsController.getRewardRedemptions
);
ADMIN_ROUTER.get(
  "/reward-redemptions/:id/details",
  verifyAdminToken,
  rewardRedemptionsController.getRedemptionDetails
);
ADMIN_ROUTER.get(
  "/reward-redemptions/export",
  verifyAdminToken,
  rewardRedemptionsController.exportRedemptions
);

// Attendance Routes
ADMIN_ROUTER.get(
  "/attendance",
  verifyAdminToken,
  attendanceController.getAttendanceLogs
);
ADMIN_ROUTER.get(
  "/attendance/:id/details",
  verifyAdminToken,
  attendanceController.getAttendanceDetails
);
ADMIN_ROUTER.get(
  "/attendance/export",
  verifyAdminToken,
  attendanceController.exportAttendance
);

export default ADMIN_ROUTER;
