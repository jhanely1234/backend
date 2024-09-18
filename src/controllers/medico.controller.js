import { User } from "../models/user.model.js";
import { Role } from "../models/role.model.js";
import { Especialidades } from "../models/especialidad.model.js";
import { generateJwt } from "../helpers/token.helper.js";
import { validateEmail } from "../helpers/validator.helper.js";
import { ReservaCita } from "../models/reserva.model.js"; // Asegúrate de importar el modelo de ReservaCita
import mongoose from "mongoose";

export const registerMedico = async (req, res) => {
  const {
    name,
    email,
    password,
    ci,
    sexo,
    fechaNacimiento,
    telefono,
    lastname,
    disponibilidad,
    especialidades,
    roles,
    turno
  } = req.body;

  // Validación de los datos recibidos
  if (!validateEmail(email)) {
    return res.status(400).json({
      response: "error",
      message: "El formato del email no es válido"
    });
  }

  if (
    !name ||
    !email ||
    !password ||
    !ci ||
    !sexo ||
    !fechaNacimiento ||
    !lastname ||
    !especialidades ||
    !telefono ||
    (especialidades.some((especialidad) => especialidad.toLowerCase().includes("medicina general")) && !turno)
  ) {
    return res.status(400).json({
      response: "error",
      message: "Todos los campos son obligatorios"
    });
  }

  // Validación para asegurar que no se registre una especialidad sin disponibilidad
  if (!disponibilidad || disponibilidad.length === 0) {
    return res.status(400).json({
      response: "error",
      message: "Debe proporcionar disponibilidad para cada especialidad registrada."
    });
  }

  const turnosPermitidos = ["mañana", "tarde", "ambos"];
  if (turno && !turnosPermitidos.includes(turno.toLowerCase())) {
    return res.status(400).json({
      response: "error",
      message: "El turno enviado no es válido. Solo se permiten los turnos: mañana, tarde, ambos."
    });
  }

  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }

  // Nueva validación: Verificar que el médico tenga al menos 18 años
  if (edad < 18) {
    return res.status(400).json({
      response: "error",
      message: "El médico debe tener al menos 18 años."
    });
  }

  let defaultRoles = [];
  if (!roles || roles.length === 0) {
    const defaultRole = await Role.findOne({ name: "medico" });
    if (defaultRole) {
      defaultRoles = [defaultRole._id];
    }
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { ci }] });
    if (existingUser) {
      let field = existingUser.email === email ? "email" : "CI";
      return res.status(400).json({
        response: "error",
        message: `El ${field} ya se encuentra registrado en la base de datos.`
      });
    }

    const roleDocuments = await Role.find({
      _id: { $in: roles || defaultRoles }
    });

    const especialidadDocuments = await Especialidades.find({
      _id: { $in: especialidades }
    });
    if (especialidadDocuments.length !== especialidades.length) {
      return res.status(400).json({
        response: "error",
        message: "Una o más especialidades no existen"
      });
    }

    let dias = [];
    let horarios = [];
    const especialidadMedicinaGeneral = especialidadDocuments.find(
      (especialidad) =>
        especialidad.name.toLowerCase().includes("medicina general")
    );

    if (especialidadMedicinaGeneral) {
      dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

      if (turno.includes("mañana") || turno.includes("ambos")) {
        dias.forEach((dia) => {
          horarios.push({
            dia,
            inicio: "08:00",
            fin: "12:00",
            turno: "mañana",
            especialidad: especialidadMedicinaGeneral._id
          });
        });
      }
      if (turno.includes("tarde") || turno.includes("ambos")) {
        dias.forEach((dia) => {
          horarios.push({
            dia,
            inicio: "12:00",
            fin: "18:00",
            turno: "tarde",
            especialidad: especialidadMedicinaGeneral._id
          });
        });
      }
    }

    if (disponibilidad) {
      for (const dispo of disponibilidad) {
        if (dispo.inicio >= dispo.fin) {
          const especialidadError = especialidadDocuments.find(
            (especialidad) =>
              especialidad._id.toString() === dispo.especialidad.toString()
          );
          return res.status(400).json({
            response: "error",
            message: `La hora de inicio (${dispo.inicio}) no puede ser mayor o igual que la hora de fin (${dispo.fin}) para el día ${dispo.dia} en la especialidad ${especialidadError.name}.`
          });
        }

        if (dispo.inicio >= "08:00" && dispo.fin <= "12:00") {
          dispo.turno = "mañana";
        } else if (dispo.inicio >= "12:00" && dispo.fin <= "18:00") {
          dispo.turno = "tarde";
        } else if (dispo.inicio >= "08:00" && dispo.fin <= "18:00") {
          if (dispo.inicio < "12:00" && dispo.fin <= "12:00") {
            dispo.turno = "mañana";
          } else if (dispo.inicio >= "12:00") {
            dispo.turno = "tarde";
          } else {
            return res.status(400).json({
              response: "error",
              message: `El rango de horas para el día ${dispo.dia} no coincide completamente con los turnos permitidos (08:00-12:00 para mañana, 12:00-18:00 para tarde).`
            });
          }
        } else {
          return res.status(400).json({
            response: "error",
            message: `El rango de horas para el día ${dispo.dia} no coincide con los turnos permitidos (08:00-12:00 para mañana, 12:00-18:00 para tarde).`
          });
        }

        const conflictos = horarios.filter(
          (horario) =>
            horario.dia === dispo.dia &&
            ((horario.inicio < dispo.fin && horario.fin > dispo.inicio) ||
              (dispo.inicio < horario.fin && dispo.fin > horario.inicio))
        );

        if (conflictos.length > 0) {
          const nombresEspecialidadesConflicto = conflictos.map((conflict) => {
            const conflictEspecialidad = especialidadDocuments.find(
              (especialidad) =>
                especialidad._id.toString() === conflict.especialidad.toString()
            );
            return conflictEspecialidad.name;
          });

          return res.status(400).json({
            response: "error",
            message: `Conflicto de disponibilidad el ${dispo.dia} de ${dispo.inicio} a ${dispo.fin}. Debes cambiar los horarios de las siguientes especialidades: ${nombresEspecialidadesConflicto.join(", ")}.`
          });
        }

        horarios.push({
          ...dispo,
          especialidad: dispo.especialidad
        });
      }
    }

    const user = new User({
      name,
      lastname,
      email,
      password,
      roles: roleDocuments.map((role) => role._id),
      ci,
      sexo,
      fechaNacimiento,
      edad,
      telefono,
      disponibilidad: horarios,
      especialidades
    });

    user.password = await User.encryptPassword(password);

    const savedUser = await user.save();

    const userResponse = {
      _id: savedUser._id,
      name,
      lastname,
      roles: roleDocuments.map((role) => role.name),
      edad,
      ci,
      sexo,
      fechaNacimiento,
      email,
      disponibilidad: horarios.map(h => ({
        dia: h.dia,
        inicio: h.inicio,
        fin: h.fin,
        turno: h.turno,
        especialidad: especialidadDocuments.find(especialidad => especialidad._id.toString() === h.especialidad.toString()).name
      })),
      especialidades: especialidadDocuments.map((especialidad) => especialidad.name)
    };

    return res.status(201).json({
      response: "success",
      user: userResponse
    });
  } catch (error) {
    console.log(error);
    let message = "Error del servidor";
    if (error.code === 11000) {
      const duplicateKey = Object.keys(error.keyValue)[0];
      message = `El ${duplicateKey} ya se encuentra registrado en la base de datos.`;
    }
    return res.status(500).json({ response: "error", message });
  }
};

