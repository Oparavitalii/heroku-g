import express from "express";
import stripe from "stripe";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const port = process.env.PORT || 4242;
const stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);
const upload = multer({ storage: multer.memoryStorage() });

// CORS configuration
const corsOptions = {
  origin: "https://take2eu.com", // Update with your frontend URL
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware for parsing JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Route to create a Stripe checkout session
app.post(
  "/create-checkout-session",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "certificates", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      amount,
      pdfBase64,
      firstName,
      lastName,
      email,
      phone,
      position,
      aboutYourself,
      plan,
    } = req.body;
    const cvFile = req.files["cv"] ? req.files["cv"][0] : null;
    const certificatesFile = req.files["certificates"]
      ? req.files["certificates"][0]
      : null;

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
        success_url: "https://take2eu.com/#/success",
        cancel_url: "https://take2eu.com/#/cancel",
        metadata: {
          pdfBase64,
          firstName,
          lastName,
          email,
          phone,
          position,
          aboutYourself,
          plan,
        },
      });

      // Send confirmation email
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: "Form Submission Received",
        text: `Thank you for your submission, ${firstName} ${lastName}!`,
        attachments: [
          {
            filename: "submission.pdf",
            content: pdfBase64,
            encoding: "base64",
          },
          ...(cvFile
            ? [{ filename: cvFile.originalname, content: cvFile.buffer }]
            : []),
          ...(certificatesFile
            ? [
                {
                  filename: certificatesFile.originalname,
                  content: certificatesFile.buffer,
                },
              ]
            : []),
        ],
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });

      res.json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

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

        // Process formData as needed
        console.log("Form submission received:", formData);
      }

      res.status(200).send("Received webhook");
    } catch (err) {
      console.error("Webhook Error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
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
