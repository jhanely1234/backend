/*
import { ReservaCita } from "../models/reserva.model.js";
import { User } from "../models/user.model.js";
import { Especialidades } from "../models/especialidad.model.js";
import sendWhatsAppMessage from "../services/twilio.service.js";
import mongoose from "mongoose";
import { addDays, eachDayOfInterval, format } from 'date-fns';
import { parseISO, add, differenceInMilliseconds, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale/es";


export const createReservaCita = async (req, res) => {
  const { pacienteId, medicoId, especialidadId, fechaReserva, horaInicio } = req.body;

  try {
    console.log("Iniciando creación de reserva de cita...");

    // Verificar que el médico exista y tenga la especialidad seleccionada
    console.log("Buscando al médico...");
    const medico = await User.findById(medicoId).populate("especialidades roles", "-password");

    if (!medico || !medico.especialidades.some((e) => e._id.toString() === especialidadId)) {
      console.log("El médico no existe o no tiene la especialidad seleccionada.");
      return res.status(400).json({ message: "El médico no tiene la especialidad seleccionada." });
    }

    console.log("Médico encontrado:", medico.name);

    // Verificar si existe disponibilidad y que esté bien definida
    if (!medico.disponibilidad || medico.disponibilidad.length === 0) {
      console.log("El médico no tiene disponibilidades registradas.");
      return res.status(400).json({ message: "El médico no tiene disponibilidades registradas." });
    }

    // Imprimir la disponibilidad del médico para revisar los datos
    console.log("Disponibilidades del médico:", medico.disponibilidad);

    // Obtener la disponibilidad del médico para la especialidad seleccionada
    const disponibilidadEspecialidad = medico.disponibilidad.find(
      (disp) => disp.especialidad.toString() === especialidadId
    );

    // Verificar que se haya encontrado una disponibilidad para esa especialidad
    if (!disponibilidadEspecialidad) {
      console.log("No se encontró disponibilidad para la especialidad seleccionada.");
      return res.status(400).json({ message: "El médico no tiene disponibilidad para la especialidad seleccionada." });
    }

    console.log("Disponibilidad encontrada para la especialidad seleccionada:", disponibilidadEspecialidad);

    // Validar el día de la semana de la fecha de reserva
    const fechaReservaDate = parseISO(fechaReserva);
    let diaSemana = format(fechaReservaDate, "EEEE", { locale: es }).toLowerCase();
    diaSemana = diaSemana.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Normaliza caracteres especiales

    // Validar si la fecha de la reserva coincide con la disponibilidad del médico para ese día de la semana
    const disponibilidadDia = disponibilidadEspecialidad.dia.toLowerCase() === diaSemana;

    if (!disponibilidadDia) {
      console.log("El día seleccionado no coincide con la disponibilidad del médico.");
      return res.status(400).json({
        message: `El médico solo está disponible los ${disponibilidadEspecialidad.dia} para esta especialidad.`
      });
    }

    // Validar si la hora de inicio está dentro del rango de horas disponibles
    if (!isWithinInterval(parseISO(`${fechaReserva}T${horaInicio}:00`), {
      start: parseISO(`${fechaReserva}T${disponibilidadEspecialidad.inicio}:00`),
      end: parseISO(`${fechaReserva}T${disponibilidadEspecialidad.fin}:00`)
    })) {
      console.log("La hora seleccionada no está dentro del rango de horas disponibles.");
      return res.status(400).json({
        message: `El médico está disponible entre las ${disponibilidadEspecialidad.inicio} y ${disponibilidadEspecialidad.fin} para esta especialidad.`
      });
    }

    // Validar que la hora de inicio no sea igual a la hora de fin
    if (horaInicio === disponibilidadEspecialidad.fin) {
      console.log("No se puede crear la reserva porque la hora de inicio coincide con la hora de fin del médico.");
      return res.status(400).json({
        message: "No se puede crear la reserva porque la hora de inicio coincide con la hora de fin del médico."
      });
    }

    // Verificar que la especialidad exista
    console.log("Verificando la especialidad...");
    const especialidad = await Especialidades.findById(especialidadId);
    if (!especialidad) {
      console.log("La especialidad no existe.");
      return res.status(400).json({ message: "La especialidad no existe." });
    }

    console.log("Especialidad encontrada:", especialidad.name);

    // Determinar la duración de la cita según la especialidad
    let duracionCitaMinutos = 30; // Por defecto 30 minutos para otras especialidades
    if (especialidad.name.toLowerCase() === "medicina general") {
      duracionCitaMinutos = 20; // 20 minutos para Medicina General
    }

    // Calcular horaFin según la duración de la cita
    const horaFin = format(
      add(parseISO(`${fechaReserva}T${horaInicio}:00`), { minutes: duracionCitaMinutos }),
      "HH:mm"
    );

    console.log(`La cita durará ${duracionCitaMinutos} minutos. Hora fin: ${horaFin}`);

    // Verificar que no exista una reserva en la misma fecha y hora
    console.log("Verificando reserva existente...");
    const reservaExistente = await ReservaCita.findOne({
      medico: medicoId,
      fechaReserva: new Date(fechaReserva),
      horaInicio: horaInicio,
      horaFin: horaFin
    });

    if (reservaExistente) {
      console.log("Ya existe una reserva en la misma fecha y hora.");
      return res.status(400).json({ message: "Ya existe una reserva en la misma fecha y hora." });
    }

    console.log("No existe reserva previa en la misma fecha y hora.");

    // Verificar que el paciente exista
    console.log("Buscando al paciente...");
    const paciente = await User.findById(pacienteId).populate("roles", "-password");
    if (!paciente) {
      console.log("El paciente no existe.");
      return res.status(400).json({ message: "El paciente no existe." });
    }

    console.log("Paciente encontrado:", paciente.name);

    // Crear y guardar la reserva
    console.log("Creando y guardando reserva de cita...");
    const reserva = new ReservaCita({
      paciente: pacienteId,
      medico: medicoId,
      especialidad_solicitada: especialidadId,
      fechaReserva: new Date(fechaReserva),
      horaInicio: horaInicio,
      horaFin: horaFin,
      estado_horario: 'OCUPADO'
    });
    await reserva.save();

    console.log("Reserva de cita creada correctamente.");

    // Programar el envío de notificación por WhatsApp después de 2 minutos
    const mensajePaciente =
      `👋👨‍⚕️ *Hola ${paciente.name} ${paciente.lastname}*,\n\n` +
      `📅 Tu reserva con _${medico.name} ${medico.lastname}_\n\n` +
      `👩‍⚕️ en la especialidad de *${especialidad.name}*\n\n` +
      `⏰ está programada para la fecha *${format(fechaReservaDate, "EEEE d 'de' MMMM", { locale: es })}*.\n\n` +
      `✅ Horario: *${horaInicio} - ${horaFin}*\n\n` +
      `✅ Por favor, confirma tu asistencia o cancela la cita.`;

    const mensajeMedico =
      `👋👨‍⚕️ *Hola Dr. ${medico.name} ${medico.lastname}*,\n\n` +
      `👤 Tiene una nueva reserva con el paciente *${paciente.name} ${paciente.lastname}*\n\n` +
      `👩‍⚕️ en la especialidad de *${especialidad.name}*\n\n` +
      `⏰ programada para la fecha *${format(fechaReservaDate, "EEEE d 'de' MMMM", { locale: es })}*.\n\n` +
      `✅ Horario: *${horaInicio} - ${horaFin}*\n\n` +
      `✅ Por favor, confirme o cancele la cita.`;

    setTimeout(async () => {
      try {
        await sendWhatsAppMessage(mensajePaciente, paciente.telefono);
        await sendWhatsAppMessage(mensajeMedico, medico.telefono);
      } catch (error) {
        console.error("Error al enviar mensaje de WhatsApp:", error);
      }
    }, 2 * 60 * 1000); // Esperar 2 minutos antes de enviar

    res.status(201).json({
      response: "success",
      message: "Reserva de cita creada correctamente"
    });
  } catch (error) {
    console.error("Error en la creación de reserva de cita:", error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al crear la reserva de cita"
    });
  }
};
*/