export const getMedicos = async (req, res) => {
  try {
    // Obtener el ObjectId del rol "medico"
    const rolMedico = await Role.findOne({ name: "medico" });

    if (!rolMedico) {
      return res.status(404).json({
        response: "error",
        message: "Rol de médico no encontrado"
      });
    }

    // Obtener todos los médicos que tienen el rol de "medico"
    const medicos = await User.find({ roles: rolMedico._id })
      .select("-password")
      .populate({
        path: "especialidades",
        select: "name _id"
      })
      .populate({
        path: "roles",
        select: "name -_id"
      })
      .exec();

    // Revisar si no se encontraron médicos
    if (!medicos || medicos.length === 0) {
      return res.status(404).json({
        response: "error",
        message: "No se encontraron médicos"
      });
    }

    // Procesar cada médico para organizar la disponibilidad por especialidad
    const medicosConDisponibilidad = medicos.map((medico) => {
      // Organizar la disponibilidad por especialidad
      const disponibilidadPorEspecialidad = medico.especialidades.map(
        (especialidad) => {
          const disponibilidades = medico.disponibilidad.filter(
            (dispo) =>
              dispo.especialidad &&
              dispo.especialidad.toString() === especialidad._id.toString()
          ).map(dispo => ({
            dia: dispo.dia,
            inicio: dispo.inicio,
            fin: dispo.fin,
            turno: dispo.turno
          }));

          return {
            especialidad: especialidad._id,

            disponibilidades: disponibilidades
          };
        }
      );

      // Estructurar la respuesta de cada médico
      return {
        _id: medico._id,
        name: medico.name,
        lastname: medico.lastname,
        email: medico.email,
        ci: medico.ci,
        sexo: medico.sexo,
        fechaNacimiento: medico.fechaNacimiento,
        edad: medico.edad,
        telefono: medico.telefono,
        roles: medico.roles.map((role) => role.name),
        especialidades: medico.especialidades.map((especialidad) => ({
          _id: especialidad._id,
          name: especialidad.name
        })),
        disponibilidadPorEspecialidad // Añadir la disponibilidad por especialidad
      };
    });

    // Enviar la respuesta con todos los médicos y sus disponibilidades organizadas
    res.status(200).json(medicosConDisponibilidad);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener los médicos"
    });
  }
};

