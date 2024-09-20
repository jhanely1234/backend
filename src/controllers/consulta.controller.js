import { Consulta } from "../models/consulta.model.js";
import { ReservaCita } from "../models/reserva.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { formatInTimeZone } from 'date-fns-tz';
import axios from "axios";

// Controlador para registrar una nueva consulta médica
export const registrarConsulta = async (req, res) => {
  const {
    citaMedica, // ID de la reserva médica (cita)
    motivo_consulta = "", // Opcional
    signos_vitales = [], // Puede estar vacío inicialmente
    examen_fisico = "", // Opcional
    diagnostico = "", // Opcional
    conducta = "", // Opcional
    receta = "", // Opcional
  } = req.body;

  // Validar que el ID de la cita sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(citaMedica)) {
    return res.status(400).json({
      response: "error",
      message: "ID de cita médica inválido.",
    });
  }

  try {
    // Verificar si la cita médica existe y está en estado pendiente
    const reserva = await ReservaCita.findById(citaMedica);
    if (!reserva) {
      return res.status(404).json({
        response: "error",
        message: "Cita médica no encontrada.",
      });
    }

    if (reserva.estado_reserva !== "pendiente") {
      return res.status(400).json({
        response: "error",
        message: "La cita médica ya fue atendida o está cancelada.",
      });
    }

    // Obtener la hora actual en la zona horaria de America/La_Paz
    const zonaHoraria = 'America/La_Paz';
    const horaInicio = formatInTimeZone(new Date(), zonaHoraria, 'HH:mm');

    // Crear una nueva consulta
    const nuevaConsulta = new Consulta({
      citaMedica,
      motivo_consulta,
      signos_vitales, // Puede estar vacío
      examen_fisico, // Puede estar vacío
      diagnostico, // Puede estar vacío
      conducta, // Puede estar vacío
      receta, // Puede estar vacío
      horaInicio, // La hora de inicio es la hora actual en la zona horaria especificada
      horaFin: "", // Inicialmente vacío
    });

    // Guardar la consulta en la base de datos
    await nuevaConsulta.save();

    // Cambiar el estado de la reserva médica a "atendido"
    reserva.estado_reserva = "atendido";
    await reserva.save();

    return res.status(201).json({
      response: "success",
      message: "Consulta registrada exitosamente.",
      consulta: nuevaConsulta,
    });
  } catch (error) {
    console.error("Error al registrar la consulta médica:", error);
    return res.status(500).json({
      response: "error",
      message: "Error del servidor al registrar la consulta médica.",
    });
  }
};

// Obtener todas las consultas
export const obtenerTodasLasConsultas = async (req, res) => {
  try {
    const consultas = await Consulta.find().populate('citaMedica', 'paciente medico especialidad_solicitada fechaReserva horaInicio horaFin');
    res.status(200).json({
      response: "success",
      consultas
    });
  } catch (error) {
    console.error("Error al obtener las consultas:", error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener las consultas."
    });
  }
};

// Obtener una consulta por ID
export const obtenerConsultaPorId = async (req, res) => {
  const { id } = req.params;

  // Validar que el ID proporcionado sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ response: "error", message: "ID de consulta inválido." });
  }

  try {
    const consulta = await Consulta.findById(id).populate('citaMedica', 'paciente medico especialidad_solicitada fechaReserva horaInicio horaFin');
    if (!consulta) {
      return res.status(404).json({ response: "error", message: "Consulta no encontrada." });
    }

    res.status(200).json({
      response: "success",
      consulta
    });
  } catch (error) {
    console.error("Error al obtener la consulta:", error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener la consulta."
    });
  }
};

