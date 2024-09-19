import mongoose from "mongoose";

const { Schema } = mongoose;

const consultaSchema = new Schema({
  citaMedica: {
    type: Schema.Types.ObjectId,
    ref: "ReservaCita",
    required: true,
  },
  motivo_consulta: {
    type: String,
    required: true,
  },
  signos_vitales: [
    {
      Fc: {
        type: String,
        required: true,
      },
      Fr: {
        type: String,
        required: true,
      },
      Temperatura: {
        type: String,
        required: true,
      },
      peso: {
        type: String,
        required: true,
      },
      talla: {
        type: String,
        required: true,
      },
    },
  ],
  examen_fisico: {
    type: String,
  },
  diagnostico: {
    type: String,
    required: true,
  },
  conducta: {
    type: String,
    required: true,
  },
  fechaHora: {
    type: Date,
    default: Date.now,
    required: true,
  },
  receta: {
    type: String,
  },
});

export const Consulta = mongoose.model("Consulta", consultaSchema);
