import { useState, useRef, useEffect } from "react";
import { COMPANY_LOGO, COMPANY_NAME, FINA_AI_IMAGE } from "../constants/branding";
import "./DemoVideoSection.css";

const DEMO_VIDEO_URL = "https://photos.app.goo.gl/aSmonwPbsX8965pm7";

export default function DemoVideoSection({ onCtaClick }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handlePlay = () => {
    setIsPlaying(true);
    setShowOverlay(false);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const features = [
    { icon: "⚡", title: "Instant Transfers", description: "Send crypto in milliseconds" },
    { icon: "💰", title: "Zero Fees", description: "No transaction costs ever" },
    { icon: "🤖", title: "AI Assistant", description: "Fina helps you 24/7" },
    { icon: "🔒", title: "Secure", description: "Non-custodial & private" },
    { icon: "📱", title: "Mobile First", description: "Use anywhere, anytime" },
    { icon: "🌍", title: "Global", description: "Borderless payments" }
  ];

  return (
    <div className="demo-video-section" ref={containerRef}>
      <div className="demo-header">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="demo-logo" />
        <h1>See ChangeAIPay in Action</h1>
        <p>Experience the future of instant, fee-less crypto payments</p>
      </div>

      <div className="video-container">
        <div className="video-wrapper">
          <video
            ref={videoRef}
            className="demo-video"
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect fill='%23000' width='1920' height='1080'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%2354c3ff' font-size='120' font-family='sans-serif'%3E%F0%9F%8E%8A%3C/text%3E%3Ctext x='50%25' y='65%25' text-anchor='middle' fill='%23fff' font-size='48'%3EChangeAIPay Demo%3C/text%3E%3C/svg%3E"
            onPlay={handlePlay}
            onPause={handlePause}
            onClick={isPlaying ? null : handlePlay}
            preload="metadata"
          >
            <source src={DEMO_VIDEO_URL} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {showOverlay && !isPlaying && (
            <div className="video-overlay" onClick={handlePlay}>
              <div className="play-button-large">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="play-text">Watch Demo</span>
              <span className="duration-badge">2:34</span>
            </div>
          )}

          {isPlaying && (
            <div className="video-controls">
              <button className="control-btn" onClick={isPlaying ? handlePause : handlePlay}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <button className="control-btn fullscreen-btn" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="features-showcase">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <span className="feature-icon">{feature.icon}</span>
            <div className="feature-text">
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="demo-cta">
        <button className="cta-primary" onClick={() => onCtaClick?.("get-started")}>
          Get Started Free
        </button>
        <button className="cta-secondary" onClick={() => onCtaClick?.("learn-more")}>
          Learn More
        </button>
      </div>

      <div className="fina-showcase">
        <img src={FINA_AI_IMAGE} alt="Meet Fina" className="fina-avatar" />
        <div className="fina-text">
          <h4>Meet Fina, Your AI Assistant</h4>
          <p>Smart, helpful, and always ready to assist</p>
        </div>
      </div>
    </div>
  );
}