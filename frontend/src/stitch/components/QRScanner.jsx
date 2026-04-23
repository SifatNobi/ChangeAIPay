import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess }) => {
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        setScanResult(decodedText);
        if (onScanSuccess) onScanSuccess(decodedText);
        scanner.clear(); 
      },
      (error) => { /* Ignore noise */ }
    );

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScanSuccess]);

  return (
    <div className="qr-scanner-container">
      <div id="reader" style={{ width: '300px' }}></div>
      {scanResult && <div className="scan-result"><p>Scanned: {scanResult}</p></div>}
    </div>
  );
};

export default QRScanner;
