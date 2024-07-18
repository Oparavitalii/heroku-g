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
  bodyParser.raw({ type: "application/json" }),
  (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata;

      sendEmail(metadata);
    }

    response.json({ received: true });
  }
);

const sendEmail = async (metadata) => {
  const formDataToSend = new FormData();
  formDataToSend.append("pdfBase64", metadata.pdfBase64);
  formDataToSend.append("firstName", metadata.firstName);
  formDataToSend.append("lastName", metadata.lastName);
  formDataToSend.append("email", metadata.email);
  formDataToSend.append("phone", metadata.phone);
  formDataToSend.append("position", metadata.position);
  formDataToSend.append("aboutYourself", metadata.aboutYourself);
  formDataToSend.append("plan", metadata.plan);

  try {
    const response = await axios.post(
      "https://take2eu.com/send.php",
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("Email sent successfully!", response.data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer setup

// Stripe configuration
const stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);

// Route to create a Stripe checkout session
app.post("/create-checkout-session", upload.any(), async (req, res) => {
  const {
    amount,
    firstName,
    lastName,
    email,
    phone,
    position,
    aboutYourself,
    plan,
    pdfBase64,
  } = req.body;

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
      metadata: {
        amount,
        firstName,
        lastName,
        email,
        phone,
        position,
        aboutYourself,
        plan,
        pdfBase64,
      },
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
