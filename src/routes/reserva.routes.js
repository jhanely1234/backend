import express from "express";
import {
  createReservaCita,
  getReservasCitas,
  updateReservaCita,
  deleteReservaCita,
  getReservaCita,
  obtenerHorasDisponiblesDelMedicoProximosDias
} from "../controllers/reserva.controller.js";
import { checkAuth } from "../middlewares/auth.middlleware.js";
const router = express.Router();

router.post("/create", createReservaCita);
router.get("/", getReservasCitas);
router.get("/:id", getReservaCita);
router.put("/:id", updateReservaCita);
router.delete("/:id", deleteReservaCita);

router.post("/dialibre", obtenerHorasDisponiblesDelMedicoProximosDias);

export default router;
