import { Navigate } from "react-router-dom";

/** Contact-form mail lives on /admin/inquiries. Keep this URL for old links. */
export default function SupportTickets() {
  return <Navigate to="/admin/inquiries" replace />;
}
