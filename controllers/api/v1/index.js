import { db } from "../../../utils/db.js";
import validator from "validator";
import { apiResponse } from "../../../utils/helper.js";
import { generateOTP } from "../../../utils/helper.js";
import { generateToken } from "../../../utils/helper.js";
import { formatDateTime } from "../../../utils/helper.js";
import { formatDate } from "date-fns";
import { generateGurudwaraQR } from "../../../services/qrCode.js";

export const sendOtp = async (req, res, next) => {
  try {
    // Get phone and name from the request object
    const { phone } = req.body;

    // Validation for the phone number
    if (!phone || !validator.isMobilePhone(phone)) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Invalid Phone Number or missing",
      });
    }

    // Delete any existing otp for the phone number
    await db.query(`DELETE FROM otps WHERE phone = ?`, [phone]);

    // Generate otp
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 1000); // OTP expires in 1 minute

    // Save otp into the database
    const [insertResult] = await db.query(
      `INSERT INTO otps (otp, phone, expires_at) VALUES (?, ?, ?)`,
      [otp, phone, expiresAt]
    );
    if (insertResult.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Failed to save the otp",
      });
    }

    const reponse = {
      id: insertResult.id,
      phone,
      otp,
    };
    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Otp sent succesfully ",
      payload: reponse,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, fcmToken, deviceType } = req.body;
    if (!otp || !phone) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Missing required fields",
      });
    }

    //Verify otp
    const [otpRows] = await db.query(
      `SELECT * FROM otps WHERE phone = ? AND otp = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
      [phone, otp]
    );
    if (otpRows.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Invalid otp or otp is expired",
      });
    }

    await db.query(`DELETE FROM otps WHERE id = ?`, [otpRows[0].id]);

    // Check if user exists if not create new user
    let userId;
    let isFirstTime = false;
    const [userRows] = await db.query(
      `SELECT * FROM users WHERE phone = ? AND status = '1'`,
      [phone]
    );
    if (userRows.length === 0) {
      // Create new user
      const [insertResult] = await db.query(
        `INSERT INTO users (phone, fcm_token, device_type) VALUES(?,?,?)`,
        [phone, fcmToken, deviceType]
      );
      if (insertResult.affectedRows === 0) {
        return apiResponse(res, {
          error: true,
          code: 400,
          status: 0,
          message: "Error in creating new user",
        });
      }
      userId = insertResult.insertId;
      isFirstTime = true;
    } else {
      userId = userRows[0].id;
      isFirstTime = false;

      await db.query(
        `UPDATE users SET fcm_token = ?, device_type = ? WHERE id = ?`,
        [fcmToken, deviceType, userId]
      );
    }

    // Generate jwt token
    const token = await generateToken(userId);

    // Calculate expiry time for the token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Delete any existing token for the user
    await db.query(`DELETE FROM tokens WHERE user_id = ?`, [userId]);

    // Insert new token
    await db.query(
      `INSERT INTO tokens (user_id, token, expires_at) VALUES(?,?,?)`,
      [userId, token, expiresAt]
    );

    // Fetch updated user details
    const [updatedUserRows] = await db.query(
      `SELECT * FROM users WHERE id = ? AND status = '1'`,
      [userId]
    );
    const user = updatedUserRows[0];

    const response = {
      token,
      ...user,
      isFirstTime,
    };
    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Otp verified successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserName = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User not authenticated",
      });
    }
    const { name } = req.body;

    // Validate name field
    if (!name || typeof name !== "string") {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Enter valid name",
      });
    }

    const [updatedUserRows] = await db.query(
      `UPDATE users SET name = ? WHERE id = ?`,
      [name, userId]
    );
    if (updatedUserRows.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Error in updating the name",
      });
    }
    const [updatedUser] = await db.query(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );

    // Get the token 
    const [tokenRow] = await db.query(`SELECT * FROM tokens WHERE user_id = ?`,[userId]);
    const token = tokenRow[0];
    const user = updatedUser[0];
    const response = {
      token : token.token,
      ...user

    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "User name updated successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllGurudwaras = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user.id;

    // Extract query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Optional: Get user's location for distance calculation
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);

    // Build query based on whether user location is provided
    let query = `SELECT * FROM gurudwaras WHERE status = '1'`;
    let countQuery = `SELECT COUNT(*) as total FROM gurudwaras WHERE status = '1'`;

    // Add distance calculation if user coordinates are provided
    if (userLat && userLng) {
      query = `
        SELECT *, 
        (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians(?)) + 
        sin(radians(?)) * sin(radians(latitude)))) AS distance
        FROM gurudwaras 
        WHERE status = '1' 
        ORDER BY distance ASC
        LIMIT ? OFFSET ?
      `;
    } else {
      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    }

    // Get total count for pagination
    const [countResult] = await db.query(countQuery);
    const total = countResult[0].total;

    // Get gurudwaras
    let gurudwaraRows;
    if (userLat && userLng) {
      [gurudwaraRows] = await db.query(query, [
        userLat,
        userLng,
        userLat,
        limit,
        offset,
      ]);
    } else {
      [gurudwaraRows] = await db.query(query, [limit, offset]);
    }

    // Format the response data
    const gurudwaras = gurudwaraRows.map((gurudwara) => ({
      id: gurudwara.id,
      name: gurudwara.name,
      address: gurudwara.address,
      image_urls:
        typeof gurudwara.image_urls === "string"
          ? JSON.parse(gurudwara.image_urls)
          : gurudwara.image_urls,
      latitude: parseFloat(gurudwara.latitude),
      longitude: parseFloat(gurudwara.longitude),
      qr_code_url: gurudwara.qr_code_url,
      distance: gurudwara.distance
        ? parseFloat(gurudwara.distance).toFixed(2)
        : null,
      created_at: formatDateTime(gurudwara.created_at),
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      gurudwaras,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Gurudwaras fetched successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const addFavouriteGurudwara = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.user.id;
    const gurudwaraId = req.params.id;

    // Check if user already has this gurudwara in favourites
    const [row] = await db.query(
      `SELECT * FROM favourite_gurudwaras WHERE gurudwara_id = ? AND user_id = ? AND status = '1'`,
      [gurudwaraId, userId]
    );
    if (row.length !== 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "User has already added this gurudwara to favourites",
      });
    }

    //Adding in the gurudwara in the favourites
    const [insertResult] = await db.query(
      `INSERT INTO favourite_gurudwaras (user_id, gurudwara_id) VALUES (?, ?)`,
      [userId, gurudwaraId]
    );
    if (insertResult.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Error in adding the gurudwara to the favourites",
      });
    }

    // Preapring response
    const response = {
      id: insertResult.insertId,
      user_id: userId,
      gurudwara_id: gurudwaraId,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Gurudwara added to the favourites successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllFavouriteGurudwaras = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT * FROM favourite_gurudwaras WHERE user_id = ? AND status = '1' LIMIT ? OFFSET ? `,
      [userId, limit, offset]
    );
    if (rows.length === 0) {
      return apiResponse(res, {
        error: false,
        code: 404,
        status: 0,
        message: "No favourite gurudwaras found",
      });
    }

    const favouriteGurudwaras = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      gurudwara_id: r.gurudwara_id,
      created_at: formatDateTime(r.created_at),
    }));
    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Favourite gurudwaras found successfully",
      payload: {
        favouriteGurudwaras,
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};
/**
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
export const logout = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.user.id;

    const [tokenRow] = await db.query(
      `SELECT * FROM tokens where user_id = ?`,
      [userId]
    );

    if (tokenRow.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User not authenticated",
      });
    }

    // Delete fcm token
    const [deleteResult] = await db.query(
      `UPDATE users SET fcm_token = '' WHERE id = ?`,
      [userId]
    );
    if (deleteResult.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Failed to delete fcm token",
      });
    }

    const [deleteResult1] = await db.query(
      `DELETE FROM tokens WHERE user_id = ?`,
      [userId]
    );
    if (deleteResult1.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Error in log out",
      });
    }

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Log out succesfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 *
 */
