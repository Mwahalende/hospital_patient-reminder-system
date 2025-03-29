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
app.post("/treatment", async (req, res) => {  // Add 'async' here
    try {
      const { patientId, doctorId, disease, dose, treatmentEnd, stay, wardNumber } = req.body;
  
      const patient = await Patient.findOneAndUpdate(
        { patientId },
        { doctorId, disease, dose, treatmentEnd, stay, wardNumber },
        { new: true }
      );
  
      if (!patient) return res.status(404).json({ error: "Patient not found!" });
  
      // Send Email Notification (Simulating SMS)
      transporter.sendMail({
        from: "leotitogalaxy@gmail.com",
        to: patient.email,
        subject: "Medication Reminder - Mwahalende International Hospital",
        text: `Hello ${patient.fullName},\nYour prescribed dose: ${dose}.\nTake your medicine on time for a quick recovery!`,
      }, async (err, info) => {  // Add 'async' here for the callback
        if (err) {
          return res.status(500).json({ error: "Error sending email." });
        }
        
        // After sending email, update the 'smsSent' field in the database
        await Patient.findByIdAndUpdate(patient._id, { smsSent: true }); // Now using await in an async function
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
cron.schedule("0 */4 * * *", async () => {
  try {
    const patients = await Patient.find({});

    patients.forEach((patient) => {
      let dosesPerDay = parseInt(patient.dose.split("x")[1]);
      let intervalHours = 24 / dosesPerDay;

      for (let i = 0; i < dosesPerDay; i++) {
        setTimeout(() => {
          const smsMessage = `Time to take your medicine! Dose: ${patient.dose}`;
          transporter.sendMail({
            from: "leotitogalaxy@gmail.com",
            to: patient.email,
            subject: "Medication Reminder",
            text: smsMessage,
          });

          // Update SMS sent content in the patient document
          patient.smsSent = smsMessage;
          patient.save();
        }, i * intervalHours * 60 * 60 * 1000);
      }
    });

    console.log("Medication reminders sent.");
  } catch (error) {
    console.error("Error sending reminders:", error.message);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
