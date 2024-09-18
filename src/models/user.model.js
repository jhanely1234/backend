import mongoose from "mongoose";
import bcrypt from "bcrypt";

const DisponibilidadSchema = new mongoose.Schema({
  dia: {
    type: String,
    enum: [
      "Lunes",
      "Martes",
      "Miercoles",
      "Jueves",
      "Viernes",
      "Sabado",
      "Domingo"
    ],
    required: true
  },
  inicio: {
    type: String,
    required: true
  },
  fin: {
    type: String,
    required: true
  },
  turno: {  // Campo para especificar el turno
    type: String,
    enum: ["mañana", "tarde", "ambos"],
    required: true
  },
  especialidad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Especialidades",
    required: true
  }
});


const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: [3, "El nombre debe contener al menos 3 caracteres"]
    },
    lastname: {
      type: String,
      required: true,
      minlength: [3, "El apellido debe contener al menos 3 caracteres"]
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
        required: true
      }
    ],
    verificationCode: String,
    verificationCodeExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    ci: {
      type: Number,
      unique: true,
      sparse: true
    },
    genero: {
      type: String,
      enum: ["Masculino", "Femenino", "Otro"]
    },
    fechaNacimiento: {
      type: Date
    },
    edad: {
      type: Number
    },
    telefono: {
      type: Number
    },
    telefono_tutor: {
      type: Number
    },
    nombre_tutor: {
      type: String
    },
    sexo: {
      type: String,
      enum: ["Masculino", "Femenino"]
    },

    // Medico
    especialidades: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Especialidades"
      }
    ],
    disponibilidad: [DisponibilidadSchema]
  },
  {
    timestamps: true
  }
);


userSchema.statics.encryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

userSchema.statics.comparePassword = async (password, receivedPassword) => {
  return await bcrypt.compare(password, receivedPassword);
};

userSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) {
    return next();
  }
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  next();
});

export const User = mongoose.model("User", userSchema);