export const getMedico = async (req, res) => {
  const { id } = req.params;
  try {
    // Buscar un médico por su ID y populate para obtener los nombres de especialidades y roles
    const medico = await User.findById(id)
      .select("-password")
      .populate({
        path: "especialidades",
        select: "name _id"
      })
      .populate({
        path: "roles",
        select: "name -_id"
      })
      .exec();

    if (!medico) {
      return res.status(404).json({
        response: "error",
        message: "Médico no encontrado"
      });
    }

    // Organizar la disponibilidad por especialidad
    const disponibilidadPorEspecialidad = medico.especialidades.map(
      (especialidad) => {
        const disponibilidades = medico.disponibilidad.filter(
          (dispo) =>
            dispo.especialidad &&
            dispo.especialidad.toString() === especialidad._id.toString()
        ).map(dispo => ({
          dia: dispo.dia,
          inicio: dispo.inicio,
          fin: dispo.fin,
          turno: dispo.turno
        }));

        return {
          especialidad: especialidad.name,
          disponibilidades: disponibilidades
        };
      }
    );

    // Estructurar la respuesta con los datos del médico y la disponibilidad por especialidad
    const medicoConDisponibilidad = {
      _id: medico._id,
      name: medico.name,
      lastname: medico.lastname,
      email: medico.email,
      ci: medico.ci,
      sexo: medico.sexo,
      fechaNacimiento: medico.fechaNacimiento,
      edad: medico.edad,
      telefono: medico.telefono,
      roles: medico.roles.map((role) => role.name),
      especialidades: medico.especialidades.map((especialidad) => ({
        _id: especialidad._id,
        name: especialidad.name
      })),
      disponibilidadPorEspecialidad // Añadir la disponibilidad por especialidad
    };

    res.status(200).json(medicoConDisponibilidad);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener el médico"
    });
  }
};

export const updateMedico = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    lastname,
    email,
    ci,
    sexo,
    fechaNacimiento,
    telefono,
    especialidades,
    disponibilidad,
    turno
  } = req.body;

  try {
    const medico = await User.findById(id);

    if (!medico) {
      return res.status(404).json({
        response: "error",
        message: "Médico no encontrado"
      });
    }

    // Validación de especialidades y turno para MEDICINA GENERAL
    const especialidadDocuments = await Especialidades.find({
      _id: { $in: especialidades }
    });
    if (especialidadDocuments.length !== especialidades.length) {
      return res.status(400).json({
        response: "error",
        message: "Una o más especialidades no existen"
      });
    }

    let dias = [];
    let horarios = [];
    const especialidadMedicinaGeneral = especialidadDocuments.find(
      (especialidad) =>
        especialidad.name.toLowerCase().includes("medicina general")
    );

    if (especialidadMedicinaGeneral) {
      dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

      if (turno.includes("mañana") || turno.includes("ambos")) {
        dias.forEach((dia) => {
          horarios.push({
            dia,
            inicio: "08:00",
            fin: "12:00",
            turno: "mañana",
            especialidad: especialidadMedicinaGeneral._id
          });
        });
      }
      if (turno.includes("tarde") || turno.includes("ambos")) {
        dias.forEach((dia) => {
          horarios.push({
            dia,
            inicio: "12:00",
            fin: "18:00",
            turno: "tarde",
            especialidad: especialidadMedicinaGeneral._id
          });
        });
      }
    }

    // Validar y agregar disponibilidades para especialidades no "MEDICINA GENERAL"
    if (disponibilidad) {
      for (const dispo of disponibilidad) {
        if (dispo.inicio >= dispo.fin) {
          const especialidadError = especialidadDocuments.find(
            (especialidad) =>
              especialidad._id.toString() === dispo.especialidad.toString()
          );
          return res.status(400).json({
            response: "error",
            message: `La hora de inicio (${dispo.inicio}) no puede ser mayor o igual que la hora de fin (${dispo.fin}) para el día ${dispo.dia} en la especialidad ${especialidadError.name}.`
          });
        }

        const conflictos = horarios.filter(
          (horario) =>
            horario.dia === dispo.dia &&
            ((horario.inicio < dispo.fin && horario.fin > dispo.inicio) ||
              (dispo.inicio < horario.fin && dispo.fin > horario.inicio))
        );

        if (conflictos.length > 0) {
          const nombresEspecialidadesConflicto = conflictos.map((conflict) => {
            const conflictEspecialidad = especialidadDocuments.find(
              (especialidad) =>
                especialidad._id.toString() === conflict.especialidad.toString()
            );
            return conflictEspecialidad.name;
          });

          return res.status(400).json({
            response: "error",
            message: `Conflicto de disponibilidad el ${dispo.dia} de ${dispo.inicio} a ${dispo.fin}. Debes cambiar los horarios de las siguientes especialidades: ${nombresEspecialidadesConflicto.join(", ")}.`
          });
        }

        horarios.push({
          ...dispo,
          especialidad: dispo.especialidad
        });
      }
    }

    // Actualizar datos del médico
    medico.name = name || medico.name;
    medico.lastname = lastname || medico.lastname;
    medico.email = email || medico.email;
    medico.ci = ci || medico.ci;
    medico.sexo = sexo || medico.sexo;
    medico.fechaNacimiento = fechaNacimiento || medico.fechaNacimiento;
    medico.telefono = telefono || medico.telefono;
    medico.especialidades = especialidades || medico.especialidades;
    medico.disponibilidad = horarios.length > 0 ? horarios : medico.disponibilidad;

    const updatedMedico = await medico.save();

    res.status(200).json({
      response: "success",
      medico: updatedMedico
    });
  } catch (error) {
    console.error("Error actualizando médico:", error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al actualizar el médico"
    });
  }
};

