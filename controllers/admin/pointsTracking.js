import { db } from "../../utils/db.js";

export const pointsTrackingController = {
  // Get all points data with search, filtering and pagination
  getPointsTracking: async (req, res) => {
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

      const { search, type = "all", date = "all", page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Base query for points data
      let query = `
        SELECT 
          pe.id,
          pe.user_id,
          pe.points,
          pe.reward_type,
          pe.quiz_id,
          pe.gurudwara_id,
          pe.created_at,
          u.name as user_name,
          u.phone as user_phone,
          g.name as gurudwara_name,
          q.question as quiz_question
        FROM points_earned pe
        LEFT JOIN users u ON pe.user_id = u.id
        LEFT JOIN gurudwaras g ON pe.gurudwara_id = g.id
        LEFT JOIN quizzes q ON pe.quiz_id = q.id
        WHERE 1=1
      `;

      let countQuery = `
        SELECT COUNT(*) as total 
        FROM points_earned pe
        LEFT JOIN users u ON pe.user_id = u.id
        LEFT JOIN gurudwaras g ON pe.gurudwara_id = g.id
        LEFT JOIN quizzes q ON pe.quiz_id = q.id
        WHERE 1=1
      `;

      const params = [];
      const countParams = [];

      // Role-based filtering
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND pe.gurudwara_id = ?";
        countQuery += " AND pe.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
        countParams.push(admin.gurudwara_id);
      }

      // Search filter
      if (search) {
        query += " AND (u.name LIKE ? OR u.phone LIKE ?)";
        countQuery += " AND (u.name LIKE ? OR u.phone LIKE ?)";
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
      }

      // Type filter
      if (type !== "all") {
        query += " AND pe.reward_type = ?";
        countQuery += " AND pe.reward_type = ?";
        params.push(type);
        countParams.push(type);
      }

      // Date filter
      if (date !== "all") {
        let dateCondition = "";
        switch (date) {
          case "today":
            dateCondition = " AND DATE(pe.created_at) = CURDATE()";
            break;
          case "week":
            dateCondition =
              " AND pe.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            break;
          case "month":
            dateCondition =
              " AND pe.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            break;
        }
        query += dateCondition;
        countQuery += dateCondition;
      }

      // Add ordering and pagination
      query += " ORDER BY pe.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      // Execute queries
      const [pointsData] = await db.query(query, params);
      const [[{ total }]] = await db.query(countQuery, countParams);

      // Calculate statistics
      const stats = await calculateStats(admin);

      const totalPages = Math.ceil(total / limit);
      const startIndex = offset + 1;
      const endIndex = Math.min(offset + limit, total);

      res.render("points-tracking/index", {
        title: "Points Tracking",
        pointsData,
        stats,
        admin,
        searchTerm: search || "",
        typeFilter: type,
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
      console.error("Error fetching points tracking data:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching points data",
      };
      res.redirect("/admin");
    }
  },

  // Get points data for API/AJAX requests
  getPointsAPI: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const { search, type = "all", date = "all", page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          pe.id,
          pe.user_id,
          pe.points,
          pe.reward_type,
          pe.quiz_id,
          pe.gurudwara_id,
          pe.created_at,
          u.name as user_name,
          u.phone as user_phone,
          g.name as gurudwara_name,
          q.question as quiz_question
        FROM points_earned pe
        LEFT JOIN users u ON pe.user_id = u.id
        LEFT JOIN gurudwaras g ON pe.gurudwara_id = g.id
        LEFT JOIN quizzes q ON pe.quiz_id = q.id
        WHERE 1=1
      `;

      const params = [];

      // Role-based filtering
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND pe.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      // Search filter
      if (search) {
        query += " AND (u.name LIKE ? OR u.phone LIKE ?)";
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam);
      }

      // Type filter
      if (type !== "all") {
        query += " AND pe.reward_type = ?";
        params.push(type);
      }

      // Date filter
      if (date !== "all") {
        let dateCondition = "";
        switch (date) {
          case "today":
            dateCondition = " AND DATE(pe.created_at) = CURDATE()";
            break;
          case "week":
            dateCondition =
              " AND pe.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            break;
          case "month":
            dateCondition =
              " AND pe.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            break;
        }
        query += dateCondition;
      }

      query += " ORDER BY pe.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [pointsData] = await db.query(query, params);
      const stats = await calculateStats(admin);

      res.json({
        pointsData,
        stats,
        success: true,
      });
    } catch (error) {
      console.error("Error fetching points API data:", error);
      res.status(500).json({ error: "Error fetching points data" });
    }
  },

  // Export points data
  exportPoints: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/points-tracking");
      }

      let query = `
        SELECT 
          pe.id,
          u.name as user_name,
          u.phone as user_phone,
          pe.reward_type,
          pe.points,
          g.name as gurudwara_name,
          q.question as quiz_question,
          pe.created_at
        FROM points_earned pe
        LEFT JOIN users u ON pe.user_id = u.id
        LEFT JOIN gurudwaras g ON pe.gurudwara_id = g.id
        LEFT JOIN quizzes q ON pe.quiz_id = q.id
        WHERE 1=1
      `;

      const params = [];

      // Role-based filtering for export
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND pe.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      query += " ORDER BY pe.created_at DESC";

      const [pointsData] = await db.query(query, params);

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=points-tracking.csv"
      );

      // Create CSV header
      const csvHeaders = [
        "ID",
        "User Name",
        "Phone",
        "Type",
        "Points",
        "Gurudwara",
        "Quiz Question",
        "Earned At",
      ];

      let csvContent = csvHeaders.join(",") + "\n";

      // Add data rows
      pointsData.forEach((point) => {
        const row = [
          point.id,
          `"${point.user_name || ""}"`,
          `"${point.user_phone || ""}"`,
          point.reward_type,
          point.points,
          `"${point.gurudwara_name || ""}"`,
          `"${
            point.quiz_question ? point.quiz_question.replace(/"/g, '""') : ""
          }"`,
          new Date(point.created_at).toLocaleString(),
        ];
        csvContent += row.join(",") + "\n";
      });

      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting points data:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error exporting data",
      };
      res.redirect("/admin/points-tracking");
    }
  },
};

// Helper function to calculate statistics
async function calculateStats(admin) {
  try {
    let baseQuery = `
      SELECT 
        COALESCE(SUM(pe.points), 0) as totalPoints,
        COUNT(DISTINCT pe.user_id) as uniqueUsers,
        COALESCE(SUM(CASE WHEN pe.reward_type = 'quiz' THEN pe.points ELSE 0 END), 0) as quizPoints,
        COALESCE(SUM(CASE WHEN pe.reward_type = 'qr_scanned' THEN pe.points ELSE 0 END), 0) as qrPoints
      FROM points_earned pe
      WHERE 1=1
    `;

    const params = [];

    // Role-based filtering for stats
    if (admin.role === "local_admin" && admin.gurudwara_id) {
      baseQuery += " AND pe.gurudwara_id = ?";
      params.push(admin.gurudwara_id);
    }

    const [[stats]] = await db.query(baseQuery, params);

    return {
      totalPoints: parseInt(stats.totalPoints) || 0,
      uniqueUsers: parseInt(stats.uniqueUsers) || 0,
      quizPoints: parseInt(stats.quizPoints) || 0,
      qrPoints: parseInt(stats.qrPoints) || 0,
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    return {
      totalPoints: 0,
      uniqueUsers: 0,
      quizPoints: 0,
      qrPoints: 0,
    };
  }
}
