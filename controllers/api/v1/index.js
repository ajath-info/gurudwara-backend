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
    const [updatedUser] = await db.query(`SELECT * FROM users WHERE id = ?`, [
      userId,
    ]);

    // Get the token
    const [tokenRow] = await db.query(
      `SELECT * FROM tokens WHERE user_id = ?`,
      [userId]
    );
    const token = tokenRow[0];
    const user = updatedUser[0];
    const response = {
      token: token.token,
      ...user,
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

    // Validate coordinates if provided
    const hasValidCoordinates =
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      userLat >= -90 &&
      userLat <= 90 &&
      userLng >= -180 &&
      userLng <= 180;

    // Build base query with favourite status
    let baseQuery = `
      SELECT g.*,
        CASE 
          WHEN fg.id IS NOT NULL THEN 1 
          ELSE 0 
        END AS is_favourite
      FROM gurudwaras g 
      LEFT JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id 
        AND fg.user_id = ? 
        AND fg.status = '1'
      WHERE g.status = '1'
    `;

    // Count query (should match the main query conditions)
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM gurudwaras g 
      WHERE g.status = '1'
    `;

    let query;
    let queryParams;

    // Add distance calculation if user coordinates are valid
    if (hasValidCoordinates) {
      query = `
        SELECT g.*,
        CASE 
          WHEN fg.id IS NOT NULL THEN 1 
          ELSE 0 
        END AS is_favourite,
        (6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(?)) * cos(radians(g.latitude)) * 
            cos(radians(g.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(g.latitude))
          ))
        )) AS distance
        FROM gurudwaras g 
        LEFT JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id 
          AND fg.user_id = ? 
          AND fg.status = '1'
        WHERE g.status = '1' 
        ORDER BY distance ASC
        LIMIT ? OFFSET ?
      `;
      queryParams = [userLat, userLng, userLat, userId, limit, offset];
    } else {
      query = baseQuery + ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
      queryParams = [userId, limit, offset];
    }

    // Get total count for pagination
    const [countResult] = await db.query(countQuery);
    const total = countResult[0].total;

    // Get gurudwaras
    const [gurudwaraRows] = await db.query(query, queryParams);

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
      is_favourite: gurudwara.is_favourite ? 1 : 0,
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

// Alternative version if you want to get ONLY favourite gurudwaras
export const getFavouriteGurudwaras = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user.id;

    // Extract query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get user's location for distance calculation
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);

    // Validate coordinates if provided
    const hasValidCoordinates =
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      userLat >= -90 &&
      userLat <= 90 &&
      userLng >= -180 &&
      userLng <= 180;

    // Count query for favourites only
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM gurudwaras g 
      INNER JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id 
      WHERE g.status = '1' 
        AND fg.user_id = ? 
        AND fg.status = '1'
    `;

    let query;
    let queryParams;

    // Add distance calculation if user coordinates are valid
    if (hasValidCoordinates) {
      query = `
        SELECT g.*,
        1 AS is_favourite,
        (6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(?)) * cos(radians(g.latitude)) * 
            cos(radians(g.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(g.latitude))
          ))
        )) AS distance
        FROM gurudwaras g 
        INNER JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id 
        WHERE g.status = '1' 
          AND fg.user_id = ? 
          AND fg.status = '1'
        ORDER BY distance ASC
        LIMIT ? OFFSET ?
      `;
      queryParams = [userLat, userLng, userLat, userId, limit, offset];
    } else {
      query = `
        SELECT g.*, 1 AS is_favourite
        FROM gurudwaras g 
        INNER JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id 
        WHERE g.status = '1' 
          AND fg.user_id = ? 
          AND fg.status = '1'
        ORDER BY fg.created_at DESC
        LIMIT ? OFFSET ?
      `;
      queryParams = [userId, limit, offset];
    }

    // Get total count for pagination
    const [countResult] = await db.query(countQuery, [userId]);
    const total = countResult[0].total;

    // Get favourite gurudwaras
    const [gurudwaraRows] = await db.query(query, queryParams);

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
      is_favourite: Boolean(gurudwara.is_favourite),
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
      message: "Favourite gurudwaras fetched successfully",
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
      `SELECT * FROM favourite_gurudwaras WHERE gurudwara_id = ? AND user_id = ?`,
      [gurudwaraId, userId]
    );
    if (row.length !== 0 && row[0].status === "1") {
      await db.query(
        `UPDATE favourite_gurudwaras SET status = '2' WHERE id = ?`,
        [row[0].id]
      );
      return apiResponse(res, {
        error: false,
        code: 200,
        status: 1,
        message: "Gurudwara removed from the favourites",
      });
    }

    if (row.length !== 0 && row[0].status === "2") {
      await db.query(
        `UPDATE favourite_gurudwaras SET status = '1' WHERE id = ?`,
        [row[0].id]
      );
      return apiResponse(res, {
        error: false,
        code: 200,
        status: 1,
        message: "Gurudwara added to the favourites succesfully",
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

    const gurudwaraId = req.params.id;
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

    // Check if this gurudwara is marked as favourite by the user
    const [favouriteRow] = await db.query(
      `SELECT status FROM favourite_gurudwaras WHERE user_id = ? AND gurudwara_id = ? AND status = '1'`,
      [userId, gurudwaraId]
    );

    const [rewardsRows] = await db.query(
      `SELECT id, title, description, points, image_urls FROM rewards WHERE gurudwara_id = ? AND status = '1' ORDER BY created_at DESC`,
      [gurudwaraId]
    );

    const gurudwaraDetail = row.map((r) => {
      return {
        id: r.id,
        name: r.name,
        address: r.address,
        image_urls:
          typeof r.image_urls === "string"
            ? JSON.parse(r.image_urls)
            : r.image_urls,
        latitude: r.longitude,
        longitude: r.latitude,
        qr_code_url: r.qr_code_url,
        status: r.status,
        created_at: r.created_at,
        is_favourite: favouriteRow.length > 0 ? 1 : 0, // Add favourite status
      };
    });

    const rewards = rewardsRows.map((r) => {
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        points: r.points,
        image_urls:
          typeof r.image_urls === "string"
            ? JSON.parse(r.image_urls)
            : r.image_urls,
      };
    });

    const response = {
      gurudwaraDetails: {
        ...gurudwaraDetail[0], // Since it's a single gurudwara, take the first element
        created_at: formatDateTime(row[0].created_at),
        rewards: rewards || [],
      },
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Gurudwara details fetched successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get rewards redemption history with details
 */
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
        g.name as gurudwara_name,
        g.address as gurudwara_address,
        g.latitude as gurudwara_latitude,
        g.longitude as gurudwara_longitude,
        u.name as user_name,
        u.phone as user_phone
      FROM rewards_redeemed rr
      INNER JOIN rewards r ON rr.reward_id = r.id
      INNER JOIN users u ON rr.user_id = u.id
      INNER JOIN gurudwaras g ON r.gurudwara_id = g.id
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
          image_urls:
            typeof r.reward_images === "string"
              ? JSON.parse(r.reward_images)
              : r.reward_images,
          points: r.reward_points,
          gurudwara_id: r.gurudwara_id,
        },
        gurudwara_location: {
          id: r.gurudwara_id,
          name: r.gurudwara_name,
          address: r.gurudwara_address,
          latitude: r.gurudwara_latitude,
          longitude: r.gurudwara_longitude,
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

    const quizzes = availableQuizzes.map((quiz) => ({
      id: quiz.id,
      question: quiz.question,
      options: [quiz.option_1, quiz.option_2, quiz.option_3, quiz.option_4],
      correct_option: quiz.correct_option,
      points: quiz.points,
    }));
    const response = {
      quizzes: quizzes,
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

    const { quizzes } = req.body; // Expected format: [{ quizId: 1, selectedOption: 2 }, ...]

    if (!quizzes || !Array.isArray(quizzes) || quizzes.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message:
          "Invalid quiz data. Expected array of quizzes with quizId and selectedOption",
      });
    }

    const quizIds = quizzes.map((q) => q.quizId);

    // Check if all quizzes exist
    const [checkQuizzes] = await db.query(
      `SELECT * FROM quizzes WHERE id IN (${quizIds
        .map(() => "?")
        .join(",")}) AND status = '1'`,
      quizIds
    );

    if (checkQuizzes.length !== quizIds.length) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "One or more quizzes not found",
      });
    }

    // Check if the user has already submitted any of these quizzes
    const [checkSubmissions] = await db.query(
      `SELECT quiz_id FROM quiz_submissions WHERE user_id = ? AND quiz_id IN (${quizIds
        .map(() => "?")
        .join(",")})`,
      [userId, ...quizIds]
    );

    if (checkSubmissions.length > 0) {
      const alreadySubmitted = checkSubmissions.map((s) => s.quiz_id);
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: `You have already submitted quiz(es): ${alreadySubmitted.join(
          ", "
        )}`,
      });
    }

    // Create a map of quiz data for easy lookup
    const quizMap = {};
    checkQuizzes.forEach((quiz) => {
      quizMap[quiz.id] = quiz;
    });

    const results = [];
    let totalPointsEarned = 0;
    let totalPossiblePoints = 0;

    await db.query(`START TRANSACTION`);

    try {
      // Process each quiz submission
      for (const quizSubmission of quizzes) {
        const { quizId, selectedOption } = quizSubmission;
        const quiz = quizMap[quizId];

        if (!quiz) {
          throw new Error(`Quiz ${quizId} not found`);
        }

        const isCorrect = Number(selectedOption) === quiz.correct_option;
        const pointsEarned = isCorrect ? quiz.points : 0;

        totalPointsEarned += pointsEarned;
        totalPossiblePoints += quiz.points;

        // Insert quiz submission
        await db.query(
          `INSERT INTO quiz_submissions (user_id, quiz_id, selected_option, is_correct, points_earned) VALUES (?,?,?,?,?)`,
          [userId, quizId, selectedOption, isCorrect, pointsEarned]
        );

        // Insert points earned if correct
        if (isCorrect) {
          await db.query(
            `INSERT INTO points_earned (user_id, reward_type, quiz_id, points) VALUES (?,?,?,?)`,
            [userId, "quiz", quizId, pointsEarned]
          );
        }

        // Add to results
        results.push({
          quizId,
          selectedOption,
          correctOption: quiz.correct_option,
          isCorrect,
          pointsEarned,
          quizPoints: quiz.points,
          message: isCorrect
            ? "Correct answer!"
            : "Wrong answer, better luck next time!",
        });
      }

      await db.query(`COMMIT`);

      const response = {
        quizResults: results,
        summary: {
          totalQuizzes: quizzes.length,
          correctAnswers: results.filter((r) => r.isCorrect).length,
          totalPointsEarned,
          totalPossiblePoints,
          percentage:
            totalPossiblePoints > 0
              ? ((totalPointsEarned / totalPossiblePoints) * 100).toFixed(2)
              : 0,
        },
      };

      return apiResponse(res, {
        error: false,
        code: 200,
        status: 1,
        message: "Quizzes submitted successfully",
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

// Generate QR code endpoint
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
      message: "QR code generated successfully",
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

    const userLat = req.body?.lat;
    const userLng = req.body?.lng;

    let parsedQrData;
    try {
      parsedQrData = JSON.parse(qrData);
    } catch (err) {
      console.error(err);
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Invalid QR code format",
      });
    }

    // Fixed: changed from 'type' to 'visit' and fixed typo
    if (parsedQrData.visit !== "gurudwara_visit" || !parsedQrData.id) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Invalid QR code type",
      });
    }

    const gurudwaraId = parsedQrData.id;

    // Check if the gurudwara exists and get its points configuration
    const [gurudwara] = await db.query(
      `SELECT * FROM gurudwaras WHERE id = ? AND status = '1'`,
      [gurudwaraId]
    );

    if (gurudwara.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "No gurudwara found",
      });
    }

    // Check if user already scanned the qr today
    const todayDate = new Date().toISOString().split("T")[0];
    const [checkLog] = await db.query(
      `SELECT * FROM attendance_logs
       WHERE user_id = ? AND gurudwara_id = ? AND visit_date = ? 
       AND DATE(created_at) = ?`,
      [userId, gurudwaraId, todayDate, todayDate]
    );
    console.log(checkLog[0]);

    if (checkLog.length !== 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "You have already scanned this QR code today!",
      });
    }

    // Get points from gurudwara configuration
    const pointsToAward = gurudwara[0].qr_scan_points || 10;

    // // Collect device info
    // const deviceInfo = {
    //   userAgent: req.headers["user-agent"] || "unknown",
    //   ip: req.ip || req.connection.remoteAddress || "unknown",
    //   platform: req.headers["x-platform"] || "unknown",
    //   appVersion: req.headers["x-app-version"] || "unknown",
    //   timestamp: new Date().toISOString(),
    // };

    // Insert attendance record
    await db.query(
      `INSERT INTO attendance_logs 
       (user_id, gurudwara_id, visit_date, visit_time, points_awarded, latitude, longitude) 
       VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?)`,
      [userId, gurudwaraId, pointsToAward, userLat, userLng]
    );

    // Insert points record
    await db.query(
      `INSERT INTO points_earned (user_id, reward_type, gurudwara_id, points) 
       VALUES (?, 'qr_scanned', ?, ?)`,
      [userId, gurudwaraId, pointsToAward]
    );

    // Get user's total points
    const [totalPointsResult] = await db.query(
      "SELECT SUM(points) as total_points FROM points_earned WHERE user_id = ?",
      [userId]
    );

    if (totalPointsResult.length === 0) {
      res.status(404).json("No points earned yet");
    }

    console.log(totalPointsResult[0].total_points);

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

