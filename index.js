const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const multer = require("multer");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

const corsOptions = {
  origin: "https://take2eu.com", // Update with your frontend URL
  optionsSuccessStatus: 200,
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.post("/create-checkout-session", upload.any(), async (req, res) => {
  const { amount } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Form Submission",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://take2eu.com/#/success",
      cancel_url: "https://take2eu.com/#//cancel",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Extract metadata
      const formData = session.metadata;
      const cv = req.files.find((file) => file.fieldname === "cv");
      const certificates = req.files.find(
        (file) => file.fieldname === "certificates"
      );

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: formData.email,
        subject: "Form Submission Received",
        text: `Thank you for your submission, ${formData.firstName} ${formData.lastName}!`,
        attachments: [
          {
            filename: "submission.pdf",
            content: formData.pdfBase64,
            encoding: "base64",
          },
          {
            filename: cv.originalname,
            content: cv.buffer,
          },
          {
            filename: certificates.originalname,
            content: certificates.buffer,
          },
        ],
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });
    }

    res.status(200).send("Received webhook");
  }
);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});



// import express from "express";
// import Stripe from "stripe";
// import bodyParser from "body-parser";
// import cors from "cors";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: "2020-08-27",
// });

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Configure CORS middleware
// const corsOptions = {
//   origin: "https://take2eu.com", // Update with your frontend URL
//   optionsSuccessStatus: 200,
// };

// app.use(cors(corsOptions));

// // Define your route
// app.post("/create-checkout-session", async (req, res) => {
//   const { amount } = req.body;
//   console.log(req.body); // For debugging

//   try {
//     if (!amount || typeof amount !== "number") {
//       throw new Error("Amount must be provided and must be a number.");
//     }

//     const unitAmount = amount * 100;

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       line_items: [
//         {
//           price_data: {
//             currency: "eur",
//             product_data: {
//               name: "Your Product Name",
//             },
//             unit_amount: unitAmount,
//           },
//           quantity: 1,
//         },
//       ],
//       mode: "payment",
//       success_url: "https://take2eu.com/#/succes", // Replace with your actual URL
//       cancel_url: "https://take2eu.com/#/cancel", // Replace with your actual URL
//     });

//     res.json({ id: session.id });
//   } catch (error) {
//     console.error("Error creating checkout session:", error);
//     res.status(500).send({ error: error.message });
//   }
// });

// const PORT = process.env.PORT || 4242;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
