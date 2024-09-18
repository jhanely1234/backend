import { ReservaCita } from "../models/reserva.model.js";
import { User } from "../models/user.model.js";
import { Especialidades } from "../models/especialidad.model.js";
import { Role } from '../models/role.model.js';
import { Consulta } from '../models/consulta.model.js';
// Helper function to calculate growth percentage
const calculateGrowth = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const getDashboardSummary = async (req, res) => {
  try {
    // Total de citas
    const totalAppointments = await ReservaCita.countDocuments();

    // Nuevos pacientes (registrados como "pacientes" en el sistema)
    const pacienteRole = await Role.findOne({ name: "paciente" });
    if (!pacienteRole) {
      return res.status(404).json({ error: "Rol 'paciente' no encontrado" });
    }

    const newPatients = await User.countDocuments({ roles: { $in: [pacienteRole._id] } });

    // Fecha de un mes atrás
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Citas atendidas y por atender
    const attendedAppointments = await ReservaCita.countDocuments({ estado: 'atendido' });
    const upcomingAppointments = await ReservaCita.countDocuments({ estado: 'pendiente' });

    // Citas atendidas y por atender hace un mes
    const previousAttendedAppointments = await ReservaCita.countDocuments({
      estado: 'atendido',
      createdAt: { $lt: oneMonthAgo }
    });
    const previousUpcomingAppointments = await ReservaCita.countDocuments({
      estado: 'pendiente',
      createdAt: { $lt: oneMonthAgo }
    });

    // Crecimiento de citas atendidas y por atender
    const attendedAppointmentsGrowth = calculateGrowth(attendedAppointments, previousAttendedAppointments);
    const upcomingAppointmentsGrowth = calculateGrowth(upcomingAppointments, previousUpcomingAppointments);

    // Crecimiento de citas y nuevos pacientes comparado con el mes anterior
    const previousTotalAppointments = await ReservaCita.countDocuments({
      createdAt: { $lt: oneMonthAgo }
    });
    const appointmentsGrowth = calculateGrowth(totalAppointments, previousTotalAppointments);

    const previousNewPatients = await User.countDocuments({
      roles: { $in: [pacienteRole._id] },
      createdAt: { $lt: oneMonthAgo }
    });
    const newPatientsGrowth = calculateGrowth(newPatients, previousNewPatients);

    // Respuesta JSON con todas las métricas
    res.json({
      totalAppointments,
      appointmentsGrowth,
      newPatients,
      newPatientsGrowth,
      attendedAppointments,
      attendedAppointmentsGrowth,
      upcomingAppointments,
      upcomingAppointmentsGrowth
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el resumen del dashboard' });
  }
};

export const getAppointmentsStats = async (req, res) => {
  const { period } = req.query; // "day", "month", "year"

  try {
    // Validar que se haya proporcionado un período válido
    if (!['day', 'month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'El parámetro de período es inválido' });
    }

    const matchStage = { $match: {} };
    let groupStage;
    let sortStage;

    // Configurar el operador de agrupamiento y ordenación según el período
    if (period === 'day') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fechaReserva" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "día"
    } else if (period === 'month') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fechaReserva" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "mes"
    } else if (period === 'year') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$fechaReserva" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "año"
    }

    // Ejecutar la consulta de agregación con ordenación
    const data = await ReservaCita.aggregate([matchStage, groupStage, sortStage]);

    res.json({ data: data.map(d => ({ name: d._id, total: d.total })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas de citas' });
  }
};

export const getAppointmentsStatusStats = async (req, res) => {
  const { period } = req.query; // "day", "month", "year"

  try {
    // Validar que se haya proporcionado un período válido
    if (!['day', 'month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'El parámetro de período es inválido' });
    }

    let groupStage;
    let sortStage;

    // Configurar el operador de agrupamiento y ordenación según el período
    if (period === 'day') {
      groupStage = {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$fechaReserva" } },
            estado: "$estado"
          },
          total: { $sum: 1 }
        }
      };
      sortStage = { $sort: { "_id.date": 1 } }; // Ordenar por fecha en formato "día"
    } else if (period === 'month') {
      groupStage = {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m", date: "$fechaReserva" } },
            estado: "$estado"
          },
          total: { $sum: 1 }
        }
      };
      sortStage = { $sort: { "_id.date": 1 } }; // Ordenar por fecha en formato "mes"
    } else if (period === 'year') {
      groupStage = {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y", date: "$fechaReserva" } },
            estado: "$estado"
          },
          total: { $sum: 1 }
        }
      };
      sortStage = { $sort: { "_id.date": 1 } }; // Ordenar por fecha en formato "año"
    }

    // Ejecutar la consulta de agregación con ordenación
    const data = await ReservaCita.aggregate([
      groupStage,
      sortStage
    ]);

    // Reformatear los datos para la respuesta JSON
    const formattedData = data.reduce((acc, curr) => {
      const { date, estado } = curr._id;
      if (!acc[date]) {
        acc[date] = { date };
      }
      acc[date][estado] = curr.total;
      return acc;
    }, {});

    res.json({ data: Object.values(formattedData) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas de estados de citas' });
  }
};

