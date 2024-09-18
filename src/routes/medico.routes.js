import express from "express";
import {
  registerMedico,
  getMedico,
  getMedicos,
  updateMedico,
  deleteMedico,
  getMedicosByEspecialidad,
  getEspecialidadesByMedico
} from "../controllers/medico.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";

const router = express.Router();

router.post("/register", registerMedico);
router.get("/:id", getMedico);
router.get("/", getMedicos);
router.put("/:id", updateMedico);
router.delete("/:id", deleteMedico);

// Ruta para obtener médicos por especialidad
router.get("/especialidad/:especialidadId", getMedicosByEspecialidad);

// Ruta para obtener especialidades por médico
router.get("/medicos/:medicoId/especialidades", getEspecialidadesByMedico);

export default router;
