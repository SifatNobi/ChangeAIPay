import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ bootStatus, token, children }) {
  const location = useLocation();

  if (bootStatus === "loading") return <div className="screen-center stitch-bg">Loading...</div>;

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

