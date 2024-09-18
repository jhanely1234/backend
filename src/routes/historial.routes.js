import express from "express";
import {
  getHistorialMedicoPorPaciente,
  getHistorialesMedicos,
  getHistorialMedicoPorConsulta,
  getHistorialMedicoPorReserva
} from "../controllers/historial.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();

router.get("/:pacienteId", getHistorialMedicoPorPaciente);

router.get("/consulta/:consultaId", getHistorialMedicoPorConsulta);

router.get("/reserva/:reservaId", getHistorialMedicoPorReserva);

router.get("/", getHistorialesMedicos);

export default router;
