export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function memoize(fn) {
  const cache = new Map();
  return function memoized(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

export function lazyLoadImage(imgElement) {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
          observer.unobserve(img);
        }
      });
    });
    observer.observe(imgElement);
    return () => observer.disconnect();
  } else {
    if (imgElement.dataset.src) {
      imgElement.src = imgElement.dataset.src;
    }
    return () => {};
  }
}

export function preloadImages(urls) {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

export function createPrefetchLink(url, as = "script") {
  if (typeof document === "undefined") return;
  
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

export const performanceMetrics = {
  marks: new Map(),
  
  mark(name) {
    this.marks.set(name, performance.now());
  },
  
  measure(name, startMark, endMark) {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    if (start && end) {
      const duration = end - start;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  },
  
  getNavigationTiming() {
    if (typeof window === "undefined" || !window.performance) return null;
    
    const timing = window.performance.timing;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      firstPaint: timing.responseStart - timing.navigationStart,
      domInteractive: timing.domInteractive - timing.navigationStart
    };
  }
};

export function detectPerformanceIssues() {
  const metrics = performanceMetrics.getNavigationTiming();
  if (!metrics) return;
  
  if (metrics.domContentLoaded > 3000) {
    console.warn("[Performance] Slow DOM content loaded");
  }
  if (metrics.loadComplete > 5000) {
    console.warn("[Performance] Slow page load");
  }
  if (metrics.firstPaint > 2000) {
    console.warn("[Performance] Slow first paint");
  }
}

export function optimizeAPI(apiCall) {
  const cache = new Map();
  const CACHE_DURATION = 60000;

  return async function cachedAPI(...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    const data = await apiCall.apply(this, args);
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  };
}

export function createInfiniteScroll(callback, options = {}) {
  const { threshold = 100, container = window } = options;
  
  return function handleScroll() {
    const scrollTop = container.scrollY || container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.innerHeight;
    
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      callback();
    }
  };
}

export function generateCacheKey(...parts) {
  return parts.join(":").replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export default {
  debounce,
  throttle,
  memoize,
  lazyLoadImage,
  preloadImages,
  createPrefetchLink,
  performanceMetrics,
  detectPerformanceIssues,
  optimizeAPI,
  createInfiniteScroll,
  generateCacheKey
};