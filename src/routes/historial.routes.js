import express from "express";
import {
  getHistorialMedicoPorPaciente,
} from "../controllers/historial.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();

router.get("/:pacienteId", getHistorialMedicoPorPaciente);



export default router;
