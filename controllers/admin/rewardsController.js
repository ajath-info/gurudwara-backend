import { db } from "../../utils/db.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { uploadMultipleImagesToCloudinary } from "../../services/cloudinary.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rewardController = {
  // Get all rewards with search and pagination
  getAllRewards: async (req, res) => {
    try {
      const admin = req.admin;
      const { search, page = 1 } = req.query;
      const limit = 9; // Matches 3x3 grid layout
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          r.id, r.gurudwara_id, r.title, r.description, r.points, 
          r.image_urls, r.status, r.created_at, g.name AS gurudwara_name
        FROM rewards r
        JOIN gurudwaras g ON r.gurudwara_id = g.id
        WHERE 1=1
      `;
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM rewards r
        JOIN gurudwaras g ON r.gurudwara_id = g.id
        WHERE 1=1
      `;
      const params = [];
      const countParams = [];

      // Apply search filter
      if (search) {
        query += " AND (r.title LIKE ? OR r.description LIKE ?)";
        countQuery += " AND (r.title LIKE ? OR r.description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
      }

      // Filter rewards for local admins
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND r.gurudwara_id = ?";
        countQuery += " AND r.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
        countParams.push(admin.gurudwara_id);
      }

      query += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rewards] = await db.query(query, params);
      const [[{ total }]] = await db.query(countQuery, countParams);

      // Parse JSON image_urls
      const formattedRewards = rewards.map((reward) => ({
        ...reward,
        image_urls: reward.image_urls ? JSON.parse(reward.image_urls) : [],
      }));

      const totalPages = Math.ceil(total / limit);
      const startIndex = offset + 1;
      const endIndex = Math.min(offset + limit, total);

      res.render("rewards/index", {
        title:
          admin.role === "local_admin" ? "My Rewards" : "Rewards Management",
        rewards: formattedRewards,
        admin,
        searchTerm: search || "",
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          startIndex,
          endIndex,
        },
        layout: "layouts/admin",
        req: req,
        csrfToken: req.csrfToken ? req.csrfToken() : undefined,
      });
    } catch (error) {
      console.error("Error fetching rewards:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching rewards",
      };
      res.redirect("/admin/dashboard");
    }
  },

  // Get single reward details
  getRewardById: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      const [rewards] = await db.query(
        `SELECT 
          r.id, r.gurudwara_id, r.title, r.description, r.points, 
          r.image_urls, r.status, r.created_at, g.name AS gurudwara_name
        FROM rewards r
        JOIN gurudwaras g ON r.gurudwara_id = g.id
        WHERE r.id = ?`,
        [id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found",
        };
        return res.redirect("/admin/rewards");
      }

      const reward = rewards[0];
      reward.image_urls = reward.image_urls
        ? JSON.parse(reward.image_urls)
        : [];

      // Restrict local admins to their own gurudwara's rewards
      if (
        admin.role === "local_admin" &&
        admin.gurudwara_id !== reward.gurudwara_id
      ) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      res.render("rewards/view", {
        title: `Reward Details - ${reward.title}`,
        selectedReward: reward,
        admin,
        layout: "layouts/admin",
        req: req,
        isModalOpen: true,
      });
    } catch (error) {
      console.error("Error fetching reward:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading reward details",
      };
      res.redirect("/admin/rewards");
    }
  },

  // Show create reward form (Local admin only)
  showCreateForm: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      res.render("rewards/create", {
        title: "Add New Reward",
        admin,
        layout: "layouts/admin",
        req: req,
        csrfToken: req.csrfToken ? req.csrfToken() : undefined,
      });
    } catch (error) {
      console.error("Error loading create form:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading form",
      };
      res.redirect("/admin/rewards");
    }
  },

  // Create new reward (Local admin only)
  createReward: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const { title, description, points } = req.body;
      let imageUrlsArray = [];

      // Handle uploaded images
      if (req.files && req.files.images) {
        const files = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];
        const filetypes = /jpeg|jpg|png|gif/;

        // Validate all files first
        for (const file of files) {
          if (
            !filetypes.test(file.mimetype) ||
            !filetypes.test(path.extname(file.name).toLowerCase())
          ) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "Only image files (jpeg, jpg, png, gif) are allowed",
            };
            return res.redirect("/admin/rewards/create");
          }
          if (file.size > 5 * 1024 * 1024) {
            // 5MB limit
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "File size exceeds 5MB limit",
            };
            return res.redirect("/admin/rewards/create");
          }
        }

        // Upload all files to Cloudinary
        try {
          const uploadedUrls = await uploadMultipleImagesToCloudinary(
            files,
            'rewards'
          );
          imageUrlsArray = [...imageUrlsArray, ...uploadedUrls];
        } catch (uploadError) {
          console.error("Error uploading files to Cloudinary:", uploadError);
          req.session = req.session || {};
          req.session.toast = {
            type: "error",
            message: "Error uploading images. Please try again.",
          };
          return res.redirect("/admin/rewards/create");
        }
      }


      // Validate required fields
      if (!title || !points) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Title and points are required",
        };
        return res.redirect("/admin/rewards/create");
      }

      await db.query(
        `INSERT INTO rewards (gurudwara_id, title, description, points, image_urls, status)
        VALUES (?, ?, ?, ?, ?, '1')`,
        [
          admin.gurudwara_id,
          title,
          description || null,
          points,
          JSON.stringify(imageUrlsArray),
        ]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Reward created successfully",
      };
      res.redirect("/admin/rewards");
    } catch (error) {
      console.error("Error creating reward:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error creating reward",
      };
      res.redirect("/admin/rewards/create");
    }
  },

  // Show edit reward form (Local admin only)
  showEditForm: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const [rewards] = await db.query(
        `SELECT 
          r.id, r.gurudwara_id, r.title, r.description, r.points, 
          r.image_urls, r.status, r.created_at, g.name AS gurudwara_name
        FROM rewards r
        JOIN gurudwaras g ON r.gurudwara_id = g.id
        WHERE r.id = ? AND r.gurudwara_id = ?`,
        [id, admin.gurudwara_id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found or access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const reward = rewards[0];
      reward.image_urls = reward.image_urls
        ? JSON.parse(reward.image_urls)
        : [];

      res.render("rewards/edit", {
        title: `Edit Reward - ${reward.title}`,
        reward,
        admin,
        layout: "layouts/admin",
        req: req,
        csrfToken: req.csrfToken ? req.csrfToken() : undefined,
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading form",
      };
      res.redirect("/admin/rewards");
    }
  },

  // Update reward (Local admin only)
  updateReward: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;
      const { title, description, points, status, keep_existing_images } = req.body;
      let imageUrlsArray = [];

      // Fetch existing reward to get current image_urls
      const [rewards] = await db.query(
        `SELECT image_urls FROM rewards WHERE id = ? AND gurudwara_id = ?`,
        [id, admin.gurudwara_id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found or access denied",
        };
        return res.redirect("/admin/rewards");
      }

      // Keep existing images if requested
      if (keep_existing_images === "true") {
        try {
          const existingImages = rewards[0].image_urls
            ? JSON.parse(rewards[0].image_urls)
            : [];
          imageUrlsArray = [...existingImages];
        } catch (error) {
          console.log("Error parsing existing images");
          imageUrlsArray = [];
        }
      }

      // Handle uploaded images
      if (req.files && req.files.images) {
        const files = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];
        const filetypes = /jpeg|jpg|png|gif/;

        // Validate all files first
        for (const file of files) {
          if (
            !filetypes.test(file.mimetype) ||
            !filetypes.test(path.extname(file.name).toLowerCase())
          ) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "Only image files (jpeg, jpg, png, gif) are allowed",
            };
            return res.redirect(`/admin/rewards/${id}/edit`);
          }
          if (file.size > 5 * 1024 * 1024) {
            // 5MB limit
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "File size exceeds 5MB limit",
            };
            return res.redirect(`/admin/rewards/${id}/edit`);
          }
        }

        // Upload all files to Cloudinary
        try {
          const uploadedUrls = await uploadMultipleImagesToCloudinary(
            files,
            'rewards'
          );
          imageUrlsArray = [...imageUrlsArray, ...uploadedUrls];
        } catch (uploadError) {
          console.error("Error uploading files to Cloudinary:", uploadError);
          req.session = req.session || {};
          req.session.toast = {
            type: "error",
            message: "Error uploading images. Please try again.",
          };
          return res.redirect(`/admin/rewards/${id}/edit`);
        }
      }


      // Validate required fields
      if (!title || !points) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Title and points are required",
        };
        return res.redirect(`/admin/rewards/${id}/edit`);
      }

      await db.query(
        `UPDATE rewards 
        SET title = ?, description = ?, points = ?, image_urls = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND gurudwara_id = ?`,
        [
          title,
          description || null,
          points,
          JSON.stringify(imageUrlsArray),
          status || "1",
          id,
          admin.gurudwara_id,
        ]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Reward updated successfully",
      };
      res.redirect("/admin/rewards");
    } catch (error) {
      console.error("Error updating reward:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error updating reward",
      };
      res.redirect(`/admin/rewards/${id}/edit`);
    }
  },

  // Delete reward (Local admin only)
  deleteReward: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const [rewards] = await db.query(
        `SELECT title FROM rewards WHERE id = ? AND gurudwara_id = ?`,
        [id, admin.gurudwara_id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found or access denied",
        };
        return res.redirect("/admin/rewards");
      }

      await db.query(
        `UPDATE rewards SET status = '2' WHERE id = ? AND gurudwara_id = ? AND status = '1'`,
        [id, admin.gurudwara_id]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: `Reward "${rewards[0].title}" deleted successfully`,
      };
      res.redirect("/admin/rewards");
    } catch (error) {
      console.error("Error deleting reward:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error deleting reward",
      };
      res.redirect("/admin/rewards");
    }
  },

  // Restore reward (Local admin only)
  restoreReward: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const [rewards] = await db.query(
        `SELECT title FROM rewards WHERE id = ? AND gurudwara_id = ? AND status = '2'`,
        [id, admin.gurudwara_id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found, not inactive, or access denied",
        };
        return res.redirect("/admin/rewards");
      }

      await db.query(
        `UPDATE rewards SET status = '1' WHERE id = ? AND gurudwara_id = ?`,
        [id, admin.gurudwara_id]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: `Reward "${rewards[0].title}" restored successfully`,
      };
      res.redirect("/admin/rewards");
    } catch (error) {
      console.error("Error restoring reward:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error restoring reward",
      };
      res.redirect("/admin/rewards");
    }
  },

  // Remove image from reward (Local admin only)
  removeImage: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;
      const { image_url } = req.body;

      if (admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/rewards");
      }

      const [rewards] = await db.query(
        `SELECT image_urls FROM rewards WHERE id = ? AND gurudwara_id = ?`,
        [id, admin.gurudwara_id]
      );

      if (rewards.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Reward not found or access denied",
        };
        return res.redirect("/admin/rewards");
      }

      let imageUrls = rewards[0].image_urls
        ? JSON.parse(rewards[0].image_urls)
        : [];

      // Remove the specified image URL
      imageUrls = imageUrls.filter((url) => url !== image_url);

      // Delete the file from the filesystem if it’s a local upload
      if (image_url.startsWith("/uploads/rewards/")) {
        const filePath = path.join(__dirname, "../../public", image_url);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.warn(`Could not delete file ${filePath}:`, err);
        }
      }

      await db.query(
        `UPDATE rewards SET image_urls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND gurudwara_id = ?`,
        [JSON.stringify(imageUrls), id, admin.gurudwara_id]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Image removed successfully",
      };
      res.redirect(`/admin/rewards/${id}/edit`);
    } catch (error) {
      console.error("Error removing image:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error removing image",
      };
      res.redirect(`/admin/rewards/${id}/edit`);
    }
  },
};
