import axios from 'axios';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  success: boolean;
  results: TavilySearchResult[];
  error?: string;
}

class TavilySearchService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.tavily.com';

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY || null;

    if (!this.apiKey) {
      console.warn('[TavilySearch] TAVILY_API_KEY not set - search functionality disabled');
    } else {
      console.log('[TavilySearch] Initialized successfully');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for leads using Tavily API
   * Optimized for construction/contractor queries
   */
  async searchLeads(params: {
    location: string;
    keywords: string[];
    sites?: string[];
  }): Promise<TavilySearchResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        results: [],
        error: 'Tavily API key not configured'
      };
    }

    try {
      // Build search query focusing on people LOOKING FOR contractors (not contractors promoting themselves)
      const lookingForPhrases = [
        'looking for',
        'need',
        'recommendations',
        'recommend',
        'seeking',
        'anyone know',
        'suggestions for'
      ];

      const phrase = lookingForPhrases[Math.floor(Math.random() * lookingForPhrases.length)];
      const query = `${params.location} ${phrase} ${params.keywords.join(' ')} contractor`;

      // Site-specific search operators (dorks)
      const siteFilter = params.sites?.map(site => `site:${site}`).join(' OR ');
      const fullQuery = siteFilter ? `${query} (${siteFilter})` : query;

      console.log(`[TavilySearch] Query: "${fullQuery}"`);

      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          api_key: this.apiKey,
          query: fullQuery,
          search_depth: 'advanced',
          include_answer: false,
          include_raw_content: false,
          max_results: 15,
          include_domains: params.sites,
          exclude_domains: [
            'youtube.com',
            'linkedin.com',
            'facebook.com/pages', // Exclude business pages
            'instagram.com',
            'yelp.com', // Exclude review sites
            'angi.com',
            'homeadvisor.com',
            'thumbtack.com/pro', // Exclude contractor profiles
            'houzz.com/pro' // Exclude pro profiles
          ],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      let results: TavilySearchResult[] = response.data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.published_date,
      }));

      // Filter out low-quality results
      results = results.filter(result => {
        const content = result.content.toLowerCase();
        const title = result.title.toLowerCase();
        const combined = `${title} ${content}`;

        // Exclude if it's from a contractor promoting themselves
        const contractorKeywords = [
          'we offer',
          'our services',
          'we specialize',
          'years of experience',
          'licensed and insured',
          'free estimate',
          'call us',
          'contact us',
          'visit our website',
          'our company',
          'we provide',
          'our team'
        ];
        if (contractorKeywords.some(keyword => combined.includes(keyword))) {
          console.log(`[TavilySearch] Filtered out contractor promotion: ${result.title}`);
          return false;
        }

        // Exclude if it's just general discussion without specific need
        const vagueKeywords = [
          'just curious',
          'wondering if',
          'what do you think',
          'anyone else',
          'discussion',
          'thoughts on'
        ];
        if (vagueKeywords.some(keyword => combined.includes(keyword)) &&
            !combined.includes('looking for') &&
            !combined.includes('need') &&
            !combined.includes('recommend')) {
          console.log(`[TavilySearch] Filtered out vague discussion: ${result.title}`);
          return false;
        }

        // Require at least one strong lead indicator
        const leadIndicators = [
          'looking for',
          'need a',
          'need help',
          'recommendations',
          'recommend',
          'anyone know',
          'suggestions',
          'hiring',
          'seeking',
          'quote',
          'estimate',
          'budget'
        ];
        if (!leadIndicators.some(indicator => combined.includes(indicator))) {
          console.log(`[TavilySearch] Filtered out - no lead indicators: ${result.title}`);
          return false;
        }

        return true;
      });

      console.log(`[TavilySearch] Found ${results.length} quality results after filtering`);

      return {
        success: true,
        results,
      };
    } catch (error: any) {
      console.error('[TavilySearch] Error:', error.message);
      return {
        success: false,
        results: [],
        error: error.message,
      };
    }
  }

  /**
   * Preset search for Reddit leads
   */
  async searchReddit(location: string, keywords: string[]): Promise<TavilySearchResponse> {
    return this.searchLeads({
      location,
      keywords,
      sites: ['reddit.com/r/'],
    });
  }

  /**
   * Preset search for Nextdoor leads
   */
  async searchNextdoor(location: string, keywords: string[]): Promise<TavilySearchResponse> {
    return this.searchLeads({
      location,
      keywords,
      sites: ['nextdoor.com/pages'],
    });
  }

  /**
   * Preset search for Houzz leads
   */
  async searchHouzz(location: string, keywords: string[]): Promise<TavilySearchResponse> {
    return this.searchLeads({
      location,
      keywords,
      sites: ['houzz.com'],
    });
  }
}

export const tavilySearchService = new TavilySearchService();
