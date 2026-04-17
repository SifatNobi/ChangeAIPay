import { useState } from "react";

const DEFAULT_LOGO_SRC = "/assets/icon.png";

export default function BrandMark({ size = 52, src = DEFAULT_LOGO_SRC }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      {!failed ? (
        <img src={src} alt="logo" onError={() => setFailed(true)} />
      ) : (
        <span>C</span>
      )}
    </div>
  );
}

