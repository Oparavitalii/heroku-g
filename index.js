import express from "express";
import stripe from "stripe";
import bodyParser from "body-parser";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 4242;
const upload = multer();

// CORS configuration
const corsOptions = {
  origin: "https://take2eu.com", // Update with your frontend URL
  optionsSuccessStatus: 200,
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.use(cors(corsOptions));
app.post(
  "/form",
  bodyParser.raw({ type: "application/json" }), // Ensure raw body parser is used for webhooks
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

        // Send confirmation email
        const mailOptions = {
          from: "take2europe@gmail.com",
          to: "take2europe@gmail.com",
          subject: "Form Submission Received",
          text: `Thank you for your submission, ${formData.firstName} ${formData.lastName}!`,
          attachments: [
            {
              filename: "submission.pdf",
              content: formData.pdfBase64,
              encoding: "base64",
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
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer setup

// Stripe configuration
const stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);

// Route to create a Stripe checkout session
app.post("/create-checkout-session", upload.any(), async (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: "Amount is required" });
  }

  try {
    const session = await stripeConfig.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Form Submission",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://take2eu.com/#/succes",
      cancel_url: "https://take2eu.com/#/cancel",
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to handle Stripe webhook events

// Test route to verify CORS setup
app.get("/test-cors", (req, res) => {
  res.json({ message: "CORS is working" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
