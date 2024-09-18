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


// Obtener todas las reservas de citas
export const getReservasCitas = async (req, res) => {
  try {
    const reservas = await ReservaCita.find()
      .select("-__v -createdAt -updatedAt")
      .populate([
        {
          path: "paciente",
          select: "-password -especialidades -__v -createdAt -updatedAt",
          populate: { path: "roles", select: "name -_id" }
        },
        {
          path: "medico",
          select: "-password -__v -createdAt -updatedAt",
          populate: { path: "roles especialidades", select: "name -_id" }
        },
        { path: "especialidad_solicitada", select: "name -_id" }
      ]);
    res.status(200).json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener las reservas de citas"
    });
  }
};

// Obtener una reserva de cita
export const getReservaCita = async (req, res) => {
  const { id } = req.params;
  try {
    const reserva = await ReservaCita.findById(id)
      .select("-__v -createdAt -updatedAt")
      .populate([
        {
          path: "paciente",
          select: "-password -especialidades -__v -createdAt -updatedAt",
          populate: { path: "roles", select: "name -_id" }
        },
        {
          path: "medico",
          select: "-password -__v -createdAt -updatedAt",
          populate: { path: "roles especialidades", select: "name -_id" }
        },
        { path: "especialidad_solicitada", select: "name -_id" }
      ]);
    res.status(200).json(reserva);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener la reserva de cita"
    });
  }
};

// Actualizar una reserva de cita
export const updateReservaCita = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const reserva = await ReservaCita.findById(id);

    if (!reserva) {
      return res.status(404).json({
        response: "error",
        message: "Reserva no encontrada"
      });
    }

    const ahora = new Date();
    const fechaReserva = new Date(reserva.fechaReserva);

    // Crear objetos Date para la hora de inicio y fin
    const [horaInicioHoras, horaInicioMinutos] = reserva.horaInicio
      .split(":")
      .map(Number);
    const [horaFinHoras, horaFinMinutos] = reserva.horaFin
      .split(":")
      .map(Number);

    const fechaHoraInicio = new Date(fechaReserva);
    fechaHoraInicio.setUTCHours(horaInicioHoras, horaInicioMinutos, 0, 0);

    const fechaHoraFin = new Date(fechaReserva);
    fechaHoraFin.setUTCHours(horaFinHoras, horaFinMinutos, 0, 0);
    console.log(estado);
    console.log(ahora);
    console.log(fechaHoraInicio);
    console.log(fechaHoraFin);
    // Verificar si se intenta cancelar la reserva dentro de las 24 horas previas
    if (estado === "cancelado") {
      const diferenciaHoras = (fechaHoraInicio - ahora) / 36e5; // Diferencia en horas
      if (diferenciaHoras < 24) {
        return res.status(400).json({
          response: "error",
          message:
            "No se puede cancelar la reserva con menos de 24 horas de antelación"
        });
      }
    }

    // Verificar si se intenta marcar la reserva como atendida en la misma fecha y después de la hora de la reserva
    if (estado === "atendido") {
      if (ahora < fechaHoraInicio) {
        return res.status(400).json({
          response: "error",
          message:
            "La reserva solo puede marcarse como atendida en la misma fecha y después de la hora de la reserva"
        });
      }
    }

    reserva.estado = estado;
    await reserva.save();

    res
      .status(200)
      .json({ reserva, response: "success", message: "Reserva actualizada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al actualizar la reserva de cita"
    });
  }
};

// Eliminar una reserva de cita
export const deleteReservaCita = async (req, res) => {
  const { id } = req.params;
  try {
    const reserva = await ReservaCita.findByIdAndDelete(id)
      .select("-__v -createdAt -updatedAt")
      .populate([
        {
          path: "paciente",
          select: "-password -especialidades -__v -createdAt -updatedAt",
          populate: { path: "roles", select: "name -_id" }
        },
        {
          path: "medico",
          select: "-password -__v -createdAt -updatedAt",
          populate: { path: "roles especialidades", select: "name -_id" }
        },
        { path: "especialidad_solicitada", select: "name -_id" }
      ]);
    res.status(200).json({
      response: "success",
      message: "Reserva de cita eliminada correctamente",
      reserva
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al eliminar la reserva de cita"
    });
  }
};



