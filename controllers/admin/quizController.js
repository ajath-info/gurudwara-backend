import { db } from "../../utils/db.js";

export const quizController = {
  // Get all quizzes with search and pagination
  getAllQuizzes: async (req, res) => {
    try {
      const admin = req.admin;
      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin");
      }

      const { search, page = 1 } = req.query;
      const limit = 5; // Matches 3x3 grid layout
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id, question, option_1, option_2, option_3, option_4,
          correct_option, points, status, created_at, updated_at
        FROM quizzes
        WHERE status = "1"
      `;
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM quizzes
        WHERE status = "1"
      `;
      const params = [];
      const countParams = [];

      if (search) {
        query += " AND question LIKE ?";
        countQuery += " AND question LIKE ?";
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [quizzes] = await db.query(query, params);
      const [[{ total }]] = await db.query(countQuery, countParams);

      const totalPages = Math.ceil(total / limit);
      const startIndex = offset + 1;
      const endIndex = Math.min(offset + limit, total);

      res.render("quizzes/index", {
        title: "Quizzes Management",
        quizzes,
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
      console.error("Error fetching quizzes:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error fetching quizzes",
      };
      res.redirect("/admin");
    }
  },

  // Get single quiz details
  getQuizById: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin");
      }

      const [quizzes] = await db.query(
        `SELECT 
          id, question, option_1, option_2, option_3, option_4,
          correct_option, points, status, created_at, updated_at
        FROM quizzes
        WHERE id = ?`,
        [id]
      );

      if (quizzes.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Quiz not found",
        };
        return res.redirect("/admin/quizzes");
      }

      const quiz = quizzes[0];

      res.render("quizzes/index", {
        title: `Quiz Details - ${quiz.question}`,
        selectedQuiz: quiz,
        admin,
        isModalOpen: true,
        layout: "layouts/admin",
        req: req,
      });
    } catch (error) {
      console.error("Error fetching quiz:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error loading quiz details",
      };
      res.redirect("/admin/quizzes");
    }
  },

  // Show create quiz form
  showCreateForm: async (req, res) => {
    try {
      const admin = req.admin;
      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin");
      }

      res.render("quizzes/create", {
        title: "Add New Quiz",
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
      res.redirect("/admin/quizzes");
    }
  },

  // Create new quiz
  createQuiz: async (req, res) => {
    try {
      const admin = req.admin;
      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/quizzes");
      }

      const {
        question,
        option_1,
        option_2,
        option_3,
        option_4,
        correct_option,
        points,
      } = req.body;

      if (
        !question ||
        !option_1 ||
        !option_2 ||
        !option_3 ||
        !option_4 ||
        !correct_option ||
        !points
      ) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "All fields are required",
        };
        return res.redirect("/admin/quizzes/create");
      }

      const correctOptionNum = parseInt(correct_option);
      if (correctOptionNum < 1 || correctOptionNum > 4) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Correct option must be between 1 and 4",
        };
        return res.redirect("/admin/quizzes/create");
      }

      await db.query(
        `INSERT INTO quizzes (question, option_1, option_2, option_3, option_4, correct_option, points, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, '1')`,
        [
          question,
          option_1,
          option_2,
          option_3,
          option_4,
          correctOptionNum,
          points,
        ]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Quiz created successfully",
      };
      res.redirect("/admin/quizzes");
    } catch (error) {
      console.error("Error creating quiz:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error creating quiz",
      };
      res.redirect("/admin/quizzes/create");
    }
  },

  // Show edit quiz form
  showEditForm: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/quizzes");
      }

      const [quizzes] = await db.query(
        `SELECT 
          id, question, option_1, option_2, option_3, option_4,
          correct_option, points, status, created_at, updated_at
        FROM quizzes
        WHERE id = ?`,
        [id]
      );

      if (quizzes.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Quiz not found",
        };
        return res.redirect("/admin/quizzes");
      }

      const quiz = quizzes[0];

      res.render("quizzes/edit", {
        title: `Edit Quiz - ${quiz.question}`,
        quiz,
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
      res.redirect("/admin/quizzes");
    }
  },

  // Update quiz
  updateQuiz: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;
      const {
        question,
        option_1,
        option_2,
        option_3,
        option_4,
        correct_option,
        points,
        status,
      } = req.body;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/quizzes");
      }

      if (
        !question ||
        !option_1 ||
        !option_2 ||
        !option_3 ||
        !option_4 ||
        !correct_option ||
        !points
      ) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "All fields are required",
        };
        return res.redirect(`/admin/quizzes/${id}/edit`);
      }

      const correctOptionNum = parseInt(correct_option);
      if (correctOptionNum < 1 || correctOptionNum > 4) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Correct option must be between 1 and 4",
        };
        return res.redirect(`/admin/quizzes/${id}/edit`);
      }

      await db.query(
        `UPDATE quizzes 
        SET question = ?, option_1 = ?, option_2 = ?, option_3 = ?, option_4 = ?, 
            correct_option = ?, points = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          question,
          option_1,
          option_2,
          option_3,
          option_4,
          correctOptionNum,
          points,
          status || "1",
          id,
        ]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: "Quiz updated successfully",
      };
      res.redirect("/admin/quizzes");
    } catch (error) {
      console.error("Error updating quiz:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error updating quiz",
      };
      res.redirect(`/admin/quizzes/${id}/edit`);
    }
  },

  // Delete quiz
  deleteQuiz: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/quizzes");
      }

      const [quizzes] = await db.query(
        `SELECT question FROM quizzes WHERE id = ?`,
        [id]
      );

      if (quizzes.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Quiz not found",
        };
        return res.redirect("/admin/quizzes");
      }

      await db.query(
        `UPDATE quizzes SET status = '2' WHERE id = ? AND status = '1'`,
        [id]
      );

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: `Quiz "${quizzes[0].question}" deleted successfully`,
      };
      res.redirect("/admin/quizzes");
    } catch (error) {
      console.error("Error deleting quiz:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error deleting quiz",
      };
      res.redirect("/admin/quizzes");
    }
  },

  // Restore quiz
  restoreQuiz: async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.admin;

      if (admin.role !== "super_admin") {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Access denied",
        };
        return res.redirect("/admin/quizzes");
      }

      const [quizzes] = await db.query(
        `SELECT question FROM quizzes WHERE id = ? AND status = '2'`,
        [id]
      );

      if (quizzes.length === 0) {
        req.session = req.session || {};
        req.session.toast = {
          type: "error",
          message: "Quiz not found or not inactive",
        };
        return res.redirect("/admin/quizzes");
      }

      await db.query(`UPDATE quizzes SET status = '1' WHERE id = ?`, [id]);

      req.session = req.session || {};
      req.session.toast = {
        type: "success",
        message: `Quiz "${quizzes[0].question}" restored successfully`,
      };
      res.redirect("/admin/quizzes");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      req.session = req.session || {};
      req.session.toast = {
        type: "error",
        message: "Error restoring quiz",
      };
      res.redirect("/admin/quizzes");
    }
  },
};
