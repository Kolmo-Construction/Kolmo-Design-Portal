// Quote Analytics Tracking System
interface AnalyticsEvent {
  event: string;
  eventData?: any;
  sessionId?: string;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
  screenResolution?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface ViewSession {
  sessionId: string;
  deviceFingerprint?: string;
  sectionsViewed?: string[];
  actionsPerformed?: any[];
  customerEmail?: string;
  customerName?: string;
}

class QuoteAnalytics {
  private quoteId: number | null = null;
  private sessionId: string = '';
  private startTime: number = Date.now();
  private lastActivity: number = Date.now();
  private scrollDepth: number = 0;
  private sectionsViewed: Set<string> = new Set();
  private actionsPerformed: any[] = [];
  private timeOnPageInterval: NodeJS.Timeout | null = null;
  private scrollTrackingInterval: NodeJS.Timeout | null = null;

  constructor(quoteId: number) {
    this.quoteId = quoteId;
    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const screenResolution = `${screen.width}x${screen.height}`;
    
    // Detect device type
    let deviceType = 'desktop';
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      deviceType = /iPad/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Detect browser
    let browser = 'unknown';
    if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (userAgent.indexOf('Safari') > -1) browser = 'Safari';
    else if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (userAgent.indexOf('Edge') > -1) browser = 'Edge';

    // Detect OS
    let operatingSystem = 'unknown';
    if (userAgent.indexOf('Windows') > -1) operatingSystem = 'Windows';
    else if (userAgent.indexOf('Mac') > -1) operatingSystem = 'macOS';
    else if (userAgent.indexOf('Linux') > -1) operatingSystem = 'Linux';
    else if (userAgent.indexOf('Android') > -1) operatingSystem = 'Android';
    else if (userAgent.indexOf('iOS') > -1) operatingSystem = 'iOS';

    return { deviceType, browser, operatingSystem, screenResolution };
  }

  private getLocationInfo() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const referrer = document.referrer;
    
    // Extract UTM parameters
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source') || undefined;
    const utmMedium = urlParams.get('utm_medium') || undefined;
    const utmCampaign = urlParams.get('utm_campaign') || undefined;

    return { timezone, referrer, utmSource, utmMedium, utmCampaign };
  }

  private createDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
      canvas.toDataURL()
    ].join('|');

    return btoa(fingerprint).slice(0, 32);
  }

  private async trackEvent(event: string, eventData?: any) {
    if (!this.quoteId) return;

    const deviceInfo = this.getDeviceInfo();
    const locationInfo = this.getLocationInfo();
    
    const analyticsData: AnalyticsEvent = {
      event,
      eventData,
      sessionId: this.sessionId,
      ...deviceInfo,
      ...locationInfo,
      timeOnPage: Math.floor((Date.now() - this.startTime) / 1000),
      scrollDepth: this.scrollDepth,
    };

    try {
      await fetch(`/api/quotes/${this.quoteId}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyticsData),
      });
    } catch (error) {
      console.warn('Failed to track analytics event:', error);
    }
  }

  private async createOrUpdateSession() {
    if (!this.quoteId) return;

    const sessionData: ViewSession = {
      sessionId: this.sessionId,
      deviceFingerprint: this.createDeviceFingerprint(),
      sectionsViewed: Array.from(this.sectionsViewed),
      actionsPerformed: this.actionsPerformed,
    };

    try {
      await fetch(`/api/quotes/${this.quoteId}/analytics/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
    } catch (error) {
      console.warn('Failed to update session:', error);
    }
  }

  private updateScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentScrollDepth = Math.round((scrollTop / documentHeight) * 100);
    
    if (currentScrollDepth > this.scrollDepth) {
      this.scrollDepth = Math.min(currentScrollDepth, 100);
      
      // Update scroll depth on server
      fetch('/api/analytics/session/scroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          scrollDepth: this.scrollDepth,
        }),
      }).catch(() => {}); // Silent fail
    }
  }

  private initializeTracking() {
    // Track initial page view
    this.trackEvent('page_view');
    this.createOrUpdateSession();

    // Track scroll depth
    this.scrollTrackingInterval = setInterval(() => {
      this.updateScrollDepth();
    }, 2000);

    // Track time on page
    this.timeOnPageInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      fetch('/api/analytics/session/duration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          duration,
        }),
      }).catch(() => {}); // Silent fail
    }, 30000); // Update every 30 seconds

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden');
      } else {
        this.trackEvent('page_visible');
        this.lastActivity = Date.now();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      navigator.sendBeacon('/api/analytics/session/duration', JSON.stringify({
        sessionId: this.sessionId,
        duration,
      }));
    });

    // Set up intersection observer for section tracking
    this.setupSectionTracking();
  }

  private setupSectionTracking() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            const sectionName = entry.target.id;
            if (!this.sectionsViewed.has(sectionName)) {
              this.sectionsViewed.add(sectionName);
              this.trackEvent('section_view', { section: sectionName });
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe sections with IDs
    setTimeout(() => {
      document.querySelectorAll('[id]').forEach((element) => {
        observer.observe(element);
      });
    }, 1000);
  }

  // Public methods for tracking specific events
  trackButtonClick(buttonName: string, context?: any) {
    this.trackEvent('button_click', { button: buttonName, context });
    this.actionsPerformed.push({
      action: 'button_click',
      button: buttonName,
      context,
      timestamp: Date.now(),
    });
  }

  trackFormSubmission(formName: string, data?: any) {
    this.trackEvent('form_submit', { form: formName, data });
    this.actionsPerformed.push({
      action: 'form_submit',
      form: formName,
      timestamp: Date.now(),
    });
  }

  trackDownload(fileName: string, fileType?: string) {
    this.trackEvent('download', { file: fileName, type: fileType });
    this.actionsPerformed.push({
      action: 'download',
      file: fileName,
      type: fileType,
      timestamp: Date.now(),
    });
  }

  trackImageInteraction(action: string, imageContext?: any) {
    this.trackEvent('image_interaction', { action, context: imageContext });
    this.actionsPerformed.push({
      action: 'image_interaction',
      details: action,
      context: imageContext,
      timestamp: Date.now(),
    });
  }

  trackCustomerInfo(email?: string, name?: string) {
    if (email || name) {
      // Update session with customer info
      fetch(`/api/quotes/${this.quoteId}/analytics/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          customerEmail: email,
          customerName: name,
        }),
      }).catch(() => {});
    }
  }

  destroy() {
    if (this.timeOnPageInterval) {
      clearInterval(this.timeOnPageInterval);
    }
    if (this.scrollTrackingInterval) {
      clearInterval(this.scrollTrackingInterval);
    }
  }
}

export default QuoteAnalytics;