/**
 *
 */
// Advanced search with multiple filters
export const advancedSearchGurudwaras = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user.id;

    // Extract query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Search parameters
    const searchTerm = req.query.search?.trim();
    const searchBy = req.query.searchBy || "all";

    // Location parameters
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);
    const maxDistance = parseFloat(req.query.maxDistance); // in kilometers

    // Filters
    const favouritesOnly = req.query.favouritesOnly === "true";
    const sortBy = req.query.sortBy || "relevance";
    const sortOrder = req.query.sortOrder || "ASC";

    // Validate search term
    if (!searchTerm || searchTerm.length < 2) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Search term must be at least 2 characters long",
      });
    }

    // Validate coordinates if provided
    const hasValidCoordinates =
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      userLat >= -90 &&
      userLat <= 90 &&
      userLng >= -180 &&
      userLng <= 180;

    // Build search conditions
    let searchConditions = "";
    let searchParams = [];

    const escapedSearchTerm = `%${searchTerm}%`;

    switch (searchBy) {
      case "name":
        searchConditions = "AND g.name LIKE ?";
        searchParams = [escapedSearchTerm];
        break;
      case "address":
        searchConditions = "AND g.address LIKE ?";
        searchParams = [escapedSearchTerm];
        break;
      case "all":
      default:
        searchConditions = "AND (g.name LIKE ? OR g.address LIKE ?)";
        searchParams = [escapedSearchTerm, escapedSearchTerm];
        break;
    }

    // Add favourites filter
    let joinClause =
      "LEFT JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id AND fg.user_id = ? AND fg.status = '1'";
    let favouriteCondition = "";

    if (favouritesOnly) {
      joinClause =
        "INNER JOIN favourite_gurudwaras fg ON g.id = fg.gurudwara_id AND fg.user_id = ? AND fg.status = '1'";
    }

    // Build base query
    let baseQuery = `
      SELECT g.*,
        CASE 
          WHEN fg.id IS NOT NULL THEN 1 
          ELSE 0 
        END AS is_favourite
      FROM gurudwaras g 
      ${joinClause}
      WHERE g.status = '1'
      ${searchConditions}
      ${favouriteCondition}
    `;

    let query;
    let queryParams = [userId, ...searchParams];
    let countParams = [userId, ...searchParams];

    // Add distance calculation and filtering
    if (hasValidCoordinates) {
      let distanceCondition = "";
      if (maxDistance && !isNaN(maxDistance)) {
        distanceCondition = "HAVING distance <= ?";
        queryParams.push(maxDistance);
        countParams.push(maxDistance);
      }

      query = `
        SELECT g.*,
        CASE 
          WHEN fg.id IS NOT NULL THEN 1 
          ELSE 0 
        END AS is_favourite,
        (6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(?)) * cos(radians(g.latitude)) * 
            cos(radians(g.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(g.latitude))
          ))
        )) AS distance
        FROM gurudwaras g 
        ${joinClause}
        WHERE g.status = '1' 
        ${searchConditions}
        ${distanceCondition}
      `;
      queryParams = [userLat, userLng, userLat, userId, ...searchParams];
      if (maxDistance && !isNaN(maxDistance)) {
        queryParams.push(maxDistance);
      }
    } else {
      query = baseQuery;
    }

    // Count query (simplified for performance)
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM gurudwaras g 
      ${joinClause}
      WHERE g.status = '1'
      ${searchConditions}
    `;

    // Add sorting
    let orderByClause = "";
    switch (sortBy) {
      case "distance":
        if (hasValidCoordinates) {
          orderByClause = `ORDER BY distance ${sortOrder}`;
        } else {
          orderByClause = `ORDER BY g.created_at DESC`;
        }
        break;
      case "name":
        orderByClause = `ORDER BY g.name ${sortOrder}`;
        break;
      case "created_at":
        orderByClause = `ORDER BY g.created_at ${sortOrder}`;
        break;
      case "relevance":
      default:
        orderByClause = `ORDER BY g.name ASC`;
        break;
    }

    // Add pagination
    query += ` ${orderByClause} LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    // Get total count for pagination
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    // Get search results
    const [gurudwaraRows] = await db.query(query, queryParams);

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
      is_favourite: gurudwara.is_favourite ? 1 : 0,
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
      searchInfo: {
        searchTerm,
        searchBy,
        sortBy,
        sortOrder,
        favouritesOnly,
        maxDistance: maxDistance || null,
        resultsFound: total,
      },
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
      message:
        total > 0
          ? `Found ${total} gurudwara(s) matching your search`
          : "No gurudwaras found matching your search criteria",
      payload: response,
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
 * @returns
 */