export const obtenerHorasDisponiblesDelMedicoProximosDias = async (req, res) => {
  const { medicoId, especialidadId } = req.body;

  try {

    if (!mongoose.Types.ObjectId.isValid(medicoId)) {
      return res.status(400).json({ mensaje: "ID de médico no válido" });
    }

    const medico = await User.findById(medicoId);

    if (!medico) {
      return res.status(404).json({ mensaje: "Médico no encontrado" });
    }


    if (!medico.disponibilidad || medico.disponibilidad.length === 0) {
      return res.status(404).json({ mensaje: "El médico no tiene disponibilidades registradas." });
    }

    const disponibilidadPorEspecialidad = medico.disponibilidad.filter(
      (dispo) => dispo.especialidad.toString() === especialidadId
    );

    if (disponibilidadPorEspecialidad.length === 0) {
      return res.status(404).json({ mensaje: "El médico no tiene disponibilidades para esta especialidad." });
    }


    const especialidad = await Especialidades.findById(especialidadId);
    let intervaloMinutos = especialidad && especialidad.name.toLowerCase() === 'medicina general' ? 20 : 30;

    // Obtener la fecha actual y los próximos 30 días
    const fechaActual = new Date();
    const diasProximos = eachDayOfInterval({
      start: fechaActual,
      end: addDays(fechaActual, 30),
    });

    const respuesta = [];

    for (let dia of diasProximos) {
      const diaSemana = format(dia, 'EEEE', { locale: es }).toLowerCase();

      const disponibilidadDia = disponibilidadPorEspecialidad.find(
        (dispo) => dispo.dia.toLowerCase() === diaSemana
      );

      if (disponibilidadDia) {

        const inicioDelDia = new Date(dia);
        inicioDelDia.setHours(0, 0, 0, 0);
        const finDelDia = new Date(dia);
        finDelDia.setHours(23, 59, 59, 999);

        const reservas = await ReservaCita.find({
          medico: medicoId,
          especialidad_solicitada: especialidadId,
        }).select('fechaReserva horaInicio horaFin estado_horario -_id');


        const horasLibres = [];
        let horaActual = formatearHora(disponibilidadDia.inicio);
        const horaFin = formatearHora(disponibilidadDia.fin);

        while (horaActual < horaFin) {
          const siguienteHora = sumarIntervalo(horaActual, intervaloMinutos);

          const horaOcupada = reservas.some((reserva) => {
            const reservaInicio = formatearHora(reserva.horaInicio);
            const reservaFin = formatearHora(reserva.horaFin);
            return (
              horaActual >= reservaInicio &&
              horaActual < reservaFin &&
              reserva.estado_horario === 'OCUPADO'
            );
          });

          console.log(`Hora ${horaActual}: ${horaOcupada ? 'OCUPADO' : 'LIBRE'}`);

          horasLibres.push({
            hora: horaActual,
            estado: horaOcupada ? 'OCUPADO' : 'LIBRE',
          });

          horaActual = siguienteHora;
        }

        respuesta.push({
          fecha: format(dia, 'yyyy-MM-dd'),
          horas: horasLibres,
        });
      }
    }

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error del servidor al obtener las horas disponibles', error: error.message });
  }
};

// Función auxiliar para formatear la hora
function formatearHora(hora) {
  // Si la hora ya está en formato HH:mm, la devolvemos tal cual
  if (/^\d{2}:\d{2}$/.test(hora)) {
    return hora;
  }

  // Si la hora está en formato H:mm, añadimos un 0 al principio
  if (/^\d:\d{2}$/.test(hora)) {
    return `0${hora}`;
  }

  // Si la hora está en otro formato (por ejemplo, 9:5), la formateamos correctamente
  const [horas, minutos] = hora.split(':').map(Number);
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

// Función auxiliar para sumar un intervalo de minutos a una hora en formato string
function sumarIntervalo(hora, minutos) {
  const [horas, mins] = hora.split(':').map(Number);
  const totalMinutos = horas * 60 + mins + minutos;
  const nuevasHoras = Math.floor(totalMinutos / 60);
  const nuevosMinutos = totalMinutos % 60;
  return formatearHora(`${nuevasHoras}:${nuevosMinutos}`);
}