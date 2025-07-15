import { ADMIN_TITLES } from "../../utils/constant.js";
import { db } from "../../utils/db.js";

export const dashboard = async (req, res) => {
  const admin = req.admin;
  console.log("this is the admin data", admin);

  try {
    let stats = {};

    if (admin.role === "super_admin") {
      // Super Admin Stats
      const [totalUsers] = await db.query(
        "SELECT COUNT(*) as count FROM users"
      );
      const [totalGurudwaras] = await db.query(
        "SELECT COUNT(*) as count FROM gurudwaras"
      );
      const [totalRewards] = await db.query(
        "SELECT COUNT(*) as count FROM rewards"
      );
      const [totalQuizzes] = await db.query(
        "SELECT COUNT(*) as count FROM quizzes"
      );
      const [totalPointsEarned] = await db.query(
        "SELECT SUM(points) as sum FROM points_earned"
      );
      const [totalRewardsRedeemed] = await db.query(
        "SELECT COUNT(*) as count FROM rewards_redeemed"
      );
      const [activeUsers] = await db.query(
        "SELECT COUNT(DISTINCT user_id) as count FROM attendance_logs WHERE visit_date = CURDATE()"
      );
      const [newUsersToday] = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()"
      );

      stats = {
        totalUsers: totalUsers[0].count,
        totalGurudwaras: totalGurudwaras[0].count,
        totalRewards: totalRewards[0].count,
        totalQuizzes: totalQuizzes[0].count,
        totalPointsEarned: totalPointsEarned[0].sum || 0,
        totalRewardsRedeemed: totalRewardsRedeemed[0].count,
        activeUsers: activeUsers[0].count,
        newUsersToday: newUsersToday[0].count,
      };
    } else {
      // Local Admin Stats (assuming local admins are tied to a specific gurudwara)
      const gurudwaraId = admin.gurudwara_id; // Adjust based on your admin schema
      const [myGurudwaraUsers] = await db.query(
        "SELECT COUNT(DISTINCT user_id) as count FROM attendance_logs WHERE gurudwara_id = ?",
        [gurudwaraId]
      );
      const [myRewards] = await db.query(
        "SELECT COUNT(*) as count FROM rewards WHERE gurudwara_id = ?",
        [gurudwaraId]
      );
      const [pointsEarned] = await db.query(
        "SELECT SUM(points) as sum FROM points_earned WHERE gurudwara_id = ?",
        [gurudwaraId]
      );
      const [rewardsRedeemed] = await db.query(
        "SELECT COUNT(*) as count FROM rewards_redeemed WHERE reward_id IN (SELECT id FROM rewards WHERE gurudwara_id = ?)",
        [gurudwaraId]
      );

      stats = {
        myGurudwaraUsers: myGurudwaraUsers[0].count,
        myRewards: myRewards[0].count,
        pointsEarned: pointsEarned[0].sum || 0,
        rewardsRedeemed: rewardsRedeemed[0].count,
      };
    }

    // Fetch recent activity (example)
    const [recentActivity] = await db.query(`
      SELECT 'User Registered' as title, 'user' as icon, 'blue' as color, created_at as time
      FROM users
      WHERE DATE(created_at) = CURDATE()
      UNION
      SELECT 'Reward Redeemed' as title, 'gift' as icon, 'purple' as color, created_at as time
      FROM rewards_redeemed
      WHERE DATE(created_at) = CURDATE()
      LIMIT 5
    `);

    res.render("dashboard", {
      title: ADMIN_TITLES.DASHBOARD_TITLE,
      layout: "layouts/admin",
      admin: admin,
      stats: stats,
      recentActivity: recentActivity,
      req: req,
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err.message);
    res.status(500).send("Internal Server Error");
  }
};
