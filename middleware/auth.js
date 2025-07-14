import jwt from "jsonwebtoken";
import { apiResponse } from "../utils/helper.js";
import { db } from "../utils/db.js";
import * as DOTENV from "../utils/dotenv.js";
import { ADMIN_TITLES } from "../utils/constant.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return apiResponse(res, {
        error: true,
        code: 401,
        message: "Unauthorized : No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, DOTENV.JWT_SECRET_KEY);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Clean up expired token from database
        await db.query(`DELETE FROM tokens WHERE user_id = ? AND token = ?`, [
          decoded?.id, // Use optional chaining since decoded might be undefined
          token,
        ]);
        return apiResponse(res, {
          error: true,
          code: 401,
          status: 0,
          message: "Token Expired",
        });
      } else if (err.name === "JsonWebTokenError") {
        return apiResponse(res, {
          error: true,
          code: 401,
          status: 0,
          message: "Invalid Token",
        });
      } else {
        return apiResponse(res, {
          error: true,
          code: 500,
          status: 0,
          message: "Something went wrong",
        });
      }
    }

    // Check if token exists in database and is still valid
    const [rows] = await db.query(
      `SELECT * FROM tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()`,
      [decoded.id, token]
    );

    if (rows.length === 0) {
      await db.query(`DELETE FROM tokens WHERE user_id = ? AND token = ?`, [
        decoded.id,
        token,
      ]);
      return apiResponse(res, {
        error: true,
        code: 401,
        status: 0,
        message: "Token Expired or revoked",
      });
    }

    // Attach user information to the request object
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
};

export const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.cookies.ADMIN_TOKEN;
    if (!token) {
      return res.redirect("/admin/auth/login", {
        title: ADMIN_TITLES.LOGIN_TITLE,
      });
    }
    const decoded = jwt.verify(token, DOTENV.JWT_SECRET_KEY);


    const [admin] = await db.query(
      `SELECT * FROM admins WHERE id = ? AND status = '1'`,
      [decoded.id]
    );

    if (admin.length === 0) {
      res.clearCookie("ADMIN_TOKEN");
      return res.redirect("/admin/auth/login", {
        title: ADMIN_TITLES.LOGIN_TITLE,
      });
    }

    const foundAdmin = admin[0];
    req.admin = foundAdmin;
    next();
  } catch (err) {
    console.error("Jwt validation error", err);
    res.clearCookie("ADMIN_TOKEN");
    return res.status(500).redirect("/admin/auth/login");
  }
};
