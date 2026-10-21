-- The Stripe payment of a paid order: Checkout Sessions have no dashboard page, payments do.
ALTER TABLE "orders" ADD COLUMN "stripePaymentIntentId" TEXT;