export const deleteMedico = async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica si el médico tiene reservas asociadas
    const hasReservas = await ReservaCita.exists({ medico: id });

    if (hasReservas) {
      return res.status(400).json({
        response: "error",
        message: "No se puede eliminar el médico porque tiene reservas asociadas."
      });
    }

    // Si no tiene reservas, procede a eliminar el médico
    const deletedMedico = await User.findByIdAndDelete(id);

    if (!deletedMedico) {
      return res.status(404).json({
        response: "error",
        message: "Médico no encontrado"
      });
    }

    res.status(200).json({
      response: "success",
      message: "Médico eliminado correctamente"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al eliminar el médico"
    });
  }
};

export const getMedicosByEspecialidad = async (req, res) => {
  const { especialidadId } = req.params;

  // Verificar si el ID de especialidad es válido
  if (!mongoose.Types.ObjectId.isValid(especialidadId)) {
    return res
      .status(400)
      .json({ response: "error", message: "ID de especialidad inválido" });
  }

  try {
    // Verificar si la especialidad existe
    const especialidad = await Especialidades.findById(especialidadId);
    if (!especialidad) {
      return res
        .status(404)
        .json({ response: "error", message: "Especialidad no encontrada" });
    }

    // Obtener los médicos que tienen la especialidad solicitada
    const medicos = await User.find({ especialidades: especialidadId })
      .select("-password")
      .populate({
        path: "especialidades",
        select: "name _id"
      })
      .populate({
        path: "roles",
        select: "name _id"
      })
      .exec();

    if (medicos.length === 0) {
      return res.status(404).json({
        response: "error",
        message: "No se encontraron médicos para la especialidad especificada"
      });
    }

    // Estructurar la respuesta con los médicos y sus especialidades
    const medicosConEspecialidad = medicos.map((medico) => {
      return {
        _id: medico._id,
        name: medico.name,
        lastname: medico.lastname,
        email: medico.email,
        ci: medico.ci,
        sexo: medico.sexo,
        fechaNacimiento: medico.fechaNacimiento,
        edad: medico.edad,
        telefono: medico.telefono,
        roles: medico.roles.map((role) => role.name),
        especialidades: medico.especialidades.map((especialidad) => ({
          _id: especialidad._id,
          name: especialidad.name
        })),
        disponibilidad: medico.disponibilidad.map((dispo) => ({
          dia: dispo.dia,
          inicio: dispo.inicio,
          fin: dispo.fin,
          turno: dispo.turno,
          especialidad: especialidad.name
        }))
      };
    });

    res.status(200).json(medicosConEspecialidad);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener los médicos por especialidad"
    });
  }
};

export const getEspecialidadesByMedico = async (req, res) => {
  const { medicoId } = req.params;

  // Verificar si el ID de médico es válido
  if (!mongoose.Types.ObjectId.isValid(medicoId)) {
    return res
      .status(400)
      .json({ response: "error", message: "ID de médico inválido" });
  }

  try {
    // Buscar el médico por ID y poblar sus especialidades
    const medico = await User.findById(medicoId).populate({
      path: "especialidades",
      select: "name _id"
    });

    if (!medico) {
      return res
        .status(404)
        .json({ response: "error", message: "Médico no encontrado" });
    }

    // Estructurar la respuesta con las especialidades del médico
    const especialidades = medico.especialidades.map((especialidad) => ({
      _id: especialidad._id,
      name: especialidad.name
    }));

    res.status(200).json(especialidades);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      response: "error",
      message: "Error del servidor al obtener las especialidades del médico"
    });
  }
};