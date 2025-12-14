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
      // Build search query with location and keywords
      const query = `${params.location} ${params.keywords.join(' ')} contractor recommend`;

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
          max_results: 10,
          include_domains: params.sites,
          exclude_domains: ['youtube.com', 'linkedin.com'], // Avoid noise
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const results: TavilySearchResult[] = response.data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.published_date,
      }));

      console.log(`[TavilySearch] Found ${results.length} results`);

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
