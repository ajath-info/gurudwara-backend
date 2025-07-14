import { ADMIN_TITLES } from "../../utils/constant.js";
export const dashboard = async (req, res) => {
  const admin = req.admin;
  console.log("this is the admin data", admin);
  res.render("dashboard", {
    title: ADMIN_TITLES.DASHBOARD_TITLE,
    layout: "layouts/admin",
    admin: admin,
    req: req,
  });
};