// Controlador para actualizar una consulta médica existente
export const actualizarConsulta = async (req, res) => {
  const { consultaId } = req.params;
  const {
    motivo_consulta,
    signos_vitales,
    examen_fisico,
    diagnostico,
    conducta,
    receta
  } = req.body;

  // Validar que el ID de la consulta sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(consultaId)) {
    return res.status(400).json({
      response: "error",
      message: "ID de consulta inválido.",
    });
  }

  try {
    // Buscar la consulta existente
    const consultaExistente = await Consulta.findById(consultaId);
    if (!consultaExistente) {
      return res.status(404).json({
        response: "error",
        message: "Consulta médica no encontrada.",
      });
    }

    // No modificar el campo `citaMedica`
    if (motivo_consulta) consultaExistente.motivo_consulta = motivo_consulta;
    if (signos_vitales) consultaExistente.signos_vitales = signos_vitales;
    if (examen_fisico) consultaExistente.examen_fisico = examen_fisico;
    if (diagnostico) consultaExistente.diagnostico = diagnostico;
    if (conducta) consultaExistente.conducta = conducta;
    if (receta) consultaExistente.receta = receta;

    // Actualizar `horaFin` con la hora actual en la zona horaria "America/La_Paz"
    const horaFin = formatInTimeZone(new Date(), 'America/La_Paz', 'HH:mm');
    consultaExistente.horaFin = horaFin;

    // Guardar los cambios
    const consultaActualizada = await consultaExistente.save();

    return res.status(200).json({
      response: "success",
      message: "Consulta actualizada exitosamente.",
      consulta: consultaActualizada,
    });
  } catch (error) {
    console.error("Error al actualizar la consulta médica:", error);
    return res.status(500).json({
      response: "error",
      message: "Error del servidor al actualizar la consulta médica.",
    });
  }
};

// Eliminar una consulta
export const eliminarConsulta = async (req, res) => {
  const { id } = req.params;

  // Validar que el ID proporcionado sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ response: "error", message: "ID de consulta inválido." });
  }

  try {
    const consultaEliminada = await Consulta.findByIdAndDelete(id);

    if (!consultaEliminada) {
      return res.status(404).json({ response: "error", message: "Consulta no encontrada." });
    }

    res.status(200).json({
      response: "success",
      message: "Consulta eliminada exitosamente."
    });
  } catch (error) {
    console.error("Error al eliminar la consulta:", error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al eliminar la consulta."
    });
  }
};

// Controlador para obtener los detalles de una consulta de un paciente específico
export const getDetallesConsultaPorPaciente = async (req, res) => {
  const { pacienteId, consultaId } = req.params;

  // Validar que los IDs proporcionados sean ObjectIds válidos
  if (!mongoose.Types.ObjectId.isValid(pacienteId) || !mongoose.Types.ObjectId.isValid(consultaId)) {
    return res.status(400).json({
      response: "error",
      message: "ID de paciente o consulta inválido.",
    });
  }

  try {
    // Buscar la reserva asociada al paciente
    const reserva = await ReservaCita.findOne({
      paciente: pacienteId,
    })
      .populate("paciente", "name lastname email")
      .populate("medico", "name lastname email")
      .populate("especialidad_solicitada", "name");

    if (!reserva) {
      return res.status(404).json({
        response: "error",
        message: "Reserva no encontrada para el paciente especificado.",
      });
    }

    // Buscar la consulta asociada a la cita médica (reserva)
    const consulta = await Consulta.findById(consultaId).populate({
      path: "citaMedica",
      match: { paciente: pacienteId },
      select: "receta"
    });

    if (!consulta) {
      return res.status(404).json({
        response: "error",
        message: "Consulta no encontrada para el paciente especificado.",
      });
    }

    // Devolver los detalles completos de la consulta, incluyendo los campos solicitados
    return res.status(200).json({
      response: "success",
      consulta: {
        paciente: reserva.paciente, // Nombre del paciente
        medico: reserva.medico, // Nombre del médico
        especialidad: reserva.especialidad_solicitada.name, // Especialidad médica
        fechaConsulta: reserva.fechaReserva, // Fecha de la consulta
        horaInicio: reserva.horaInicio, // Hora de inicio de la consulta
        motivo_consulta: consulta.motivo_consulta,
        signos_vitales: consulta.signos_vitales,
        examen_fisico: consulta.examen_fisico || "No realizado",
        diagnostico: consulta.diagnostico,
        conducta: consulta.conducta,
        receta: consulta.receta || "No prescrita",
      },
    });
  } catch (error) {
    console.error("Error al obtener los detalles de la consulta:", error);
    return res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener los detalles de la consulta.",
    });
  }
};

