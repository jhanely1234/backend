import { HistorialMedico } from "../models/historialMedico.model.js";
import { Consulta } from "../models/consulta.model.js";
import { ReservaCita } from "../models/reserva.model.js";

// Obtener historial medico por paciente
export const getHistorialMedicoPorPaciente = async (req, res) => {
  const { pacienteId } = req.params;

  try {
    // Buscar el historial médico del paciente
    const historialMedico = await HistorialMedico.findOne({
      paciente: pacienteId
    }).populate("paciente", "name lastname email");

    if (!historialMedico) {
      return res.status(404).json({
        message: "Historial médico no encontrado para el paciente especificado."
      });
    }

    // Buscar todas las consultas relacionadas con el paciente
    const consultas = await Consulta.find().populate({
      path: "citaMedica",
      match: { paciente: pacienteId },
      populate: [
        { path: "paciente", select: "name lastname email" },
        { path: "medico", select: "name lastname email especialidades" },
        { path: "especialidad_solicitada", select: "name" }
      ]
    });

    // Filtrar las consultas que tengan una cita médica válida para el paciente
    const consultasFiltradas = consultas.filter(
      (consulta) => consulta.citaMedica
    );

    // Añadir las consultas filtradas al historial médico
    historialMedico.consultas = consultasFiltradas;

    res.status(200).json(historialMedico);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener el historial médico."
    });
  }
};
