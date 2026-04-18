import { useState } from "react";

const DEFAULT_LOGO_SRC = "/logo.svg";

export default function BrandMark({ size = 52, src = DEFAULT_LOGO_SRC }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      {!failed ? (
        <img
          src={src}
          alt="logo"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "-webkit-optimize-contrast",
            imageRendering: "crisp-edges"
          }}
        />
      ) : (
        <span>C</span>
      )}
    </div>
  );
}

