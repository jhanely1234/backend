import express from "express";
import {
  createConsulta,
  getConsultas,
  getConsulta,
  updateConsulta,
  deleteConsulta
} from "../controllers/consulta.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();

router.post("/create", createConsulta);
router.get("/", getConsultas);
router.get("/:id", getConsulta);
router.put("/:id", updateConsulta);
router.delete("/:id", deleteConsulta);

export default router;
