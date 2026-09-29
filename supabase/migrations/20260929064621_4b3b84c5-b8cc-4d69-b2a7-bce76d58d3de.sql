DROP POLICY "ride participants send messages" ON public.ride_messages;
CREATE POLICY "ride participants send messages" ON public.ride_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_messages.ride_id AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid()) AND r.status IN ('accepted','arriving','in_progress')));