//registrar reserva

import { User } from '../models/user.model.js';
import { Especialidades } from '../models/especialidad.model.js';
import { ReservaCita } from '../models/reserva.model.js';
import { Disponibilidad } from '../models/disponibilidad.model.js';
import mongoose from 'mongoose';

// Función para sumar minutos a una hora
const sumarMinutos = (hora, minutos) => {
  const [horaInt, minutosInt] = hora.split(':').map(Number);
  const nuevaHora = new Date();
  nuevaHora.setHours(horaInt);
  nuevaHora.setMinutes(minutosInt + minutos);
  const horaFin = nuevaHora.toTimeString().split(':').slice(0, 2).join(':');
  return horaFin;
};

// Función para verificar si la hora de inicio respeta los intervalos permitidos (20 o 30 minutos)
const esHoraValida = (horaInicio, duracion) => {
  const [_, minutosInicio] = horaInicio.split(':').map(Number);
  return minutosInicio % duracion === 0; // Verifica si los minutos son múltiplos de la duración
};

// Función para verificar si la hora de inicio permite que el fin esté dentro del rango disponible
const verificarHoraFinDentroRango = (horaInicio, duracion, horaFinDisponibilidad) => {
  const horaFinCalculada = sumarMinutos(horaInicio, duracion);
  return horaFinCalculada <= horaFinDisponibilidad; // Retorna true si la hora de fin calculada está dentro del rango permitido
};

