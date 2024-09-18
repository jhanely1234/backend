import { Consulta } from "../models/consulta.model.js";
import { ReservaCita } from "../models/reserva.model.js";
import mongoose from "mongoose";

// Crear una nueva consulta médica
export const createConsulta = async (req, res) => {
  const {
    citaMedicaId,
    motivo_consulta,
    signos_vitales,
    examen_fisico,
    diagnostico,
    conducta,
    receta
  } = req.body;

  try {
    // Verificar si la cita médica existe
    const citaMedica = await ReservaCita.findById(citaMedicaId).populate(
      "paciente medico especialidad_solicitada"
    );

    if (!citaMedica) {
      return res.status(404).json({ message: "Cita médica no encontrada." });
    }

    // Crear la consulta médica
    const consulta = new Consulta({
      citaMedica,
      motivo_consulta,
      signos_vitales,
      examen_fisico,
      diagnostico,
      conducta,
      receta
    });

    await consulta.save();

    res.status(201).json(consulta);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al crear la consulta médica."
      });
  }
};

// Obtener una consulta médica por ID
export const getConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const consulta = await Consulta.findById(id).populate({
      path: "citaMedica",
      populate: [
        { path: "paciente", select: "-password -rol" },
        {
          path: "medico",
          select: "-password -rol",
          populate: { path: "especialidades", select: "name" }
        },
        { path: "especialidad_solicitada", select: "name" }
      ]
    });

    if (!consulta) {
      return res
        .status(404)
        .json({ message: "Consulta médica no encontrada." });
    }

    res.status(200).json(consulta);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al obtener la consulta médica."
      });
  }
};

// Obtener todas las consultas médicas
export const getConsultas = async (req, res) => {
  try {
    const consultas = await Consulta.find().populate({
      path: "citaMedica",
      populate: [
        { path: "paciente", select: "-password -rol" },
        {
          path: "medico",
          select: "-password -rol",
          populate: { path: "especialidades", select: "name" }
        },
        { path: "especialidad_solicitada", select: "name" }
      ]
    });
    res.status(200).json(consultas);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al obtener las consultas médicas."
      });
  }
};

// Actualizar una consulta médica
export const updateConsulta = async (req, res) => {
  const { id } = req.params;
  const {
    motivo_consulta,
    signos_vitales,
    examen_fisico,
    diagnostico,
    conducta,
    receta
  } = req.body;
  try {
    const consulta = await Consulta.findByIdAndUpdate(
      id,
      {
        motivo_consulta,
        signos_vitales,
        examen_fisico,
        diagnostico,
        conducta,
        receta
      },
      { new: true }
    );

    if (!consulta) {
      return res
        .status(404)
        .json({ message: "Consulta médica no encontrada." });
    }

    res.status(200).json(consulta);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al actualizar la consulta médica."
      });
  }
};

// Eliminar una consulta médica
export const deleteConsulta = async (req, res) => {
  const { id } = req.params;
  try {
    const consulta = await Consulta.findByIdAndDelete(id);
    if (!consulta) {
      return res
        .status(404)
        .json({ message: "Consulta médica no encontrada." });
    }

    res
      .status(200)
      .json({
        response: "success",
        message: "Consulta médica eliminada correctamente",
        consulta
      });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al eliminar la consulta médica."
      });
  }
};
