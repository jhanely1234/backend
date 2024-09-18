import mongoose from 'mongoose';

const reservaCitaSchema = new mongoose.Schema(
  {
    paciente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    medico: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      validate: {
        validator: function (value) {
          return mongoose.model('User').findById(value).then(user => user && user.especialidades.length > 0);
        },
        message: 'El médico debe tener al menos una especialidad',
      }
    },
    especialidad_solicitada: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Especialidades',
      required: true,
    },
    fechaReserva: {
      type: Date,
      required: true,
    },
    horaInicio: {
      type: String,
      required: true,
    },
    horaFin: {
      type: String,
      required: true,
    },
    fechaActual: {
      type: Date,
      default: Date.now,
    },
    estado: {
      type: String,
      enum: ["atendido", "pendiente", "cancelado"],
      default: "pendiente",
    },
    estado_horario: { type: String, enum: ['LIBRE', 'OCUPADO'], default: 'LIBRE' }, // Nuevo campo
  },
  {
    timestamps: true,
  }
);

export const ReservaCita = mongoose.model('ReservaCita', reservaCitaSchema);
