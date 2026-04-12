import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.warn("Stripe secret key missing. Checkout will be disabled.");
}

export const stripe = stripeSecret 
  ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" }) 
  : null;

