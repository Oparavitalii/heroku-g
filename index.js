import express from 'express'
import Stripe from 'stripe'
import bodyParser from 'body-parser'
import cors from 'cors' // Import cors middleware
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
})

app.use(bodyParser.json())

// Configure CORS middleware
app.use(cors())

// Define your route
app.post('/create-checkout-session', async (req, res) => {
  const { amount } = req.body
  console.log(req.body.amount)

  try {
    if (!amount || typeof amount !== 'number') {
      throw new Error('Amout must be provided and must be a number.')
    }

    const unitAmount = amount * 100

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Your Product Name',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://your-app-name.herokuapp.com/success', // Replace  your Heroku app URL
      cancel_url: 'https://your-app-name.herokuapp.com/cancel', // Replace with your Heroku app URL
    })

    res.json({ id: session.id })
  } catch (error) {
    res.status(500).send({ error: error.message })
  }
})

const PORT = process.env.PORT || 4242
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
