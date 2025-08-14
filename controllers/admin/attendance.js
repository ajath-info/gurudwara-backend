import { db } from "../../utils/db.js";

export const attendanceController = {
  // Get all attendance logs with search, filtering, and pagination
  getAttendanceLogs: async (req, res) => {
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

      const { search, date = "today", gurudwara = "all", page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Base query for attendance logs
      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.gurudwara_id,
          al.visit_date,
          al.visit_time,
          al.points_awarded,
          al.is_first_visit_today,
          al.latitude,
          al.longitude,
          u.name AS user_name,
          u.phone AS user_phone,
          u.device_type AS user_device_type,
          g.name AS gurudwara_name
        FROM attendance_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN gurudwaras g ON al.gurudwara_id = g.id
        WHERE 1=1
      `;

      let countQuery = `
        SELECT COUNT(*) as total 
        FROM attendance_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN gurudwaras g ON al.gurudwara_id = g.id
        WHERE 1=1
      `;

      const params = [];
      const countParams = [];

      // Role-based filtering
      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND al.gurudwara_id = ?";
        countQuery += " AND al.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
        countParams.push(admin.gurudwara_id);
      }

      // Search filter
      if (search) {
        query += " AND (u.name LIKE ? OR u.phone LIKE ? OR g.name LIKE ?)";
        countQuery += " AND (u.name LIKE ? OR u.phone LIKE ? OR g.name LIKE ?)";
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam);
      }

      // Gurudwara filter
      if (gurudwara !== "all" && admin.role === "super_admin") {
        query += " AND al.gurudwara_id = ?";
        countQuery += " AND al.gurudwara_id = ?";
        params.push(parseInt(gurudwara));
        countParams.push(parseInt(gurudwara));
      }

      // Date filter
      if (date !== "all") {
        let dateCondition = "";
        switch (date) {
          case "today":
            dateCondition = " AND DATE(al.visit_date) = CURDATE()";
            break;
          case "yesterday":
            dateCondition =
              " AND DATE(al.visit_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
            break;
          case "week":
            dateCondition =
              " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            break;
          case "month":
            dateCondition =
              " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            break;
        }
        query += dateCondition;
        countQuery += dateCondition;
      }

      // Add ordering and pagination
      query +=
        " ORDER BY al.visit_date DESC, al.visit_time DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      // Fetch gurudwaras for super_admin filter
      let availableGurudwaras = [];
      if (admin.role === "super_admin") {
        const [gurudwaras] = await db.query(
          "SELECT id, name FROM gurudwaras WHERE status = '1'"
        );
        availableGurudwaras = gurudwaras;
      } else if (admin.role === "local_admin" && admin.gurudwara_id) {
        const [gurudwaras] = await db.query(
          "SELECT id, name FROM gurudwaras WHERE id = ? AND status = '1'",
          [admin.gurudwara_id]
        );
        availableGurudwaras = gurudwaras;
      }

      // Execute queries
      const [attendanceLogs] = await db.query(query, params);
      const [[{ total }]] = await db.query(countQuery, countParams);

      // Calculate statistics
      const stats = await calculateAttendanceStats(
        admin,
        search,
        date,
        gurudwara
      );

      const totalPages = Math.ceil(total / limit);
      const startIndex = offset + 1;
      const endIndex = Math.min(offset + limit, total);

      res.render("attendance", {
        title: "Attendance Logs",
        attendanceLogs,
        stats,
        admin,
        searchTerm: search || "",
        dateFilter: date,
        gurudwaraFilter: gurudwara,
        availableGurudwaras,
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
      console.error("Error fetching attendance logs:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching attendance logs",
      };
      res.redirect("/admin");
    }
  },

  // Get attendance log details for modal
  getAttendanceDetails: async (req, res) => {
    try {
      const admin = req.admin;
      const { id } = req.params;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.gurudwara_id,
          al.visit_date,
          al.visit_time,
          al.points_awarded,
          al.is_first_visit_today,
          al.latitude,
          al.longitude,
          u.name AS user_name,
          u.phone AS user_phone,
          u.device_type AS user_device_type,
          g.name AS gurudwara_name
        FROM attendance_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN gurudwaras g ON al.gurudwara_id = g.id
        WHERE al.id = ?
      `;

      const params = [id];

      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND al.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      const [logs] = await db.query(query, params);

      if (logs.length === 0) {
        return res.status(404).json({ error: "Attendance log not found" });
      }

      res.json({
        success: true,
        log: logs[0],
      });
    } catch (error) {
      console.error("Error fetching attendance details:", error);
      res.status(500).json({ error: "Error fetching attendance details" });
    }
  },

  // Export attendance logs
  exportAttendance: async (req, res) => {
    try {
      const admin = req.admin;

      if (admin.role !== "super_admin" && admin.role !== "local_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/attendance");
      }

      const { search, date = "today", gurudwara = "all" } = req.query;

      let query = `
        SELECT 
          al.id,
          al.visit_date,
          al.visit_time,
          u.name AS user_name,
          u.phone AS user_phone,
          g.name AS gurudwara_name,
          al.points_awarded,
          al.is_first_visit_today,
          u.device_type AS user_device_type
        FROM attendance_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN gurudwaras g ON al.gurudwara_id = g.id
        WHERE 1=1
      `;

      const params = [];

      if (admin.role === "local_admin" && admin.gurudwara_id) {
        query += " AND al.gurudwara_id = ?";
        params.push(admin.gurudwara_id);
      }

      if (search) {
        query += " AND (u.name LIKE ? OR u.phone LIKE ? OR g.name LIKE ?)";
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      if (gurudwara !== "all" && admin.role === "super_admin") {
        query += " AND al.gurudwara_id = ?";
        params.push(parseInt(gurudwara));
      }

      if (date !== "all") {
        let dateCondition = "";
        switch (date) {
          case "today":
            dateCondition = " AND DATE(al.visit_date) = CURDATE()";
            break;
          case "yesterday":
            dateCondition =
              " AND DATE(al.visit_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
            break;
          case "week":
            dateCondition =
              " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
            break;
          case "month":
            dateCondition =
              " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            break;
        }
        query += dateCondition;
      }

      query += " ORDER BY al.visit_date DESC, al.visit_time DESC";

      const [attendanceLogs] = await db.query(query, params);

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=attendance_${date}_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );

      // Create CSV header
      const csvHeaders = [
        "ID",
        "Date",
        "Time",
        "User Name",
        "Phone",
        "Gurudwara",
        "Points Awarded",
        "First Visit Today",
        "Device Type",
      ];

      let csvContent = csvHeaders.join(",") + "\n";

      // Add data rows
      attendanceLogs.forEach((log) => {
        const row = [
          log.id,
          log.visit_date,
          log.visit_time,
          `"${log.user_name || "N/A"}"`,
          `"${log.user_phone || "N/A"}"`,
          `"${log.gurudwara_name || "N/A"}"`,
          log.points_awarded,
          log.is_first_visit_today ? "Yes" : "No",
          `"${log.user_device_type || "Unknown"}"`,
        ];
        csvContent += row.join(",") + "\n";
      });

      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting attendance logs:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error exporting data",
      };
      res.redirect("/admin/attendance");
    }
  },
};

