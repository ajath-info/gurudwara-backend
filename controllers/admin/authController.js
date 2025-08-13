import { db } from "../../utils/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as DOTENV from "../../utils/dotenv.js";
import validator from "validator";
import { ADMIN_TITLES } from "../../utils/constant.js";
import { generateToken } from "../../utils/helper.js";

export const authController = {
  loginPage: async (req, res) => {
    try {
      return res.render("auth/login", { title: ADMIN_TITLES.LOGIN_TITLE });
    } catch (err) {
      return res.render("auth/login", { title: ADMIN_TITLES.LOGIN_TITLE });
    }
  },
  handleLogin: async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.render("auth/login", {
          title: ADMIN_TITLES.LOGIN_TITLE,
          message: "Email and password are required",
          toast: {
            type: "error",
            message: "Email and password are required",
          },
        });
      }

      // Form Validation
      if (!validator.isEmail(email)) {
        return res.render("auth/login", {
          title: ADMIN_TITLES.LOGIN_TITLE,
          message: "Invalid Email",
          toast: {
            type: "error",
            message: "Invalid Email",
          },
        });
      }

      // Check if the admin exists
      const [admin] = await db.query(
        `SELECT * FROM admins WHERE email = ? AND status = '1'`,
        [email]
      );
      if (admin.length === 0) {
        return res.render("auth/login", {
          title: ADMIN_TITLES.LOGIN_TITLE,
          message: "Invalid Credentials",
          toast: {
            type: "error",
            message: "Invalid Credentials",
          },
        });
      }
      const foundAdmin = admin[0];

      const isValidPassword = await bcrypt.compare(
        password,
        foundAdmin.password
      );

      if (!isValidPassword) {
        return res.render("auth/login", {
          title: ADMIN_TITLES.LOGIN_TITLE,
          message: "Invalid Password",
          toast: {
            type: "error",
            message: "Invalid Password",
          },
        });
      }

      //Generate token
      const token = await generateToken(foundAdmin.id);

      const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      };

      if (rememberMe) {
        cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      res.cookie("ADMIN_TOKEN", token, cookieOptions);
      res.redirect("/admin");
    } catch (error) {
      console.log(error.message);
      res.status(500).render("auth/login", {
        title: ADMIN_TITLES.LOGIN_TITLE,
        message: "Something went wrong",
        toast: {
          type: "error",
          message: "Something went wrong",
        },
      });
    }
  },
};
