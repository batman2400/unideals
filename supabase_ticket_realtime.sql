-- Enable Realtime for student_redemption_tickets so the UI can listen for redemption events
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_redemption_tickets;
