import { db } from "../../../utils/db.js";
import validator from "validator";
import { apiResponse } from "../../../utils/helper.js";
import { generateOTP } from "../../../utils/helper.js";
import { generateToken } from "../../../utils/helper.js";
import { formatDateTime } from "../../../utils/helper.js";
import { formatDate } from "date-fns";

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
    const { phone, name, otp, fcmToken, deviceType } = req.body;
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
      // Validate name
      if (!name) {
        return apiResponse(res, {
          error: true,
          code: 400,
          status: 0,
          message: "Invalid name or name is missing",
        });
      }

   
      // Create new user
      const [insertResult] = await db.query(
        `INSERT INTO users (name, phone, fcm_token, device_type) VALUES(?,?,?,?)`,
        [name, phone, fcmToken, deviceType]
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
    const token = await generateToken(userId, name);

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


export const addFavouriteGurudwara = async(req, res, next)=> {
    try { 
        const user = req.user; 
        const userId = req.user.id;
        const gurudwaraId = req.params.id;
        
        // Check if user already has this gurudwara in favourites
        const [row] = await db.query(`SELECT * FROM favourite_gurudwaras WHERE gurudwara_id = ? AND user_id = ? AND status = '1'`,[gurudwaraId, userId])
        if(row.length !==0) { 
            return apiResponse(res, { 
                error : true, 
                code : 400, 
                status : 0, 
                message : 'User has already added this gurudwara to favourites',
            })
        }

        //Adding in the gurudwara in the favourites
        const [insertResult] = await db.query(`INSERT INTO favourite_gurudwaras (user_id, gurudwara_id) VALUES (?, ?)`, [userId, gurudwaraId]); 
        if(insertResult.affectedRows === 0 ){ 
            return apiResponse(res, {
                error : true, 
                code : 400,
                status : 0,
                message : 'Error in adding the gurudwara to the favourites'
            })
        }

       // Preapring response
        const response = {
            id : insertResult.insertId,
            user_id : userId,
            gurudwara_id : gurudwaraId,
        }

        return apiResponse(res, { 
            error : false, 
            code : 200, 
            status : 1, 
            message : 'Gurudwara added to the favourites successfully',
            payload : response
        })
    }catch(err){ 
        next(err)
    }
}

export const getAllFavouriteGurudwaras = async(req, res, next)=> {
    try { 
        const user = req.user; 
        const userId = user.id; 

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [rows] = await db.query(`SELECT * FROM favourite_gurudwaras WHERE user_id = ? AND status = '1' LIMIT ? OFFSET ? `, [userId, limit, offset]);  
        if(rows.length === 0) { 
            return apiResponse(res, {
                error : false, 
                code : 404, 
                status : 0,
                message : 'No favourite gurudwaras found'
            })
        }

        const favouriteGurudwaras = rows.map(r => ({ 
            id : r.id,
            user_id : r.user_id,
            gurudwara_id : r.gurudwara_id,
            created_at : formatDateTime(r.created_at)

        }))
        return apiResponse(res, { 
            error : false,
            code : 200, 
            status : 1, 
            message : 'Favourite gurudwaras found successfully',
            payload : { 
                favouriteGurudwaras,
                page,
                limit,
            }
        })
    }catch(err) { 
        next(err)
    }
}