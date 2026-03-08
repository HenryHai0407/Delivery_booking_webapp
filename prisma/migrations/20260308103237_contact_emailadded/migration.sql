-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_driverId_fkey";

-- DropForeignKey
ALTER TABLE "BookingEvent" DROP CONSTRAINT "BookingEvent_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "BookingEvent" DROP CONSTRAINT "BookingEvent_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "BookingItem" DROP CONSTRAINT "BookingItem_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Pod" DROP CONSTRAINT "Pod_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "PodPhoto" DROP CONSTRAINT "PodPhoto_podId_fkey";

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodPhoto" ADD CONSTRAINT "PodPhoto_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
