import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Role } from "../models/role.model.js";
import { generateJwt } from "../helpers/token.helper.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail
} from "../services/email.service.js";
import crypto from "crypto";

export const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).populate(
      "roles"
    );

    if (!user)
      return res.status(400).json({ message: "Usuario no encontrado" });

    const matchPassword = await User.comparePassword(
      req.body.password,
      user.password
    );

    if (!matchPassword)
      return res.status(401).json({
        token: null,
        message: "Contraseña inválida"
      });

    const verificationCode = crypto.randomBytes(3).toString("hex"); // Genera un código de 6 caracteres
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 3600000; // El código expira en 1 hora
    await user.save();

    await sendVerificationEmail(user.email, verificationCode);

    console.log(`Codigo para el correo ${user.email} es : ${verificationCode}`);

    return res
      .status(200)
      .json({
        response: "success",
        message: "Código de verificación enviado al correo electrónico"
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al enviar el código de verificación"
      });
  }
};

export const verifyCodeHandler = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).populate(
      "roles",
      "name"
    );

    if (
      !user ||
      user.verificationCode !== code ||
      user.verificationCodeExpires < Date.now()
    ) {
      return res
        .status(400)
        .json({
          response: "error",
          message: "Código de verificación inválido o expirado"
        });
    }

    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    const access_token = generateJwt(user._id);
    const roleNames = user.roles.map((role) => role.name);

    return res.status(200).json({
      response: "success",
      user: {
        access_token,
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        _id: user._id,
        roles: user.roles
      }
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al verificar el código"
      });
  }
};

export const forgotPasswordHandler = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ response: "error", message: "Usuario no encontrado" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // El token expira en 1 hora
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);
    console.log(`Token para el correo ${user.email} es : ${resetToken}`);
    return res
      .status(200)
      .json({
        response: "success",
        message: "Correo de restablecimiento de contraseña enviado"
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        response: "error",
        message:
          "Error del servidor al enviar el correo de restablecimiento de contraseña"
      });
  }
};

export const resetPasswordHandler = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({
        response: "error",
        message: "Token y nueva contraseña son obligatorios"
      });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res
        .status(400)
        .json({ response: "error", message: "Token inválido o expirado" });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res
      .status(200)
      .json({
        response: "success",
        message: "Contraseña restablecida exitosamente"
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        response: "error",
        message: "Error del servidor al restablecer la contraseña"
      });
  }
};