// Controlador para crear una reserva
export const registrarReserva = async (req, res) => {
  const {
    pacienteId,
    medicoId,
    especialidadId,
    fechaReserva,
    horaInicio,
  } = req.body;

  // Validar que los IDs proporcionados sean ObjectIds válidos
  if (!mongoose.Types.ObjectId.isValid(pacienteId) || !mongoose.Types.ObjectId.isValid(medicoId) || !mongoose.Types.ObjectId.isValid(especialidadId)) {
    return res.status(400).json({ response: "error", message: "ID de paciente, médico o especialidad inválido." });
  }

  try {
    // Verificar si el paciente existe
    const paciente = await User.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json({ response: "error", message: "Paciente no encontrado." });
    }

    // Verificar si el médico existe y obtener sus especialidades y disponibilidad
    const medico = await User.findById(medicoId).populate('especialidades');
    if (!medico) {
      return res.status(404).json({ response: "error", message: "Médico no encontrado." });
    }

    // Verificar si el médico tiene la especialidad solicitada
    const tieneEspecialidad = medico.especialidades.some(especialidad => especialidad.equals(especialidadId));
    if (!tieneEspecialidad) {
      return res.status(400).json({ response: "error", message: "El médico no tiene la especialidad solicitada." });
    }

    // Obtener la disponibilidad del médico para la especialidad
    const disponibilidad = await Disponibilidad.findOne({ medico: medicoId, especialidad: especialidadId });
    if (!disponibilidad) {
      return res.status(400).json({ response: "error", message: "El médico no tiene disponibilidad para esta especialidad." });
    }

    // Verificar si la hora de inicio está dentro de la disponibilidad del médico
    if (horaInicio < disponibilidad.inicio || horaInicio >= disponibilidad.fin) {
      return res.status(400).json({
        response: "error",
        message: `El médico solo está disponible entre ${disponibilidad.inicio} y ${disponibilidad.fin}.`
      });
    }

    // Determinar la duración del intervalo dependiendo de la especialidad
    const especialidad = await Especialidades.findById(especialidadId);
    const duracion = especialidad.name.toLowerCase().includes("medicina general") ? 20 : 30;

    // Validar que la hora de inicio esté alineada con los intervalos permitidos (20 minutos para medicina general, 30 para otras)
    if (!esHoraValida(horaInicio, duracion)) {
      return res.status(400).json({
        response: "error",
        message: `La hora de inicio debe estar alineada a los intervalos de ${duracion} minutos. Ejemplos válidos: 08:00, 08:20, 08:40, etc.`
      });
    }

    // Verificar que la hora de inicio permita que la hora de fin no exceda la disponibilidad del médico
    const horaFin = sumarMinutos(horaInicio, duracion);
    if (!verificarHoraFinDentroRango(horaInicio, duracion, disponibilidad.fin)) {
      return res.status(400).json({
        response: "error",
        message: `La hora de fin ${horaFin} excede la disponibilidad del médico, que es hasta ${disponibilidad.fin}.`
      });
    }

    // Verificar si ya existe una reserva en el mismo horario para el médico
    const reservaExistente = await ReservaCita.findOne({
      medico: medicoId,
      fechaReserva: new Date(fechaReserva),
      horaInicio,
      horaFin
    });

    if (reservaExistente) {
      return res.status(400).json({ response: "error", message: "El médico ya tiene una reserva en ese horario." });
    }

    // Crear una nueva reserva
    const nuevaReserva = new ReservaCita({
      paciente: pacienteId,
      medico: medicoId,
      especialidad_solicitada: especialidadId,
      fechaReserva: new Date(fechaReserva),
      horaInicio,
      horaFin,
    });

    // Guardar la reserva en la base de datos
    await nuevaReserva.save();

    return res.status(201).json({
      response: "success",
      message: "Reserva creada exitosamente.",
      reserva: nuevaReserva
    });
  } catch (error) {
    console.error("Error al registrar la reserva:", error);
    return res.status(500).json({ response: "error", message: "Error del servidor al registrar la reserva." });
  }
};


