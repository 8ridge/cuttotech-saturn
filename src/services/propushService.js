/**
 * Propush.me Onclick Ad Service
 * Monetizes redirect page traffic with pop-under ads
 */

export class PropushService {
  static config = {
    // Enable only on production domain cut-to.link
    enabled: typeof window !== 'undefined' 
      && (window.location.hostname === 'cut-to.link' 
          || window.location.hostname === 'www.cut-to.link'),
    
    // Percentage of users who see ads (0-100)
    // Start with 10%, increase to 50-100% after testing
    percentage: 10,
    
    // Propush onclick ad URL from dashboard
    clickUrl: 'https://djxh1.com/4/10486292',
    
    // Delay before initializing (5 seconds as per Propush settings)
    delay: 5000
  };

  /**
   * Check if current user should see ads based on percentage
   */
  static shouldShowAd() {
    if (!this.config.enabled) {
      console.log('🚫 Propush: Disabled (not on production domain)');
      return false;
    }

    const randomValue = Math.random() * 100;
    const shouldShow = randomValue < this.config.percentage;
    
    if (!shouldShow) {
      console.log(`🎲 Propush: User excluded (${randomValue.toFixed(1)}% >= ${this.config.percentage}%)`);
      return false;
    }

    console.log(`✅ Propush: User selected for ads (${randomValue.toFixed(1)}% < ${this.config.percentage}%)`);
    return true;
  }

  /**
   * Initialize Propush onclick ads
   */
  static init() {
    if (!this.shouldShowAd()) {
      return;
    }

    if (typeof window === 'undefined') {
      console.warn('⚠️ Propush: Window not available');
      return;
    }

    try {
      console.log(`🚀 Propush: Initializing with ${this.config.percentage}% coverage, ${this.config.delay}ms delay`);

      // Propush onclick initialization
      (function () {
        const clickUrl = PropushService.config.clickUrl + '?var={your_source_id}';

        function clickTbEventInit() {
          document.addEventListener('click', function () {
            window.onbeforeunload = null;
            window.open(clickUrl, '_blank', 'noreferrer,noopener');
          });
        }

        setTimeout(function () {
          clickTbEventInit();
          console.log('✅ Propush: Click handler initialized');
        }, PropushService.config.delay);
      })();

    } catch (error) {
      console.error('❌ Propush: Init error', error);
    }
  }

  /**
   * Check if Propush is loaded
   */
  static isLoaded() {
    return this.config.enabled && typeof window !== 'undefined';
  }
}

export default PropushService;
