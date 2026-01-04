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
      console.log(email, password);

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
  // Logout
  handleLogout: async (req, res) => {
    try {
      res.clearCookie("ADMIN_TOKEN");
      res.redirect("/admin/auth/login");
      req.session.toast = {
        type: "success",
        message: "Logged out successfully!",
      };
      return res.redirect("/admin/auth/login");
    } catch (err) {
      console.error("this is the error", err);
      res.redirect("/admin/");
    }
  },

  createAdmin: async(req, res) => { 
    const {email, password, role} = req.body; 
    try { 
      if(!email || !password || !role) { 
        return res.status(400).json({message: "All fields are required"});
      }
      if(!validator.isEmail(email)) { 
        return res.status(400).json({message: "Invalid Email"});
      }
      if(role !== "super_admin" && role !== "local_admin") { 
        return res.status(400).json({message: "Invalid Role"});
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const [admin] = await db.query(
        "INSERT INTO admins (email, password, role) VALUES (?, ?, ?)",
        [email, hashedPassword, role]
      );
      return res.status(200).json({message: "Admin created successfully"});
    } catch (error) { 
      console.error("this is the error", error);
      return res.status(500).json({message: "Something went wrong"});
    }
  },
  getAdmins: async(req,res) => { 
    try { 
      const [admins] = await db.query("SELECT * FROM admins");
      return res.status(200).json({admins});
    } catch (error) { 
      console.error("this is the error", error);
      return res.status(500).json({message: "Something went wrong"});
    }
  }
};
