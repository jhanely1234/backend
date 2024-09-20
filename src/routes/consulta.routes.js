import express from "express";
import {
  registrarConsulta,
  obtenerTodasLasConsultas,
  obtenerConsultaPorId,
  actualizarConsulta,
  eliminarConsulta
} from "../controllers/consulta.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();

router.post("/create", registrarConsulta);
router.get("/", obtenerTodasLasConsultas);
router.get("/:id", obtenerConsultaPorId);
router.put("/:consultaId", actualizarConsulta);
router.delete("/:id", eliminarConsulta);

export default router;
