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

// obtener historial medico para todos los pacientes
export const getHistorialesMedicos = async (req, res) => {
  try {
    const historialMedico = await HistorialMedico.find();
    res.status(200).json(historialMedico);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener el historial medico."
    });
  }
};

// Obtener historial médico por consulta
export const getHistorialMedicoPorConsulta = async (req, res) => {
  const { consultaId } = req.params;

  try {
    // Buscar la consulta por consultaId
    const consulta = await ReservaCita.findById(consultaId).populate({
      path: "citaMedica",
      populate: [
        { path: "paciente", select: "name lastname email" },
        { path: "medico", select: "name lastname email especialidades" },
        { path: "especialidad_solicitada", select: "name" }
      ]
    });

    if (!consulta) {
      return res.status(404).json({ message: "Consulta no encontrada." });
    }

    // Obtener el paciente de la consulta
    const pacienteId = consulta.citaMedica.paciente._id;

    // Buscar el historial médico del paciente
    const historialMedico = await HistorialMedico.findOne({
      paciente: pacienteId
    }).populate("paciente", "name lastname email");

    if (!historialMedico) {
      return res.status(404).json({
        message: "Historial médico no encontrado para el paciente especificado."
      });
    }

    // Filtrar las consultas para incluir solo la que corresponde al consultaId
    const consultasFiltradas = [consulta]; // Solo una consulta es relevante

    // Añadir la consulta filtrada al historial médico
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

// Obtener historial médico por reservaId
export const getHistorialMedicoPorReserva = async (req, res) => {
  const { reservaId } = req.params;

  try {
    // Buscar la reserva por reservaId
    const reserva = await ReservaCita.findById(reservaId)
      .populate("paciente", "name lastname email")
      .populate("medico", "name lastname email especialidades")
      .populate("especialidad_solicitada", "name");

    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    // Obtener el paciente de la reserva
    const pacienteId = reserva.paciente._id;

    // Buscar el historial médico del paciente
    const historialMedico = await HistorialMedico.findOne({
      paciente: pacienteId
    }).populate("paciente", "name lastname email");

    if (!historialMedico) {
      return res
        .status(404)
        .json({
          message:
            "Historial médico no encontrado para el paciente especificado."
        });
    }

    // Buscar todas las consultas relacionadas con la reserva
    const consultas = await Consulta.find({ citaMedica: reservaId }).populate({
      path: "citaMedica",
      populate: [
        { path: "paciente", select: "name lastname email" },
        { path: "medico", select: "name lastname email especialidades" },
        { path: "especialidad_solicitada", select: "name" }
      ]
    });

    // Añadir las consultas encontradas al historial médico
    historialMedico.consultas = consultas;

    res.status(200).json(historialMedico);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al obtener el historial médico."
      });
  }
};
