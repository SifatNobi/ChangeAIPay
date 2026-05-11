import fetch from "node-fetch";
import logger from "./logger.js";

class ConversionService {
  constructor() {
    this.priceCache = new Map();
    this.cacheTimeout = 60000;
    this.fallbackPrice = 0.0075;
  }

  async getNanoPrice(currency = "EUR") {
    const cacheKey = `nano_${currency}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }

    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=nano&vs_currencies=eur,usd", {
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Coingecko API error: ${response.status}`);
      }

      const data = await response.json();
      const nano = data?.nano;

      if (!nano || !nano.eur || !nano.usd) {
        throw new Error("Invalid price data");
      }

      const prices = {
        EUR: nano.eur,
        USD: nano.usd
      };

      this.priceCache.set(cacheKey, {
        price: prices[currency],
        timestamp: Date.now(),
        allPrices: prices
      });

      logger.info("Nano price fetched", { currency, price: prices[currency] });
      return prices[currency];
    } catch (err) {
      logger.warn("Price fetch failed, using cached/fallback", { error: err.message });
      
      const fallback = this.priceCache.get(cacheKey)?.price || this.fallbackPrice;
      return fallback;
    }
  }

  async convertFiatToNano(amount, currency = "EUR") {
    const nanoPrice = await this.getNanoPrice(currency);
    const nanoAmount = amount / nanoPrice;
    
    return {
      fiatAmount: amount,
      fiatCurrency: currency,
      nanoPrice,
      nanoAmount: this.roundNano(nanoAmount),
      rate: 1 / nanoPrice,
      timestamp: new Date().toISOString()
    };
  }

  async convertNanoToFiat(nanoAmount, currency = "EUR") {
    const nanoPrice = await this.getNanoPrice(currency);
    const fiatAmount = nanoAmount * nanoPrice;
    
    return {
      nanoAmount: this.roundNano(nanoAmount),
      fiatAmount: this.roundFiat(fiatAmount),
      fiatCurrency: currency,
      nanoPrice,
      rate: nanoPrice,
      timestamp: new Date().toISOString()
    };
  }

  async lockConversion(amount, currency = "EUR", lockDurationMs = 300000) {
    const conversion = await this.convertFiatToNano(amount, currency);
    
    return {
      ...conversion,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + lockDurationMs).toISOString(),
      lockDuration: lockDurationMs
    };
  }

  async getCurrentRates() {
    const [eurPrice, usdPrice] = await Promise.all([
      this.getNanoPrice("EUR"),
      this.getNanoPrice("USD")
    ]);

    return {
      EUR: eurPrice,
      USD: usdPrice,
      lastUpdated: new Date().toISOString(),
      source: "coingecko"
    };
  }

  roundNano(amount) {
    return Math.round(amount * 1e6) / 1e6;
  }

  roundFiat(amount) {
    return Math.round(amount * 100) / 100;
  }

  calculateFee(amount, isNanoPayment = false, plan = null) {
    const baseFee = isNanoPayment ? 0 : 0.029;
    const platformFee = plan?.pricing?.platformFee ? plan.pricing.platformFee / 100 : 0;
    const fxFee = isNanoPayment ? 0 : (plan?.pricing?.fxSpread || 1.45) / 100;
    
    return {
      processingFee: amount * baseFee,
      platformFee: amount * platformFee,
      fxFee: amount * fxFee,
      totalFee: amount * (baseFee + platformFee + fxFee)
    };
  }

  calculateSavings(fiatAmount, plan = null) {
    const cardFees = fiatAmount * 0.029;
    const nanoFees = 0;
    
    return {
      cardProcessing: cardFees,
      nanoProcessing: nanoFees,
      savings: cardFees - nanoFees,
      savingsPercentage: ((cardFees - nanoFees) / fiatAmount) * 100
    };
  }
}

const conversionService = new ConversionService();

export const getNanoPrice = (currency) => conversionService.getNanoPrice(currency);
export const convertFiatToNano = (amount, currency) => conversionService.convertFiatToNano(amount, currency);
export const convertNanoToFiat = (amount, currency) => conversionService.convertNanoToFiat(amount, currency);
export const lockConversion = (amount, currency, duration) => conversionService.lockConversion(amount, currency, duration);
export const getCurrentRates = () => conversionService.getCurrentRates();
export const calculateFee = (amount, isNano, plan) => conversionService.calculateFee(amount, isNano, plan);
export const calculateSavings = (amount, plan) => conversionService.calculateSavings(amount, plan);

export default conversionService;