// Controlador para enviar la receta al WhatsApp del paciente
export const enviarRecetaPorWhatsApp = async (req, res) => {
  const { consultaId } = req.params;

  // Validar que el ID de la consulta sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(consultaId)) {
    return res.status(400).json({
      response: "error",
      message: "ID de consulta inválido.",
    });
  }

  try {
    // Buscar la consulta y la reserva médica asociada
    const consulta = await Consulta.findById(consultaId).populate("citaMedica");

    if (!consulta) {
      return res.status(404).json({
        response: "error",
        message: "Consulta no encontrada.",
      });
    }

    // Obtener los detalles del paciente y el médico a través de la reserva
    const reserva = await ReservaCita.findById(consulta.citaMedica._id)
      .populate("paciente", "name lastname telefono")
      .populate("medico", "name lastname");

    if (!reserva) {
      return res.status(404).json({
        response: "error",
        message: "Reserva médica no encontrada.",
      });
    }

    const paciente = reserva.paciente;
    const medico = reserva.medico;

    // Verificar el número de teléfono del paciente
    console.log("Detalles del paciente:", paciente);

    // Verificar si el paciente tiene un número de celular registrado
    if (!paciente.telefono) {
      return res.status(400).json({
        response: "error",
        message: "El paciente no tiene un número de celular registrado.",
      });
    }

    // Crear el mensaje que será enviado por WhatsApp
    const message = `
Estimado/a ${paciente.name} ${paciente.lastname}, su receta es la siguiente:

Motivo de Consulta: ${consulta.motivo_consulta || "No especificado"}
Signos Vitales:
- Fc: ${consulta.signos_vitales[0]?.Fc || "N/A"}
- Fr: ${consulta.signos_vitales[0]?.Fr || "N/A"}
- Temperatura: ${consulta.signos_vitales[0]?.Temperatura || "N/A"}
- Peso: ${consulta.signos_vitales[0]?.peso || "N/A"}
- Talla: ${consulta.signos_vitales[0]?.talla || "N/A"}

Examen Físico: ${consulta.examen_fisico || "No especificado"}
Diagnóstico: ${consulta.diagnostico || "No especificado"}
Conducta: ${consulta.conducta || "No especificado"}
Receta: ${consulta.receta || "No se ha prescrito receta"}

Atendido por: Dr./Dra. ${medico.name} ${medico.lastname}
Fecha de Consulta: ${consulta.fechaHora.toLocaleDateString()}
    `;

    // Llamar a la API externa para enviar el mensaje por WhatsApp
    const apiResponse = await axios.post(process.env.WHATSAPP_API_URL, {
      message: message,
      phone: paciente.telefono, // Usamos el número de celular del paciente
    });

    // Verificar si la API respondió con éxito
    if (apiResponse.status === 200 || apiResponse.status === 201) {
      return res.status(200).json({
        response: "success",
        message: "Receta enviada al WhatsApp del paciente exitosamente.",
      });
    } else {
      return res.status(apiResponse.status).json({
        response: "error",
        message: "Error al enviar la receta al WhatsApp del paciente.",
      });
    }
  } catch (error) {
    console.error("Error al enviar la receta por WhatsApp:", error);
    return res.status(500).json({
      response: "error",
      message: "Error del servidor al enviar la receta por WhatsApp.",
    });
  }
};