export const getPatientsStats = async (req, res) => {
  const { period } = req.query; // "day", "month", "year"

  try {
    // Validar que se haya proporcionado un período válido
    if (!['day', 'month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'El parámetro de período es inválido' });
    }

    // Obtener el ObjectId del rol "paciente"
    const pacienteRole = await Role.findOne({ name: "paciente" });

    if (!pacienteRole) {
      return res.status(404).json({ error: "Rol 'paciente' no encontrado" });
    }

    const matchStage = { $match: { roles: { $in: [pacienteRole._id] } } };
    let groupStage;
    let sortStage;

    // Configurar el operador de agrupamiento y ordenación según el período
    if (period === 'day') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "día"
    } else if (period === 'month') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "mes"
    } else if (period === 'year') {
      groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$createdAt" } }, total: { $sum: 1 } } };
      sortStage = { $sort: { "_id": 1 } }; // Ordenar por fecha en formato "año"
    }

    // Ejecutar la consulta de agregación con ordenación
    const data = await User.aggregate([matchStage, groupStage, sortStage]);

    res.json({ data: data.map(d => ({ name: d._id, total: d.total })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas de pacientes' });
  }
};

export const getSpecialtiesDistribution = async (req, res) => {
  try {
    const data = await ReservaCita.aggregate([
      { $group: { _id: "$especialidad_solicitada", value: { $sum: 1 } } },
      { $lookup: { from: "especialidades", localField: "_id", foreignField: "_id", as: "especialidad" } },
      { $unwind: "$especialidad" },
      { $project: { _id: 0, name: "$especialidad.name", value: 1 } }
    ]);

    res.json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener distribución de especialidades' });
  }
};

export const getUpcomingAppointments = async (req, res) => {
  try {
    // Obtener la fecha y hora actuales
    const today = new Date();

    // Buscar todas las citas cuya fecha de reserva es mayor o igual a la fecha actual
    const appointments = await ReservaCita.find({ fechaReserva: { $gte: today } })
      .populate('paciente', 'name lastname') // Poblamos los datos del paciente
      .populate('especialidad_solicitada', 'name') // Poblamos los datos de la especialidad solicitada
      .select('fechaReserva horaInicio especialidad_solicitada paciente') // Seleccionamos los campos necesarios
      .sort('fechaReserva') // Ordenamos por fecha de reserva ascendente
      .exec();

    // Revisar si se encontraron citas
    if (!appointments.length) {
      return res.status(404).json({ message: 'No hay citas próximas disponibles' });
    }

    // Formatear la respuesta
    res.json({
      appointments: appointments.map(appt => ({
        name: `${appt.paciente.name} ${appt.paciente.lastname}`,
        date: appt.fechaReserva.toISOString().split('T')[0], // Convertimos la fecha a string
        time: appt.horaInicio,
        specialty: appt.especialidad_solicitada.name
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener próximas citas' });
  }
};

export const getReingresoRate = async (req, res) => {
  const { period } = req.query; // Obtener el parámetro de período de la consulta (day, month, year)

  try {
    // Validar que se haya proporcionado un período válido
    if (!['day', 'month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'El parámetro de período es inválido' });
    }

    // Calcular la fecha de inicio según el período seleccionado
    let startDate;
    const today = new Date();

    if (period === 'day') {
      startDate = new Date(today.setDate(today.getDate() - 1)); // Último día
    } else if (period === 'month') {
      startDate = new Date(today.setMonth(today.getMonth() - 1)); // Último mes
    } else if (period === 'year') {
      startDate = new Date(today.setFullYear(today.getFullYear() - 1)); // Último año
    }

    // Calcular la tasa de reingreso de pacientes: pacientes que tuvieron más de una consulta en el período especificado
    const reingresos = await ReservaCita.aggregate([
      {
        $match: { fechaReserva: { $gte: startDate } } // Filtrar citas según la fecha de inicio calculada
      },
      {
        $group: {
          _id: "$paciente",
          numConsultas: { $sum: 1 },
          lastVisit: { $max: "$fechaReserva" },
        },
      },
      {
        $match: {
          numConsultas: { $gt: 1 }, // Pacientes con más de una consulta
          lastVisit: { $gte: startDate }, // Asegurar que la última visita esté dentro del período
        },
      },
      { $sort: { "lastVisit": 1 } } // Ordenar por la última visita ascendente
    ]);

    const totalPatients = await User.countDocuments(); // Total de pacientes en el sistema
    const reingresoRate = (reingresos.length / totalPatients) * 100;

    // Devolver la tasa de reingreso como respuesta JSON
    res.json({
      reingresoRate,
      reingresos: reingresos.length,
      totalPatients
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la tasa de reingreso de pacientes' });
  }
};


export const getConsultationReport = async (req, res) => {
  try {
    const { startDate, endDate, estado } = req.query;

    // Validar que las fechas sean válidas y estén en el formato adecuado
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' });
    }

    // Convertir las fechas a objetos Date y ajustar horas
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    // Validar que endDate no sea menor que startDate
    if (start > end) {
      return res.status(400).json({ error: 'El endDate no puede ser menor que el startDate. Por favor, seleccione un rango de fechas válido.' });
    }

    // Construir filtro de consulta basado en los parámetros
    const consultaFilter = { fechaHora: { $gte: start, $lte: end } };

    if (estado) {
      consultaFilter['citaMedica.estado'] = estado;
    }

    const consultas = await Consulta.find(consultaFilter)
      .populate({
        path: 'citaMedica',
        populate: { path: 'paciente medico especialidad_solicitada', select: 'name lastname ci fechaNacimiento telefono sexo especialidades' }
      })
      .exec();

    const totalConsultas = consultas.length;

    if (totalConsultas === 0) {
      return res.status(400).json({ error: 'No hay datos para los filtros especificados.' });
    }

    const consultasAtendidas = consultas.filter(consulta => consulta.citaMedica.estado === 'atendido').length;
    const consultasPendientes = consultas.filter(consulta => consulta.citaMedica.estado === 'pendiente').length;
    const consultasCanceladas = consultas.filter(consulta => consulta.citaMedica.estado === 'cancelado').length;

    const reportData = consultas.map((consulta) => {
      const citaMedica = consulta.citaMedica || {};
      const paciente = citaMedica.paciente || {};
      const medico = citaMedica.medico || {};
      const especialidad = citaMedica.especialidad_solicitada || {};

      const especialidadMedico = medico.especialidades?.find((esp) => esp._id.toString() === especialidad._id.toString());

      return {
        paciente: {
          nombreCompleto: `${paciente.name || ''} ${paciente.lastname || ''}`,
          ci: paciente.ci || '',
          fechaNacimiento: paciente.fechaNacimiento || '',
          edad: paciente.fechaNacimiento ? new Date().getFullYear() - new Date(paciente.fechaNacimiento).getFullYear() : '',
          telefono: paciente.telefono || '',
          sexo: paciente.sexo || ''
        },
        consulta: {
          fechaConsulta: consulta.fechaHora,
          horaInicio: citaMedica.horaInicio,
          horaFin: citaMedica.horaFin,
          estado: citaMedica.estado,
          motivoConsulta: consulta.motivo_consulta,
          signosVitales: consulta.signos_vitales,
          examenFisico: consulta.examen_fisico,
          diagnostico: consulta.diagnostico,
          conducta: consulta.conducta,
          receta: consulta.receta
        },
        medico: {
          nombreCompleto: `${medico.name || ''} ${medico.lastname || ''}`,
          especialidad: especialidadMedico ? especialidadMedico.name : '',
          turno: medico.turno || ''
        }
      };
    });

    res.json({
      data: reportData,
      totals: {
        totalConsultas,
        consultasAtendidas,
        consultasPendientes,
        consultasCanceladas
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte de consultas' });
  }
};

export const getReservationReport = async (req, res) => {
  try {
    const { startDate, endDate, estado } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' });
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    if (start > end) {
      return res.status(400).json({ error: 'El endDate no puede ser menor que el startDate. Por favor, seleccione un rango de fechas válido.' });
    }

    const reservaFilter = { fechaReserva: { $gte: start, $lte: end } };

    if (estado) {
      reservaFilter['estado'] = estado;
    }

    const reservas = await ReservaCita.find(reservaFilter)
      .populate('paciente', 'name lastname ci fechaNacimiento telefono sexo')
      .populate('medico', 'name lastname especialidades')
      .populate('especialidad_solicitada', 'name')
      .exec();

    const totalReservas = reservas.length;

    if (totalReservas === 0) {
      return res.status(400).json({ error: 'No hay datos para los filtros especificados.' });
    }

    const reservasAtendidas = reservas.filter(reserva => reserva.estado === 'atendido').length;
    const reservasPendientes = reservas.filter(reserva => reserva.estado === 'pendiente').length;
    const reservasCanceladas = reservas.filter(reserva => reserva.estado === 'cancelado').length;

    const reportData = reservas.map((reserva) => {
      const paciente = reserva.paciente || {};
      const medico = reserva.medico || {};
      const especialidad = reserva.especialidad_solicitada || {};

      return {
        paciente: {
          nombreCompleto: `${paciente.name || ''} ${paciente.lastname || ''}`,
          ci: paciente.ci || '',
          fechaNacimiento: paciente.fechaNacimiento || '',
          edad: paciente.fechaNacimiento ? new Date().getFullYear() - new Date(paciente.fechaNacimiento).getFullYear() : '',
          telefono: paciente.telefono || '',
          sexo: paciente.sexo || ''
        },
        reserva: {
          fechaReserva: reserva.fechaReserva,
          horaInicio: reserva.horaInicio,
          horaFin: reserva.horaFin,
          estado: reserva.estado
        },
        medico: {
          nombreCompleto: `${medico.name || ''} ${medico.lastname || ''}`,
          especialidad: especialidad.name || ''
        }
      };
    });

    res.json({
      data: reportData,
      totals: {
        totalReservas,
        reservasAtendidas,
        reservasPendientes,
        reservasCanceladas
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte de reservas' });
  }
};

export const getPatientReport = async (req, res) => {
  try {
    const { patientId, startDate, endDate, estado } = req.query;

    if (!patientId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren patientId, startDate y endDate' });
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    if (start > end) {
      return res.status(400).json({ error: 'El endDate no puede ser menor que el startDate. Por favor, seleccione un rango de fechas válido.' });
    }

    const paciente = await User.findById(patientId).select('name lastname ci fechaNacimiento telefono sexo').exec();
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const reservaFilter = {
      paciente: patientId,
      fechaReserva: { $gte: start, $lte: end }
    };

    if (estado) {
      reservaFilter['estado'] = estado;
    }

    const reservas = await ReservaCita.find(reservaFilter)
      .populate('especialidad_solicitada', 'name')
      .populate('medico', 'name lastname')
      .exec();

    const consultas = await Consulta.find({
      citaMedica: { $in: reservas.map(reserva => reserva._id) }
    })
      .populate({
        path: 'citaMedica',
        populate: { path: 'medico', select: 'name lastname' }
      })
      .exec();

    const totalReservas = reservas.length;
    const totalConsultas = consultas.length;

    if (totalReservas === 0 && totalConsultas === 0) {
      return res.status(400).json({ error: 'No hay datos para los filtros especificados.' });
    }

    const reservasAtendidas = reservas.filter(reserva => reserva.estado === 'atendido').length;
    const reservasPendientes = reservas.filter(reserva => reserva.estado === 'pendiente').length;
    const reservasCanceladas = reservas.filter(reserva => reserva.estado === 'cancelado').length;

    const reportData = {
      paciente: {
        nombreCompleto: `${paciente.name} ${paciente.lastname}`,
        ci: paciente.ci || '',
        fechaNacimiento: paciente.fechaNacimiento || '',
        edad: paciente.fechaNacimiento ? new Date().getFullYear() - new Date(paciente.fechaNacimiento).getFullYear() : '',
        telefono: paciente.telefono || '',
        sexo: paciente.sexo || ''
      },
      reservas: reservas.map(reserva => ({
        fechaReserva: reserva.fechaReserva,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        especialidad: reserva.especialidad_solicitada.name,
        estado: reserva.estado,
        medico: `${reserva.medico.name} ${reserva.medico.lastname}`
      })),
      consultas: consultas.map(consulta => ({
        fechaConsulta: consulta.fechaHora,
        motivoConsulta: consulta.motivo_consulta,
        diagnostico: consulta.diagnostico,
        tratamiento: consulta.conducta,
        signosVitales: consulta.signos_vitales,
        examenFisico: consulta.examen_fisico,
        receta: consulta.receta,
        medico: `${consulta.citaMedica.medico.name} ${consulta.citaMedica.medico.lastname}`
      })),
      totals: {
        totalReservas,
        reservasAtendidas,
        reservasPendientes,
        reservasCanceladas,
        totalConsultas
      }
    };

    res.json({ data: reportData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte del paciente' });
  }
};

export const getDoctorReport = async (req, res) => {
  try {
    const { doctorId, startDate, endDate, estado } = req.query;

    if (!doctorId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren doctorId, startDate y endDate' });
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    if (start > end) {
      return res.status(400).json({ error: 'El endDate no puede ser menor que el startDate. Por favor, seleccione un rango de fechas válido.' });
    }

    const medico = await User.findById(doctorId)
      .select('name lastname especialidades turno')
      .populate('especialidades', 'name')
      .exec();
    if (!medico) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    const reservaFilter = {
      medico: doctorId,
      fechaReserva: { $gte: start, $lte: end }
    };

    if (estado) {
      reservaFilter['estado'] = estado;
    }

    const reservas = await ReservaCita.find(reservaFilter)
      .populate('paciente', 'name lastname')
      .populate('especialidad_solicitada', 'name')
      .exec();

    const consultas = await Consulta.find({
      citaMedica: { $in: reservas.map(reserva => reserva._id) }
    })
      .populate({
        path: 'citaMedica',
        populate: { path: 'paciente', select: 'name lastname' }
      })
      .exec();

    const totalReservas = reservas.length;
    const totalConsultas = consultas.length;

    if (totalReservas === 0 && totalConsultas === 0) {
      return res.status(400).json({ error: 'No hay datos para los filtros especificados.' });
    }

    const reservasAtendidas = reservas.filter(reserva => reserva.estado === 'atendido').length;
    const reservasPendientes = reservas.filter(reserva => reserva.estado === 'pendiente').length;
    const reservasCanceladas = reservas.filter(reserva => reserva.estado === 'cancelado').length;

    const reportData = {
      medico: {
        nombreCompleto: `${medico.name} ${medico.lastname}`,
        especialidades: medico.especialidades.map(esp => esp.name).join(', '),
        turno: medico.turno || 'No especificado'
      },
      reservas: reservas.map(reserva => ({
        fechaReserva: reserva.fechaReserva,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        especialidad: reserva.especialidad_solicitada.name,
        estado: reserva.estado,
        paciente: `${reserva.paciente.name} ${reserva.paciente.lastname}`
      })),
      consultas: consultas.map(consulta => ({
        fechaConsulta: consulta.fechaHora,
        motivoConsulta: consulta.motivo_consulta,
        diagnostico: consulta.diagnostico,
        tratamiento: consulta.conducta,
        signosVitales: consulta.signos_vitales,
        examenFisico: consulta.examen_fisico,
        receta: consulta.receta,
        paciente: `${consulta.citaMedica.paciente.name} ${consulta.citaMedica.paciente.lastname}`
      })),
      totals: {
        totalReservas,
        reservasAtendidas,
        reservasPendientes,
        reservasCanceladas,
        totalConsultas
      }
    };

    res.json({ data: reportData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte del médico' });
  }
};
