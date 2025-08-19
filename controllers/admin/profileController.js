import { db } from "../../utils/db.js";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const profileController = {
  // Render profile page
  getProfile: async (req, res) => {
    try {
      const admin = req.admin;
      if (
        !admin ||
        (admin.role !== "super_admin" && admin.role !== "local_admin")
      ) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/dashboard");
      }

      res.render("profile", {
        title: "Profile",
        admin,
        activeTab: "profile",
        layout: "layouts/admin",
        req: req,
        csrfToken: req.csrfToken ? req.csrfToken() : undefined,
      });
    } catch (error) {
      console.error("Error rendering profile page:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading profile",
      };
      res.redirect("/admin/dashboard");
    }
  },

  // Update profile information
  updateProfile: async (req, res) => {
    req.session = req.session || {};
    try {
      const admin = req.admin;
      if (
        !admin ||
        (admin.role !== "super_admin" && admin.role !== "local_admin")
      ) {
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/dashboard");
      }

      const { username, email } = req.body;
      let avatar = admin.avatar || "/images/default-avatar.png";

      // Handle uploaded avatar
      if (req.files && req.files.avatar) {
        const file = req.files.avatar;
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.name).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (!extname || !mimetype) {
          req.session.toast = {
            type: "error",
            message: "Only image files (jpeg, jpg, png, gif) are allowed",
          };
          return res.redirect("/admin/profile");
        }

        if (file.size > 5 * 1024 * 1024) {
          req.session.toast = {
            type: "error",
            message: "File size exceeds 5MB limit",
          };
          return res.redirect("/admin/profile");
        }

        // Create avatars directory if it doesn't exist
        const avatarDir = path.join(__dirname, "../../public/uploads/avatars");
        try {
          await fs.mkdir(avatarDir, { recursive: true });
          // Verify directory permissions
          await fs.access(avatarDir, fs.constants.W_OK);
        } catch (mkdirError) {
          console.error(
            "Error creating or accessing avatars directory:",
            mkdirError
          );
          req.session.toast = {
            type: "error",
            message: "Error setting up avatar storage",
          };
          return res.redirect("/admin/profile");
        }

        // Save the uploaded file
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `${uniqueSuffix}-${file.name}`;
        const filepath = path.join(avatarDir, filename);
        try {
          await file.mv(filepath);
          avatar = `/uploads/avatars/${filename}`;
        } catch (uploadError) {
          console.error("Error saving avatar:", uploadError);
          req.session.toast = {
            type: "error",
            message: "Error uploading avatar",
          };
          return res.redirect("/admin/profile");
        }
      }

      // Validate required fields
      if (!username || !email) {
        req.session.toast = {
          type: "error",
          message: "Username and email are required",
        };
        return res.redirect("/admin/profile");
      }

      // Update admin profile
      const [result] = await db.query(
        `UPDATE admins SET username = ?, email = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [username, email, avatar, admin.id]
      );

      if (result.affectedRows === 0) {
        req.session.toast = {
          type: "error",
          message: "Failed to update profile",
        };
        return res.redirect("/admin/profile");
      }

      // Update session with new admin data
      req.admin = { ...req.admin, username, email, avatar };

      req.session.toast = {
        type: "success",
        message: "Profile updated successfully",
      };
      res.redirect("/admin/profile");
    } catch (error) {
      console.error("Error updating profile:", error);
      req.session.toast = {
        type: "error",
        message: `Error updating profile: ${error.message}`,
      };
      res.redirect("/admin/profile");
    }
  },

  // Update password
  updatePassword: async (req, res) => {
    req.session = req.session || {};
    try {
      const admin = req.admin;
      if (
        !admin ||
        (admin.role !== "super_admin" && admin.role !== "local_admin")
      ) {
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/dashboard");
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate passwords
      if (!currentPassword || !newPassword || !confirmPassword) {
        req.session.toast = {
          type: "error",
          message: "All password fields are required",
        };
        return res.redirect("/admin/profile");
      }

      if (newPassword !== confirmPassword) {
        req.session.toast = {
          type: "error",
          message: "New password and confirm password do not match",
        };
        return res.redirect("/admin/profile");
      }

      if (newPassword.length < 8) {
        req.session.toast = {
          type: "error",
          message: "New password must be at least 8 characters long",
        };
        return res.redirect("/admin/profile");
      }

      // Verify current password
      const [rows] = await db.query(
        `SELECT password FROM admins WHERE id = ?`,
        [admin.id]
      );
      if (rows.length === 0) {
        req.session.toast = {
          type: "error",
          message: "Admin not found",
        };
        return res.redirect("/admin/profile");
      }

      const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
      if (!isMatch) {
        req.session.toast = {
          type: "error",
          message: "Current password is incorrect",
        };
        return res.redirect("/admin/profile");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const [result] = await db.query(
        `UPDATE admins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [hashedPassword, admin.id]
      );

      if (result.affectedRows === 0) {
        req.session.toast = {
          type: "error",
          message: "Failed to update password",
        };
        return res.redirect("/admin/profile");
      }

      req.session.toast = {
        type: "success",
        message: "Password updated successfully",
      };
      res.redirect("/admin/profile");
    } catch (error) {
      console.error("Error updating password:", error);
      req.session.toast = {
        type: "error",
        message: "Error updating password",
      };
      res.redirect("/admin/profile");
    }
  },
};
