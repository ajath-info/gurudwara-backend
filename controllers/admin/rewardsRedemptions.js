import { db } from "../../utils/db.js";

export const rewardRedemptionsController = {
  // Get all reward redemptions with search, filtering, and pagination
  getRewardRedemptions: async (req, res) => {
    try {
      const admin = req.admin;

      // Check if admin has access
      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin");
      }

      const { search, date = "all", page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Base query for reward redemptions
      let query = `
        SELECT 
          rr.id,
          rr.user_id,
          rr.reward_id,
          rr.points,
          rr.created_at,
          u.name AS user_name,
          u.phone AS user_phone,
          r.title AS reward_title,
          r.description AS reward_description
        FROM rewards_redeemed rr
        LEFT JOIN users u ON rr.user_id = u.id
        LEFT JOIN rewards r ON rr.reward_id = r.id
        WHERE 1=1
      `;

      let countQuery = `
        SELECT COUNT(*) as total 
        FROM rewards_redeemed rr
        LEFT JOIN users u ON rr.user_id = u.id
        LEFT JOIN rewards r ON rr.reward_id = r.id
        WHERE 1=1
      `;

      const params = [];
      const countParams = [];

      // Role-based filtering
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND r.gurudwara_id = ?";
        countQuery += " AND r.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
        countParams.push(admin.gurudwara_id);
      }

      // Search filter
      if (search) {
        query += " AND (u.name LIKE ? OR u.phone LIKE ? OR r.title LIKE ?)";
        countQuery +=
          " AND (u.name LIKE ? OR u.phone LIKE ? OR r.title LIKE ?)";
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam);
      }

      // Date filter
      if (date !== "all") {
        let dateCondition = "";
        switch (date) {
          case "today":
            dateCondition = " AND DATE(rr.created_at) = CURDATE()";
            break;
          case "week":
            dateCondition =
              " AND rr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            break;
          case "month":
            dateCondition =
              " AND rr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            break;
        }
        query += dateCondition;
        countQuery += dateCondition;
      }

      // Add ordering and pagination
      query += " ORDER BY rr.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      // Execute queries
      const [redemptions] = await db.query(query, params);
      const [[{ total }]] = await db.query(countQuery, countParams);

      // Calculate statistics
      const stats = await calculateRedemptionStats(admin);

      const totalPages = Math.ceil(total / limit);
      const startIndex = offset + 1;
      const endIndex = Math.min(offset + limit, total);

      res.render("rewards-redemptions/index", {
        title: "Reward Redemptions",
        redemptions,
        stats,
        admin,
        searchTerm: search || "",
        dateFilter: date,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          startIndex,
          endIndex,
        },
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching reward redemptions:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching reward redemptions",
      };
      res.redirect("/admin");
    }
  },

  // Get redemption details for modal
  getRedemptionDetails: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      let query = `
        SELECT 
          rr.id,
          rr.user_id,
          rr.reward_id,
          rr.points,
          rr.created_at,
          u.name AS user_name,
          u.phone AS user_phone,
          r.title AS reward_title,
          r.description AS reward_description
        FROM rewards_redeemed rr
        LEFT JOIN users u ON rr.user_id = u.id
        LEFT JOIN rewards r ON rr.reward_id = r.id
        WHERE rr.id = ?
      `;

      const params = [id];

      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND r.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      const [redemptions] = await db.query(query, params);

      if (redemptions.length === 0) {
        return res.status(404).json({ error: "Redemption not found" });
      }

      res.json({
        success: true,
        redemption: redemptions[0],
      });
    } catch (error) {
      console.error("Error fetching redemption details:", error);
      res.status(500).json({ error: "Error fetching redemption details" });
    }
  },

  // Export reward redemptions
  exportRedemptions: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/reward-redemptions");
      }

      let query = `
        SELECT 
          rr.id,
          u.name AS user_name,
          u.phone AS user_phone,
          r.title AS reward_title,
          r.description AS reward_description,
          rr.points,
          rr.created_at
        FROM rewards_redeemed rr
        LEFT JOIN users u ON rr.user_id = u.id
        LEFT JOIN rewards r ON rr.reward_id = r.id
        WHERE 1=1
      `;

      const params = [];

      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND r.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      query += " ORDER BY rr.created_at DESC";

      const [redemptions] = await db.query(query, params);

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=reward-redemptions.csv"
      );

      // Create CSV header
      const csvHeaders = [
        "ID",
        "User Name",
        "Phone",
        "Reward Title",
        "Description",
        "Points",
        "Redeemed At",
      ];

      let csvContent = csvHeaders.join(",") + "\n";

      // Add data rows
      redemptions.forEach((redemption) => {
        const row = [
          redemption.id,
          `"${redemption.user_name || ""}"`,
          `"${redemption.user_phone || ""}"`,
          `"${redemption.reward_title || ""}"`,
          `"${
            redemption.reward_description
              ? redemption.reward_description.replace(/"/g, '""')
              : ""
          }"`,
          redemption.points,
          new Date(redemption.created_at).toLocaleString(),
        ];
        csvContent += row.join(",") + "\n";
      });

      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting reward redemptions:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error exporting data",
      };
      res.redirect("/admin/reward-redemptions");
    }
  },
};

// Helper function to calculate statistics
async function calculateRedemptionStats(admin) {
  try {
    let baseQuery = `
      SELECT 
        COUNT(*) as totalRedemptions,
        COALESCE(SUM(rr.points), 0) as totalPoints,
        COUNT(DISTINCT rr.user_id) as uniqueUsers
      FROM rewards_redeemed rr
      LEFT JOIN rewards r ON rr.reward_id = r.id
      WHERE 1=1
    `;

    const params = [];

    // Role-based filtering for stats
    if (admin.role === "local_admin" && admin.gurudwara_id) {
      baseQuery += " AND r.gurudwara_id = ?";
      params.push(admin.gurudwara_id);
    }

    const [[stats]] = await db.query(baseQuery, params);

    return {
      totalRedemptions: parseInt(stats.totalRedemptions) || 0,
      totalPoints: parseInt(stats.totalPoints) || 0,
      uniqueUsers: parseInt(stats.uniqueUsers) || 0,
    };
  } catch (error) {
    console.error("Error calculating redemption stats:", error);
    return {
      totalRedemptions: 0,
      totalPoints: 0,
      uniqueUsers: 0,
    };
  }
}
