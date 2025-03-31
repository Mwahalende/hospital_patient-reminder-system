const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// MongoDB Connection
mongoose
  .connect("mongodb+srv://user1:malafiki@leodb.5mf7q.mongodb.net/?retryWrites=true&w=majority&appName=leodb",)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Connection error:", err));

//patient schema
const patientSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    phone: String,
    patientId: { type: String, required: true, unique: true },
    age: Number,
    gender: String,
    doctorRoom: String,
    homeAddress: String,
    doctorId: String,
    disease: String,
    dose: String,
    treatmentEnd: Date,
    stay: String,
    wardNumber: String,
    createdAt: { type: Date, default: Date.now },
    smsSent: { type: Boolean, default: false }, // Add smsSent field
  });
  

const Patient = mongoose.model("Patient", patientSchema);

// Email Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "leotitogalaxy@gmail.com",
    pass: "anxd ruea situ btug", // Replace with your email password
  },
  connectionTimeout: 10000, // Increase timeout (10 seconds)
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Patient Registration
app.post("/register", async (req, res) => {
  try {
    const newPatient = new Patient(req.body);
    await newPatient.save();
    res.status(201).json({ message: "Patient registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Doctor Treatment Submission
app.post("/treatment", async (req, res) => {
  try {
      const { patientId, doctorId, disease, dose, treatmentEnd, stay, wardNumber } = req.body;

      const patient = await Patient.findOneAndUpdate(
          { patientId },
          { doctorId, disease, dose, treatmentEnd, stay, wardNumber },
          { new: true }
      );

      if (!patient) return res.status(404).json({ error: "Patient not found!" });

      // Send Email Notification
      transporter.sendMail({
          from: "leotitogalaxy@gmail.com",
          to: patient.email,
          subject: "MWAHALENDE INTERNATIONAL HOSPITAL - MEDICATION",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
              <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #0275d8; text-align: center;">MWAHALENDE INTERNATIONAL HOSPITAL</h2>
                <p style="font-size: 16px; color: #333;">Dear <strong>${patient.fullName}</strong>,</p>
                <p style="font-size: 16px; color: #333;">Your prescribed dose is: <strong>${dose}</strong>.</p>
                <p style="font-size: 16px; color: #333;">Take your medicine on time for a quick recovery.</p>
                <hr>
                <p style="font-size: 14px; text-align: center; color: gray;">This is an automated message. Please do not reply.</p>
              </div>
            </div>
          `,
      }, async (err, info) => {
          if (err) return res.status(500).json({ error: "Error sending email." });

          // Mark SMS as sent
          await Patient.findByIdAndUpdate(patient._id, { smsSent: true });
          res.json({ message: "Treatment updated & email sent!" });
      });

  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

  
// Get Patient History
app.get("/history", async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Patients Who Need a Dose (Only Hospitalized)
app.get("/nurse-dashboard", async (req, res) => {
  try {
    const patients = await Patient.find({ stay: "hospital" }, "fullName wardNumber dose dosed smsSent");
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Patient as Dosed (Save Status in DB)
app.post("/mark-dosed/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Patient.findByIdAndUpdate(id, { dosed: true });
    res.json({ message: "Patient marked as dosed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Medication Reminder Scheduler
cron.schedule("0 8,20 * * *", async () => {
  try {
      const now = new Date();
      const patients = await Patient.find({
          treatmentEnd: { $gte: now },
      });

      patients.forEach((patient) => {
          if (!patient.dose) return;

          let doseParts = patient.dose.split("x");
          if (doseParts.length < 2) return;

          let dosesPer12Hours = parseInt(doseParts[1]);
          if (isNaN(dosesPer12Hours) || dosesPer12Hours <= 0) return;

          let intervalMinutes = (12 * 60) / dosesPer12Hours;

          for (let i = 0; i < dosesPer12Hours; i++) {
              setTimeout(async () => {
                  transporter.sendMail({
                      from: "leotitogalaxy@gmail.com",
                      to: patient.email,
                      subject: "Medication Reminder",
                      html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                          <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                            <h2 style="color: #d9534f; text-align: center;">Medication Reminder</h2>
                            <p style="font-size: 16px; color: #333;">Dear <strong>${patient.fullName}</strong>,</p>
                            <p style="font-size: 16px; color: #333;">It's time to take your medicine!</p>
                            <p style="font-size: 16px; color: #333;"><strong>Dose:</strong> ${patient.dose}</p>
                            <p style="font-size: 16px; color: #333;">Please follow the prescribed schedule to stay healthy.</p>
                            <hr>
                            <p style="font-size: 14px; text-align: center; color: gray;">This is an automated message. Please do not reply.</p>
                          </div>
                        </div>
                      `,
                  });

                  await Patient.findByIdAndUpdate(patient._id, { smsSent: true });
                  console.log(`Reminder sent to ${patient.email}`);
              }, i * intervalMinutes * 60 * 1000);
          }
      });

      console.log("Medication reminders scheduled successfully.");
  } catch (error) {
      console.error("Error sending reminders:", error.message);
  }
});


// Update patient details
app.put("/update/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const updatedPatient = await Patient.findByIdAndUpdate(id, req.body, { new: true });
      if (!updatedPatient) return res.status(404).json({ error: "Patient not found!" });
      res.json({ message: "Patient updated successfully!", updatedPatient });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// Delete patient
app.delete("/delete/:id", async (req, res) => {
  try {
      const { id } = req.params;
      await Patient.findByIdAndDelete(id);
      res.json({ message: "Patient deleted successfully!" });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
