import mongoose from 'mongoose';

const { Schema } = mongoose;

// Definición del esquema de historial médico
const historialMedicoSchema = new Schema({
    paciente: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // Asegura que cada paciente tenga un solo historial médico
    },
    consultas: [{
        type: Schema.Types.ObjectId,
        ref: 'Consulta'
    }]
});

// Creación del modelo de historial médico
export const HistorialMedico = mongoose.model('HistorialMedico', historialMedicoSchema);
