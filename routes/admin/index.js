import express from "express";
const ADMIN_ROUTER = express.Router();

ADMIN_ROUTER.get("/", (req, res) => {
  res.render("home");
});
export default ADMIN_ROUTER;