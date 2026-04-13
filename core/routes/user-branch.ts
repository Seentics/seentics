import { Hono } from "hono";
import { userAuthRoutes } from "./auth";
import { websiteRoutes } from "./websites";
import { userProfileRoutes } from "./user-profiles";

const user = new Hono();
user.route("/auth", userAuthRoutes);
user.route("/websites", websiteRoutes);
user.route("/users", userProfileRoutes);
user.post("/accept-invite", (c) => c.json({ data: { ok: true } }));

export const userBranchRoutes = user;