export const editProfile = async (req, res, next) => {
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

    const { name, phone, profileImage } = req.body;

    const errors = [];
    if (name && (name.length === 0 || name.length > 150)) {
      errors.push("Name must be in between 1 to 150 characters");
    }

    if (phone) {
      if (!validator.isMobilePhone(phone)) {
        errors.push("Enter a valid phone number");
      }
    }

    if (profileImage && !validator.isURL(profileImage)) {
      errors.push("Enter a valid profile image");
    }

    if (errors.length > 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: errors[0],
      });
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (profileImage) updateFields.profile_image = profileImage;
    if (phone) updateFields.phone = phone;

    if (Object.keys(updateFields).length === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "No fields to update",
      });
    }

    const setClause = Object.keys(updateFields)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = [...Object.values(updateFields), userId];

    const [insert] = await db.query(
      `UPDATE users SET ${setClause} WHERE id = ? AND status = '1'`,
      values
    );
    if (insert.affectedRows === 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Error in updating the user",
      });
    }

    // Fetched the updated user
    const [updatedUser] = await db.query(
      `SELECT * FROM users WHERE id = ? AND status = '1'`,
      [userId]
    );

    const user = updatedUser[0];
    // Prepare response
    const response = {
      ...user,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "User updated succesfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const getTermsCondition = async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM term_conditions`);

    if (rows.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "Terms and conditions not found",
        payload: {},
      });
    }
    const termsCondition = rows[0];

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Terms and conditions found",
      payload: {
        id: termsCondition.id,
        title: termsCondition.title,
        description: termsCondition.description,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPrivacyPolicy = async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM privacy_policy");

    if (rows.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "Privacy policy not found",
        payload: {},
      });
    }

    const privacyPolicy = rows[0];
    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Privacy policy found",
      payload: {
        id: privacyPolicy.id,
        title: privacyPolicy.title,
        description: privacyPolicy.description,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 *
 */
export const getPointsHistory = async (req, res, next) => {
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

    // Get total points for the user
    const totalPointsQuery = `
      SELECT COALESCE(SUM(points), 0) as total_points 
      FROM points_earned 
      WHERE user_id = ?
    `;
    const [deductedPoints] = await db.query(
      `SELECT SUM(points) as deducted_points FROM rewards_redeemed WHERE user_id = ?`,
      [userId]
    );
    const pointsDeducted = deductedPoints[0].deducted_points;
    const [totalResult] = await db.query(totalPointsQuery, [userId]);
    const totalPoints = totalResult[0].total_points - pointsDeducted;

    // Get points history grouped by gurudwara
    const historyQuery = `
      SELECT 
        g.id as gurudwara_id,
        g.name as gurudwara_name,
        g.image_urls,
        COALESCE(SUM(pe.points), 0) as total_points
      FROM gurudwaras g
      LEFT JOIN points_earned pe ON g.id = pe.gurudwara_id AND pe.user_id = ?
      WHERE pe.gurudwara_id IS NOT NULL
      GROUP BY g.id, g.name, g.image_urls
      HAVING total_points > 0
      ORDER BY total_points DESC
    `;

    const [historyResult] = await db.query(historyQuery, [userId]);

    // Format the response to match the screen structure
    const formattedHistory = historyResult.map((item) => ({
      gurudwara_id: item.gurudwara_id,
      gurudwara_name: item.gurudwara_name,
      image_urls: JSON.parse(item.image_urls || "[]"),
      points: item.total_points,
    }));

    const response = {
      total_points: totalPoints,
      history: formattedHistory,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Points history retrieved successfully",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

export const getVisitHistory = async (req, res, next) => {
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // First, let's get attendance logs with a simpler query to avoid JOIN issues
    const [attendanceLogs] = await db.query(
      `SELECT 
        id,
        user_id,
        gurudwara_id,
        visit_date,
        visit_time,
        points_awarded,
        is_first_visit_today,
        created_at
      FROM attendance_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Get total count for pagination
    const [totalCountResult] = await db.query(
      `SELECT COUNT(*) as total FROM attendance_logs WHERE user_id = ?`,
      [userId]
    );
    const totalCount = totalCountResult[0].total;

    if (attendanceLogs.length === 0) {
      return apiResponse(res, {
        error: false,
        code: 404,
        status: 1,
        message: "User has no visit history",
      });
    }

    // Get gurudwara details for each attendance log
    const gurudwaraIds = [
      ...new Set(attendanceLogs.map((log) => log.gurudwara_id)),
    ];
    let gurudwaraMap = {};

    if (gurudwaraIds.length > 0) {
      try {
        const [gurudwaras] = await db.query(
          `SELECT id, name, image_urls FROM gurudwaras WHERE id IN (${gurudwaraIds
            .map(() => "?")
            .join(",")})`,
          gurudwaraIds
        );
        gurudwaraMap = gurudwaras.reduce((acc, g) => {
          acc[g.id] = g;
          return acc;
        }, {});
      } catch (gurudwaraError) {
        console.log("Error fetching gurudwara details:", gurudwaraError);
        // Continue without gurudwara details if table doesn't exist
      }
    }

    // Format the response to match Figma design
    const formattedVisitHistory = attendanceLogs.map((aL) => ({
      id: aL.id,
      gurudwara_id: aL.gurudwara_id,
      gurudwara_name:
        gurudwaraMap[aL.gurudwara_id]?.name || `Gurudwara ${aL.gurudwara_id}`,
      gurudwara_image:
        typeof gurudwaraMap[aL.gurudwara_id]?.image_urls === "string"
          ? JSON.parse(gurudwaraMap[aL.gurudwara_id]?.image_urls)
          : gurudwaraMap[aL.gurudwara_id]?.image_urls,
      user_id: aL.user_id,
      visit_date: formatDateTime(aL.visit_date), // Format: YYYY-MM-DD
      visit_time: aL.visit_time, // Format: HH:MM:SS
      points_earned: aL.points_awarded || 0,
      isFirstTimeVisit:
        aL.is_first_visit_today === 1 || aL.is_first_visit_today === true,
    }));

    const response = {
      visit_history: formattedVisitHistory, // Fixed typo: was "visith_history"
      total_pages: Math.ceil(totalCount / limit), // Use actual total count
      current_page: page,
      limit: limit,
      total_records: totalCount,
    };

    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "Visit History fetched successfully", // Fixed typo: was "succesfully"
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};

/**
 *
 */
export const redeemRewards = async (req, res, next) => {
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

    const { rewardId } = req.body;
    if (!rewardId) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "Reward id is missing",
      });
    }

    // Check is the reward exists with this id
    const [checkReward] = await db.query(
      `SELECT * FROM rewards WHERE id = ? AND status = '1'`,
      [rewardId]
    );
    if (checkReward.length === 0) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "Reward not found",
      });
    }

    // Check if user has already redeemed this reward
    const [checkRedeemed] = await db.query(
      `SELECT * FROM rewards_redeemed WHERE user_id = ? AND reward_id = ?`,
      [userId, rewardId]
    );
    if (checkRedeemed.length > 0) {
      return apiResponse(res, {
        error: true,
        code: 400,
        status: 0,
        message: "You have already redeemed this reward",
      });
    }

    // Check if user has enough points to reedem this reward
    const [checkUserPoints] = await db.query(
      `SELECT SUM(points) as total_points FROM points_earned WHERE user_id = ?`,
      [userId]
    );

    const totalPoints = checkUserPoints[0].total_points;
    if (totalPoints < checkReward[0].points) {
      return apiResponse(res, {
        error: true,
        code: 404,
        status: 0,
        message: "You don't have enough points to redeem this reward",
      });
    }

    // Redeem the reward
    await db.query(
      `INSERT INTO rewards_redeemed (user_id, reward_id, points) VALUES (?,?,?)`,
      [userId, rewardId, checkReward[0].points]
    );
    const response = {
      user_id: userId,
      reward_id: rewardId,
      points_deducted: checkReward[0].points,
    };
    return apiResponse(res, {
      error: false,
      code: 200,
      status: 1,
      message: "You have succesfully redeemed the reward",
      payload: response,
    });
  } catch (err) {
    next(err);
  }
};
