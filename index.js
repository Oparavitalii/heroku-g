import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2020-08-27",
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure CORS middleware
const corsOptions = {
  origin: "https://oparavitalii.space", // Update with your frontend URL
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Define your route
app.post("/create-checkout-session", async (req, res) => {
  const { amount } = req.body;
  console.log(req.body); // For debugging

  try {
    if (!amount || typeof amount !== "number") {
      throw new Error("Amount must be provided and must be a number.");
    }

    const unitAmount = amount * 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Your Product Name",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://oparavitalii.space/take2eu/#/succes", // Replace with your actual URL
      cancel_url: "https://oparavitalii.space/take2eu/#/cancel", // Replace with your actual URL
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
