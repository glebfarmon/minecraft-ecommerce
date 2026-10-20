-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "eurPlnRate" DECIMAL(10,4),
ADD COLUMN     "rateDate" DATE,
ADD COLUMN     "totalEurMinor" INTEGER,
ADD COLUMN     "totalPlnMinor" INTEGER;
