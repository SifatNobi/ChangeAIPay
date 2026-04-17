export default function SafeText({ children, fallback = "—" }) {
  return <>{children ?? fallback}</>;
}

