import { db } from "../../utils/db.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { generateGurudwaraQR } from "../../services/qrCode.js";

import { existsSync, mkdirSync } from "fs";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const gurudwaraController = {
  // Get all gurudwaras with search, filter and pagination
  getAllGurudwaras: async (req, res) => {
    try {
      const admin = req.admin;
      const page = parseInt(req.query.page) || 1;
      const limit = 9; // 3x3 grid
      const offset = (page - 1) * limit;
      const searchTerm = req.query.search || "";
      const statusFilter = req.query.status || "all";

      let whereConditions = [];
      let queryParams = [];

      if (searchTerm) {
        whereConditions.push("(name LIKE ? OR address LIKE ?)");
        queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        whereConditions.push("status = ?");
        queryParams.push(statusFilter);
      }

      const whereClause =
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : "";

      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM gurudwaras ${whereClause}`,
        queryParams
      );
      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limit);

      const [gurudwaras] = await db.query(
        `SELECT 
          id, name, address, latitude, longitude, image_urls, qr_code_url, 
          status, created_at
        FROM gurudwaras 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      const formattedGurudwaras = gurudwaras.map((g) => ({
        id: g.id,
        name: g.name,
        address: g.address,
        latitude: g.latitude,
        longitude: g.longitude,
        image_urls:
          typeof g.image_urls === "string"
            ? JSON.parse(g.image_urls)
            : g.image_urls,
        qr_code_url: g.qr_code_url,
        status: g.status,
        created_at: g.created_at,
      }));

      const pagination = {
        currentPage: page,
        totalPages,
        totalItems,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalItems),
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      res.render("gurudwaras/index", {
        title: "Gurudwaras Management",
        gurudwaras: formattedGurudwaras,
        admin,
        searchTerm,
        statusFilter,
        pagination,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching gurudwaras:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching gurudwaras",
      };
      res.redirect("/admin/dashboard");
    }
  },

  // Get single gurudwara details (API endpoint for modal)
  getGurudwaraDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const [gurudwaras] = await db.query(
        "SELECT * FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        return res.status(404).json({ error: "Gurudwara not found" });
      }

      res.json(gurudwaras[0]);
    } catch (error) {
      console.error("Error fetching gurudwara details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get single gurudwara for viewing (full page)
  getGurudwaraById: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      const [gurudwaras] = await db.query(
        "SELECT * FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Gurudwara not found",
        };
        return res.redirect("/admin/gurudwaras");
      }

      const gurudwara = gurudwaras[0];

      res.render("gurudwaras/view", {
        title: `Gurudwara Details - ${gurudwara.name}`,
        gurudwara,
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching gurudwara:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading gurudwara details",
      };
      res.redirect("/admin/gurudwaras");
    }
  },

  // Show create gurudwara form (Super admin only)
  showCreateForm: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/gurudwaras");
      }

      res.render("gurudwaras/create", {
        title: "Add New Gurudwara",
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
      res.redirect("/admin/gurudwaras");
    }
  },

  createGurudwara: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/gurudwaras");
      }

      const { name, address, latitude, longitude, status, image_urls } =
        req.body;
      let imageUrlsArray = [];

      // Handle uploaded images
      if (req.files && req.files.images) {
        const files = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];
        const filetypes = /jpeg|jpg|png|gif|webp/;

        // Ensure upload directory exists
        const uploadDir = path.join(
          __dirname,
          "../../public/uploads/gurudwaras"
        );
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }

        for (const file of files) {
          // Validate file type
          if (
            !filetypes.test(file.mimetype) ||
            !filetypes.test(path.extname(file.name).toLowerCase())
          ) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message:
                "Only image files (jpeg, jpg, png, gif, webp) are allowed",
            };
            return res.redirect("/admin/gurudwaras/create");
          }

          // Validate file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "File size exceeds 10MB limit",
            };
            return res.redirect("/admin/gurudwaras/create");
          }

          // Generate unique filename
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileExtension = path.extname(file.name);
          const filename = `gurudwara-${uniqueSuffix}${fileExtension}`;
          const filepath = path.join(uploadDir, filename);

          try {
            // Move file to uploads directory
            await file.mv(filepath);
            imageUrlsArray.push(`/uploads/gurudwaras/${filename}`);
          } catch (fileError) {
            console.error("Error moving file:", fileError);
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: `Error uploading file: ${file.name}`,
            };
            return res.redirect("/admin/gurudwaras/create");
          }
        }
      }

      // Append manually provided image URLs (if any)
      try {
        const manualUrls = image_urls ? JSON.parse(image_urls) : [];
        if (Array.isArray(manualUrls)) {
          imageUrlsArray = [...imageUrlsArray, ...manualUrls];
        }
      } catch (error) {
        console.log("No manual image URLs provided or invalid format");
        // Continue without manual URLs - this is not a critical error
      }

      // Validate required fields
      if (!name || !address) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Name and address are required",
        };
        return res.redirect("/admin/gurudwaras/create");
      }

      // Validate coordinates (if provided, both must be provided)
      if ((latitude && !longitude) || (!latitude && longitude)) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message:
            "Please provide both latitude and longitude or leave both empty",
        };
        return res.redirect("/admin/gurudwaras/create");
      }

      // Insert gurudwara into database with a placeholder for qr_code_url
      const [result] = await db.query(
        `INSERT INTO gurudwaras (name, address, latitude, longitude, image_urls, qr_code_url, qr_scan_points, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name,
          address,
          latitude || null,
          longitude || null,
          JSON.stringify(imageUrlsArray),
          "", // Temporary placeholder for qr_code_url
          10, // Default qr_scan_points
          status || "1",
        ]
      );

      const gurudwaraId = result.insertId;

      // Generate QR code
      const qrCodeResult = await generateGurudwaraQR(gurudwaraId);

      // Update gurudwara with QR code URL
      await db.query(`UPDATE gurudwaras SET qr_code_url = ? WHERE id = ?`, [
        qrCodeResult.qrCodeImage,
        gurudwaraId,
      ]);

      // Print QR code details to terminal
      console.log("Generated QR Code for Gurudwara:");
      console.log("Gurudwara ID:", gurudwaraId);
      console.log("QR Code Hash:", qrCodeResult.qrCodeData);
      console.log("QR Data:", qrCodeResult.qrData);
      console.log("QR Code Data URL:", qrCodeResult.qrCodeImage);

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Gurudwara created successfully with QR code",
      };
      res.redirect("/admin/gurudwaras");
    } catch (error) {
      console.error("Error creating gurudwara:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error creating gurudwara. Please try again.",
      };
      res.redirect("/admin/gurudwaras/create");
    }
  },
  // Show edit gurudwara form (Super admin only)
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
        return res.redirect("/admin/gurudwaras");
      }

      const [gurudwaras] = await db.query(
        "SELECT * FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Gurudwara not found",
        };
        return res.redirect("/admin/gurudwaras");
      }

      res.render("gurudwaras/edit", {
        title: `Edit Gurudwara - ${gurudwaras[0].name}`,
        gurudwara: gurudwaras[0],
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
      res.redirect("/admin/gurudwaras");
    }
  },

  // Update gurudwara (Super admin only) - also updated with better file handling
  updateGurudwara: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;
      const {
        name,
        address,
        latitude,
        longitude,
        status,
        image_urls,
        keep_existing_images,
        qr_scan_points,
      } = req.body;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/gurudwaras");
      }

      // Validate required fields
      if (!name || !address) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Name and address are required",
        };
        return res.redirect(`/admin/gurudwaras/${id}/edit`);
      }

      // Validate qr_scan_points
      const points = parseInt(qr_scan_points) || 10;
      if (points < 1 || points > 1000) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "QR scan points must be between 1 and 1000",
        };
        return res.redirect(`/admin/gurudwaras/${id}/edit`);
      }

      // Get existing gurudwara data
      const [existingGurudwara] = await db.query(
        "SELECT image_urls FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (existingGurudwara.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Gurudwara not found",
        };
        return res.redirect("/admin/gurudwaras");
      }

      let imageUrlsArray = [];

      // Keep existing images if requested
      if (keep_existing_images === "true") {
        try {
          const existingImages = JSON.parse(
            existingGurudwara[0].image_urls || "[]"
          );
          imageUrlsArray = [...existingImages];
        } catch (error) {
          console.log("Error parsing existing images");
        }
      }

      // Handle new uploaded images
      if (req.files && req.files.images) {
        const files = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];
        const filetypes = /jpeg|jpg|png|gif|webp/;

        // Ensure upload directory exists
        const uploadDir = path.join(
          __dirname,
          "../../public/uploads/gurudwaras"
        );
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }

        for (const file of files) {
          // Validate file type
          if (
            !filetypes.test(file.mimetype) ||
            !filetypes.test(path.extname(file.name).toLowerCase())
          ) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message:
                "Only image files (jpeg, jpg, png, gif, webp) are allowed",
            };
            return res.redirect(`/admin/gurudwaras/${id}/edit`);
          }

          // Validate file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: "File size exceeds 10MB limit",
            };
            return res.redirect(`/admin/gurudwaras/${id}/edit`);
          }

          // Generate unique filename
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const fileExtension = path.extname(file.name);
          const filename = `gurudwara-${uniqueSuffix}${fileExtension}`;
          const filepath = path.join(uploadDir, filename);

          try {
            // Move file to uploads directory
            await file.mv(filepath);
            imageUrlsArray.push(`/uploads/gurudwaras/${filename}`);
          } catch (fileError) {
            console.error("Error moving file:", fileError);
            req.session = req.session || {};
            req.session.toast = {
              type: "error",
              message: `Error uploading file: ${file.name}`,
            };
            return res.redirect(`/admin/gurudwaras/${id}/edit`);
          }
        }
      }

      // Append manually provided image URLs (if any)
      try {
        const manualUrls = image_urls ? JSON.parse(image_urls) : [];
        if (Array.isArray(manualUrls)) {
          imageUrlsArray = [...imageUrlsArray, ...manualUrls];
        }
      } catch (error) {
        console.log("No manual image URLs provided or invalid format");
      }

      // Validate coordinates
      if ((latitude && !longitude) || (!latitude && longitude)) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message:
            "Please provide both latitude and longitude or leave both empty",
        };
        return res.redirect(`/admin/gurudwaras/${id}/edit`);
      }

      // Update database
      await db.query(
        `UPDATE gurudwaras 
         SET name = ?, address = ?, latitude = ?, longitude = ?, image_urls = ?, qr_scan_points = ?, status = ?
         WHERE id = ?`,
        [
          name,
          address,
          latitude || null,
          longitude || null,
          JSON.stringify(imageUrlsArray),
          points,
          status || "1",
          id,
        ]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Gurudwara updated successfully",
      };
      res.redirect("/admin/gurudwaras");
    } catch (error) {
      console.error("Error updating gurudwara:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error updating gurudwara. Please try again.",
      };
      res.redirect(`/admin/gurudwaras/${id}/edit`);
    }
  },

  // Delete gurudwara (mark as inactive) (Super admin only)
  deleteGurudwara: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin") {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const [gurudwaras] = await db.query(
        "SELECT * FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Gurudwara not found" });
      }

      await db.query("UPDATE gurudwaras SET status = '2' WHERE id = ?", [id]);

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Gurudwara restored successfully",
      };
      res.redirect("/admin/gurudwaras");
      res.redirect("/admin/gurudwaras");
    } catch (error) {
      console.error("Error deleting gurudwara:", error);
      res
        .status(500)
        .json({ success: false, message: "Error deleting gurudwara" });
    }
  },

  // Restore gurudwara (mark as active) (Super admin only)
  restoreGurudwara: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin") {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const [gurudwaras] = await db.query(
        "SELECT * FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Gurudwara not found" });
      }

      await db.query("UPDATE gurudwaras SET status = '1' WHERE id = ?", [id]);

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Gurudwara deleted succesfully",
      };
      res.redirect("/admin/gurudwaras");
    } catch (error) {
      console.error("Error restoring gurudwara:", error);
      res
        .status(500)
        .json({ success: false, message: "Error restoring gurudwara" });
    }
  },

  // Show QR code page
  showQRCode: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      const [gurudwaras] = await db.query(
        "SELECT id, name, qr_code_url FROM gurudwaras WHERE id = ?",
        [id]
      );

      if (gurudwaras.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Gurudwara not found",
        };
        return res.redirect("/admin/gurudwaras");
      }

      res.render("gurudwaras/qr", {
        title: `QR Code - ${gurudwaras[0].name}`,
        gurudwara: gurudwaras[0],
        admin,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error loading QR code:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading QR code",
      };
      res.redirect("/admin/gurudwaras");
    }
  },
};