// Helper function to calculate statistics
async function calculateAttendanceStats(admin, search, date, gurudwara) {
  try {
    let baseQuery = `
      SELECT 
        COUNT(*) as totalVisits,
        COUNT(DISTINCT al.user_id) as uniqueVisitors,
        COALESCE(SUM(al.points_awarded), 0) as totalPoints,
        COUNT(CASE WHEN al.is_first_visit_today = 1 THEN 1 END) as firstTimeVisits
      FROM attendance_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN gurudwaras g ON al.gurudwara_id = g.id
      WHERE 1=1
    `;

    const params = [];

    // Role-based filtering
    if (admin.role === "local_admin" && admin.gurudwara_id) {
      baseQuery += " AND al.gurudwara_id = ?";
      params.push(admin.gurudwara_id);
    }

    // Search filter
    if (search) {
      baseQuery += " AND (u.name LIKE ? OR u.phone LIKE ? OR g.name LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // Gurudwara filter
    if (gurudwara !== "all" && admin.role === "super_admin") {
      baseQuery += " AND al.gurudwara_id = ?";
      params.push(parseInt(gurudwara));
    }

    // Date filter
    if (date !== "all") {
      let dateCondition = "";
      switch (date) {
        case "today":
          dateCondition = " AND DATE(al.visit_date) = CURDATE()";
          break;
        case "yesterday":
          dateCondition =
            " AND DATE(al.visit_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
          break;
        case "week":
          dateCondition =
            " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
          break;
        case "month":
          dateCondition =
            " AND al.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
          break;
      }
      baseQuery += dateCondition;
    }

    const [[stats]] = await db.query(baseQuery, params);

    return {
      totalVisits: parseInt(stats.totalVisits) || 0,
      uniqueVisitors: parseInt(stats.uniqueVisitors) || 0,
      totalPoints: parseInt(stats.totalPoints) || 0,
      firstTimeVisits: parseInt(stats.firstTimeVisits) || 0,
    };
  } catch (error) {
    console.error("Error calculating attendance stats:", error);
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      totalPoints: 0,
      firstTimeVisits: 0,
    };
  }
}
