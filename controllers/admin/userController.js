import { db } from "../../utils/db.js";

export const userController = {
  // Get all users for admin dashboard
  getAllUsers: async (req, res) => {
    try {
      const admin = req.admin;
      let query = `
        SELECT 
          id, name, phone, profile_image, device_type, status, created_at 
        FROM users 
        ORDER BY created_at DESC
      `;

      const [users] = await db.query(query);

      res.render("users/index", {
        title: "Users Management",
        users,
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching users",
      };
      res.redirect("/admin/dashboard");
    }
  },

  // Get single user details
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

      if (users.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "User not found",
        };
        return res.redirect("/admin/users");
      }

      const user = users[0];

      res.render("users/view", {
        title: `User Details - ${user.name}`,
        user,
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading user details",
      };
      res.redirect("/admin/users");
    }
  },

  // Show create user form (Super admin only)
  showCreateForm: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/users");
      }

      res.render("users/create", {
        title: "Add New User",
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error loading create form:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading form",
      };
      res.redirect("/admin/users");
    }
  },

  // Create new user (Super admin only)
  createUser: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/users");
      }

      const { name, phone, device_type, status } = req.body;

      // Validate required fields
      if (!name || !phone) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Name and phone are required",
        };
        return res.redirect("/admin/users/create");
      }

      // Check if phone already exists
      const [existingUsers] = await db.query(
        "SELECT id FROM users WHERE phone = ?",
        [phone]
      );

      if (existingUsers.length > 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Phone number already exists",
        };
        return res.redirect("/admin/users/create");
      }

      await db.query(
        "INSERT INTO users (name, phone, device_type, status) VALUES (?, ?, ?, ?)",
        [name, phone, device_type || "W", status || "1"]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "User created successfully",
      };
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Error creating user:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error creating user",
      };
      res.redirect("/admin/users/create");
    }
  },

  // Show edit user form (Super admin only)
  showEditForm: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/users");
      }

      const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

      if (users.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "User not found",
        };
        return res.redirect("/admin/users");
      }

      res.render("users/edit", {
        title: `Edit User - ${users[0].name}`,
        user: users[0],
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading form",
      };
      res.redirect("/admin/users");
    }
  },

  // Update user (Super admin only)
  updateUser: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/users");
      }

      const { name, phone, device_type, status } = req.body;

      // Validate required fields
      if (!name || !phone) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Name and phone are required",
        };
        return res.redirect(`/admin/users/${id}/edit`);
      }

      // Check if phone already exists for other users
      const [existingUsers] = await db.query(
        "SELECT id FROM users WHERE phone = ? AND id != ?",
        [phone, id]
      );

      if (existingUsers.length > 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Phone number already exists",
        };
        return res.redirect(`/admin/users/${id}/edit`);
      }

      await db.query(
        "UPDATE users SET name = ?, phone = ?, device_type = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name, phone, device_type, status, id]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "User updated successfully",
      };
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Error updating user:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error updating user",
      };
      res.redirect(`/admin/users/${req.params.id}/edit`);
    }
  },

  // Delete user (Super admin only)
  deleteUser: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/users");
      }

      // Check if user exists
      const [users] = await db.query("SELECT name FROM users WHERE id = ?", [
        id,
      ]);

      if (users.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "User not found",
        };
        return res.redirect("/admin/users");
      }

      // Delete user (consider soft delete in production)
      await db.query(
        "UPDATE users SET status = '2' WHERE id = ? AND status = '1'",
        [id]
      );
      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: `User "${users[0].name}" deleted successfully`,
      };
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Error deleting user:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error deleting user",
      };
      res.redirect("/admin/users");
    }
  },

  // Search and filter users
  searchUsers: async (req, res) => {
    try {
      const admin = req.admin;
      const { search, status } = req.query;

      let query = `
        SELECT 
          id, name, phone, profile_image, device_type, status, created_at 
        FROM users 
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += " AND (name LIKE ? OR phone LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      if (status && status !== "all") {
        query += " AND status = ?";
        params.push(status);
      }

      query += " ORDER BY created_at DESC";

      const [users] = await db.query(query, params);

      res.render("users/index", {
        title: "Users Management",
        users,
        admin,
        searchTerm: search || "",
        statusFilter: status || "all",
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error searching users:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error searching users",
      };
      res.redirect("/admin/users");
    }
  },
};