export const getGurudwaraDetails = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User not authenticated",
      });
    }

    const gurudwaraId  = req.params.id;
    if (!gurudwaraId) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Missing gurudwara id",
      });
    }

    // Check if the gurudwara exists
    const [row] = await db.query(
      `SELECT * FROM gurudwaras WHERE id = ? AND status = '1' `,
      [gurudwaraId]
    );
    if (row.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "Gurudwara not found",
      });
    }

    const [rewardsRows] = await db.query(
      `SELECT id, title, description, points, image_urls FROM rewards WHERE gurudwara_id = ? AND status = '1' ORDER BY created_at DESC`,
      [gurudwaraId]
    );
    if (rewardsRows.length === 0) {
      return apiResponse(res, {
        error: false,
        code: 404,
        status: 0,
        message: "No rewards found for this gurudwara",
      });
    }

    const response = {
      gurudwaraDetails: {
        ...row[0],
        created_at: formatDateTime(row[0].created_at),
        rewards: rewardsRows,
      },
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Gurudwara details fetched succesfully",
      palyoad: response,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get rewards redemption history with details
 */
export const getRewardsHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User not authenticated",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        rr.id as redemption_id,
        rr.user_id,
        rr.reward_id,
        rr.created_at as redeemed_at,
        r.title as reward_title,
        r.description as reward_description,
        r.image_urls as reward_images,
        r.points as reward_points,
        r.gurudwara_id,
        u.name as user_name,
        u.phone as user_phone
      FROM rewards_redeemed rr
      INNER JOIN rewards r ON rr.reward_id = r.id
      INNER JOIN users u ON rr.user_id = u.id
      WHERE rr.user_id = ? AND r.status = '1'
      ORDER BY rr.created_at DESC LIMIT ? OFFSET ?
    `,
      [userId, limit, offset]
    );

    if (rows.length === 0) {
      return apiResponse(res, {
        error: false,
        code: 200,
        status: 1,
        message: "No rewards history found for this user",
        payload: [],
      });
    }

    const rewardsHistory = rows.map((r) => {
      return {
        redemption: {
          id: r.redemption_id,
          redeemed_at: r.redeemed_at,
        },
        redeemed_rewards: {
          title: r.reward_title,
          description: r.reward_description,
          image_urls: r.reward_images,
          points: r.reward_points,
          gurudwara_id: r.gurudwara_id,
        },
        userDetail: {
          id: r.user_id,
          name: r.user_name,
          phone: r.user_phone,
        },
      };
    });

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Rewards history retrieved successfully",
      payload: {
        rewardsHistory,
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getQuizzes = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User not authenticated",
      });
    }

    // Single query to get quizzes not submitted by user
    const [availableQuizzes] = await db.query(
      `
      SELECT q.* 
      FROM quizzes q 
      LEFT JOIN quiz_submissions qs on q.id = qs.quiz_id AND qs.user_id = ?
      WHERE q.status = '1'
      AND qs.quiz_id IS NULL
      ORDER BY RAND()
      LIMIT 3
    `,
      [userId]
    );

    if (availableQuizzes.length === 0) {
      return apiResponse(res, {
        error: false,
        code: 404,
        status: 0,
        message: "No new quizzes available",
      });
    }

    const response = {
      quizzes: availableQuizzes,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Quizzes retrieved successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const submitQuiz = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User is not authenticated",
      });
    }
    const { quizId, selectedOption } = req.body;

    // Check if the quiz exists
    const [checkQuiz] = await db.query(
      `SELECT * FROM quizzes WHERE id = ? AND status = '1'`,
      [quizId]
    );
    if (checkQuiz.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "No such quiz found",
      });
    }
    // Check if the user has already submitted the quiz
    const [checkSubmission] = await db.query(
      `SELECT * FROM quiz_submissions WHERE user_id = ? AND quiz_id = ?`,
      [userId, quizId]
    );
    if (checkSubmission.length !== 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "You have already submitted this quiz",
      });
    }

    // Submit the quiz
    const quiz = checkQuiz[0];
    const isCorrect = Number(selectedOption) === quiz.correct_option;
    const pointsEarned = isCorrect ? quiz.points : 0;

    await db.query(`START TRANSACTION`);
    try {
      const [submission] = await db.query(
        `INSERT INTO quiz_submissions (user_id, quiz_id, selected_option, is_correct, points_earned) VALUES (?,?,?,?,?)`,
        [userId, quizId, selectedOption, isCorrect, pointsEarned]
      );

      if (isCorrect) {
        await db.query(
          `INSERT INTO points_earned (user_id, reward_type, quiz_id, points) VALUES (?,?,?,?)`,
          [userId, "quiz", quizId, pointsEarned]
        );
      }
      await db.query(`COMMIT`);

      const response = {
        quizId,
        selectedOption,
        correctOption: quiz.correct_option,
        isCorrect,
        pointsEarned,
        message: isCorrect
          ? "Correct answer!"
          : "Wrong answer, better luck next time!",
      };

      return apiResponse(res, {
        error: false,
        code: 200,
        status: 1,
        message: "Quiz submitted succesfully",
        payload: response,
      });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// API endpoint for generating QR
export const generateQR = async (req, res, next) => {
  try {
    const gurudwaraId = req.params.id;

    // Check if gurudwara exists
    const gurudwara = await db.query("SELECT * FROM gurudwaras WHERE id = ?", [
      gurudwaraId,
    ]);

    if (gurudwara.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "Gurudwara not found",
      });
    }

    const qrResult = await generateGurudwaraQR(gurudwaraId);

    const response = {
      data: qrResult,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Qr scanned succesfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

// // API to get existing QR code
// app.get("/admin/gurudwara/:id/qr", async (req, res) => {
//   try {
//     const gurudwaraId = req.params.id;

//     const result = await db.query(
//       "SELECT name, qr_code_url FROM gurudwaras WHERE id = ?",
//       [gurudwaraId]
//     );

//     if (result.length === 0) {
//       return res.status(404).json({ error: "Gurudwara not found" });
//     }

//     res.json({
//       success: true,
//       data: {
//         name: result[0].name,
//         qrCodeUrl: result[0].qr_code_url,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

export const scanQrCode = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "User is not authenticated",
      });
    }

    const { qrData } = req.body;

    let parsedQrData;
    try {
      parsedQrData = JSON.parse(qrData);
    } catch (err) {
      console.error(err);
    }

    if (parsedQrData.visit !== "gurudwara_vist" || !parsedQrData.id) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Invalid QR code type",
      });
    }

    const gurudwaraId = parsedQrData.id;

    //Check if the gurudwara exists with this id
    const [checkGurudwara] = await db.query(
      `SELECT * FROM gurudwaras WHERE id = ? AND status = '1'`,
      [gurudwaraId]
    );
    if (checkGurudwara.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "No gurudwara found",
      });
    }

    // Check if user already scanned the qr today
    const todayDate = new Date().toISOString().split(" ")[0];
    const [checkLog] = await db.query(
      `SELECT * FROM points_earned 
      WHERE user_id = ? AND gurudwara_id = ? AND reward_type = 'qr_scanned 
      WHERE DATE(created_at) = ?'`,
      [userId, gurudwaraId, todayDate]
    );

    if (checkLog.length !== 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "You have already scanned this QR code today!",
      });
    }

    // Award points (you can make this configurable)
    const pointsToAward = 10; // Default points for QR scan

    // Insert points record
    await db.query(
      `INSERT INTO points_earned (user_id, reward_type, gurudwara_id, points) 
             VALUES (?, 'qr_scanned', ?, ?)`,
      [userId, gurudwaraId, pointsToAward]
    );

    // Get user's total points
    const totalPointsResult = await db.query(
      "SELECT SUM(points) as total_points FROM points_earned WHERE user_id = ?",
      [userId]
    );

    const totalPoints = totalPointsResult[0].total_points || 0;

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: `Congratulations! You earned ${pointsToAward} points for visiting ${gurudwara[0].name}!`,
      payload: {
        points: pointsToAward,
        totalPoints: totalPoints,
        gurudwaraName: gurudwara[0].name,
      },
    });
  } catch (err) {
    next(err);
  }
};
