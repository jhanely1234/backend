import { Especialidades } from "../models/especialidad.model.js";

export const createEspecialidad = async (req, res) => {
    const { name } = req.body;
    try {
        const especialidad = new Especialidades({ name });
        await especialidad.save();
        res.status(201).json(especialidad);
    } catch (error) {
        console.log(error);
        res.status(500).json({ response: 'error', message: 'Error del servidor al crear la especialidad' });
    }
}

export const getEspecialidades = async (req, res) => {
    try {
        const especialidades = await Especialidades.find();
        res.status(200).json(especialidades);
    } catch (error) {
        console.log(error);
        res.status(500).json({ response: 'error', message: 'Error del servidor al obtener las especialidades' });
    }
}

export const getEspecialidad = async (req, res) => {
    const { id } = req.params;
    try {
        const especialidad = await Especialidades.findById(id);
        res.status(200).json(especialidad);
    } catch (error) {
        console.log(error);
        res.status(500).json({ response: 'error', message: 'Error del servidor al obtener la especialidad' });
    }
}

export const updateEspecialidad = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const especialidad = await Especialidades.findByIdAndUpdate(id, { name }, { new: true });
        res.status(200).json(especialidad);
    } catch (error) {
        console.log(error);
        res.status(500).json({ response: 'error', message: 'Error del servidor al actualizar la especialidad' });
    }
}

export const deleteEspecialidad = async (req, res) => {
    const { id } = req.params;
    try {
        const especialidad = await Especialidades.findByIdAndDelete(id);
        res.status(200).json(especialidad);
    } catch (error) {
        console.log(error);
        res.status(500).json({ response: 'error', message: 'Error del servidor al eliminar la especialidad' });
    }
}