// Obtener todas las citas
export const getCitas = async (req, res) => {
  try {
    const citas = await ReservaCita.find()
      .populate('paciente', 'name lastname')
      .populate('medico', 'name lastname')
      .populate('especialidad_solicitada', 'name');

    if (citas.length === 0) {
      return res.status(404).json({ response: "error", message: "No se encontraron citas." });
    }

    return res.status(200).json({ response: "success", citas });
  } catch (error) {
    console.error("Error al obtener las citas:", error);
    return res.status(500).json({ response: "error", message: "Error del servidor al obtener las citas." });
  }
};


// Obtener una cita por su ID
export const getCitaById = async (req, res) => {
  const { citaId } = req.params;

  // Validar que el ID proporcionado sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(citaId)) {
    return res.status(400).json({ response: "error", message: "ID de cita inválido." });
  }

  try {
    const cita = await ReservaCita.findById(citaId)
      .populate('paciente', 'name lastname')
      .populate('medico', 'name lastname')
      .populate('especialidad_solicitada', 'name');

    if (!cita) {
      return res.status(404).json({ response: "error", message: "Cita no encontrada." });
    }

    return res.status(200).json({ response: "success", cita });
  } catch (error) {
    console.error("Error al obtener la cita:", error);
    return res.status(500).json({ response: "error", message: "Error del servidor al obtener la cita." });
  }
};


// Eliminar una cita (solo si el estado es "cancelado")
export const eliminarCita = async (req, res) => {
  const { citaId } = req.params;

  // Validar que el ID proporcionado sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(citaId)) {
    return res.status(400).json({ response: "error", message: "ID de cita inválido." });
  }

  try {
    // Buscar la cita por su ID
    const cita = await ReservaCita.findById(citaId);

    if (!cita) {
      return res.status(404).json({ response: "error", message: "Cita no encontrada." });
    }

    // Verificar si el estado de la cita es "cancelado"
    if (cita.estado !== 'cancelado') {
      return res.status(400).json({
        response: "error",
        message: `No se puede eliminar la cita. El estado actual es: ${cita.estado}.`
      });
    }

    // Eliminar la cita
    await cita.remove(citaId);

    return res.status(200).json({
      response: "success",
      message: "Cita eliminada exitosamente."
    });
  } catch (error) {
    console.error("Error al eliminar la cita:", error);
    return res.status(500).json({ response: "error", message: "Error del servidor al eliminar la cita." });
  }
};
