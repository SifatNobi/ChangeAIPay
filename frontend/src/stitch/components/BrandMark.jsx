import React, { useState } from "react";
import { COMPANY_LOGO } from "../../constants/branding";

export default function BrandMark({ size = 52, src = COMPANY_LOGO }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="brand-mark" style={{ width: size, height: size, flexShrink: 0 }}>
      {!failed ? (
        <img
          src={src}
          alt="ChangeAIPay"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "-webkit-optimize-contrast",
            imageRendering: "crisp-edges",
            imageRendering: "high-quality",
            msInterpolationMode: "bicubic",
            filter: "none",
            shapeRendering: "geometricPrecision"
          }}
        />
      ) : (
        <span>C</span>
      )}
    </div>
  );
}

