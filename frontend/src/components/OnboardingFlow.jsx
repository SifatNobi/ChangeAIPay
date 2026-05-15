import { useState, useEffect } from "react";
import { FINA_AI_IMAGE, COMPANY_LOGO, COMPANY_NAME, COMPANY_TAGLINE } from "../constants/branding";
import "./OnboardingFlow.css";

export function UserOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to ChangeAIPay",
      description: "Your gateway to instant, fee-less cryptocurrency payments.",
      highlight: "Zero fees. Instant settlement.",
      image: COMPANY_LOGO
    },
    {
      title: "Send Anywhere",
      description: "Send Nano to anyone, anywhere in the world instantly.",
      highlight: "No banking delays. No borders.",
      image: COMPANY_LOGO
    },
    {
      title: "Receive with Ease",
      description: "Share your QR code or wallet address to receive payments.",
      highlight: "Instant notifications. Real-time updates.",
      image: COMPANY_LOGO
    },
    {
      title: "Your Wallet, Your Control",
      description: "Your keys, your crypto. Fully secure and under your control.",
      highlight: "Non-custodial. Private.",
      image: COMPANY_LOGO
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-brand">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="onboarding-logo" />
        <span className="onboarding-tagline">{COMPANY_TAGLINE}</span>
      </div>

      <div className="onboarding-card">
        <div className="onboarding-avatar">
          <img src={FINA_AI_IMAGE} alt="Fina" />
        </div>

        <div className="onboarding-content">
          <h2>{steps[step].title}</h2>
          <p className="onboarding-description">{steps[step].description}</p>
          <p className="onboarding-highlight">{steps[step].highlight}</p>
        </div>

        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <span 
              key={i} 
              className={`progress-dot ${i <= step ? "active" : ""}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <button className="ghost-button" onClick={handleSkip}>
            Skip
          </button>
          <button className="primary-button" onClick={handleNext}>
            {step < steps.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MerchantOnboarding({ onComplete, businessInfo }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome, Merchant!",
      description: "Start accepting instant, fee-less crypto payments today.",
      highlight: "2-5% savings per transaction.",
      image: COMPANY_LOGO
    },
    {
      title: "Accept Crypto Payments",
      description: "Share your payment QR code with customers. They scan, they pay, you receive instantly.",
      highlight: "No payment processing fees.",
      image: COMPANY_LOGO
    },
    {
      title: "Real-time Dashboard",
      description: "Track sales, revenue, and customer analytics in your merchant dashboard.",
      highlight: "Detailed analytics. Export reports.",
      image: COMPANY_LOGO
    },
    {
      title: "Instant Settlements",
      description: "Receive payments instantly. No waiting for bank processing.",
      highlight: "Settle immediately. Cash flow control.",
      image: COMPANY_LOGO
    },
    {
      title: "Ready to Launch",
      description: `Your business "${businessInfo?.name || 'Your Business'}" is set up!`,
      highlight: "Start accepting payments now.",
      image: COMPANY_LOGO
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  return (
    <div className="onboarding-container merchant-onboarding">
      <div className="onboarding-brand">
        <img src={COMPANY_LOGO} alt={COMPANY_NAME} className="onboarding-logo" />
        <span className="onboarding-tagline">Merchant Portal</span>
      </div>

      <div className="onboarding-card">
        <div className="onboarding-avatar">
          <img src={FINA_AI_IMAGE} alt="Fina" />
        </div>

        <div className="onboarding-content">
          <span className="onboarding-badge">Merchant Setup</span>
          <h2>{steps[step].title}</h2>
          <p className="onboarding-description">{steps[step].description}</p>
          <p className="onboarding-highlight">{steps[step].highlight}</p>
        </div>

        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <span 
              key={i} 
              className={`progress-dot ${i <= step ? "active" : ""}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <button className="ghost-button" onClick={handleSkip}>
            Skip
          </button>
          <button className="primary-button" onClick={handleNext}>
            {step < steps.length - 1 ? "Next" : "Launch Dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default { UserOnboarding, MerchantOnboarding };