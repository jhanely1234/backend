import express from "express";
import {
  registrarReserva,
  getCitaById,
  getCitas,
  eliminarCita
} from "../controllers/reserva.controller.js";
import {

  getCalendarioMedicoPorEspecialidad,
  buscarMedicosPorEspecialidadId


} from "../controllers/medico.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();


router.get("/", getCitas);
router.get("/:citaId", getCitaById);
router.get("/medico/calendario/:medicoId/:especialidadId", getCalendarioMedicoPorEspecialidad);
router.get("/medico/especialidad/:especialidadId", buscarMedicosPorEspecialidadId);
router.post("/create", registrarReserva);
router.delete("/:citaId", eliminarCita);


export default router;
