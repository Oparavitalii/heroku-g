import express from "express";
import stripe from "stripe";
import bodyParser from "body-parser";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

// CORS configuration
const corsOptions = {
  origin: "https://take2eu.com", // Update with your frontend URL
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Stripe configuration
const stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);

// Route to create a Stripe checkout session
app.post("/create-checkout-session", upload.any(), async (req, res) => {
  const { amount } = req.body;

  try {
    const session = await stripeConfig.checkout.sessions.create({
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
      cancel_url: "https://take2eu.com/#/cancel",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Route to handle Stripe webhook events
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    try {
      const event = stripeConfig.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
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
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }

    res.status(200).send("Received webhook");
  }
);

// Test route to verify CORS setup
app.get("/test-cors", (req, res) => {
  res.json({ message: "CORS is working" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
