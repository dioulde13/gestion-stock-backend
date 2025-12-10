require("dotenv").config(); // si tu utilises .env
const nodemailer = require("nodemailer");

// ⚡ Configurer le transporteur
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // ton email Gmail
    pass: process.env.MAIL_PASS, // mot de passe d'application
  },
});

// ⚡ Tester l'envoi d'email
const testEmail = async () => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: "baldedioulde992@gmail.com", // change avec ton email
      subject: "Test Nodemailer",
      text: "Si tu reçois ça, Nodemailer fonctionne !",
      html: "<b>Si tu reçois ça, Nodemailer fonctionne !</b>",
    });

    console.log("Email envoyé avec succès ✅");
  } catch (err) {
    console.error("Erreur envoi mail :", err);
  }
};

testEmail();
