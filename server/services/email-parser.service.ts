import { InsertLead } from '@shared/schema';

export interface ParsedEmail {
  from: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface ParsedLead {
  name: string;
  contactInfo: string;
  source: 'thumbtack' | 'homedepot' | 'nextdoor' | 'manual';
  sourceUrl: string | null;
  contentSnippet: string;
  location: string | null;
  confidenceScore: number;
  interestTags: string[];
}

class EmailParserService {
  /**
   * Parse incoming email and extract lead information
   */
  parseEmail(email: ParsedEmail): ParsedLead | null {
    const from = email.from.toLowerCase();

    // Detect source based on sender domain
    if (from.includes('thumbtack.com')) {
      return this.parseThumbtackEmail(email);
    } else if (from.includes('homedepot.com') || from.includes('pro-referral')) {
      return this.parseHomeDepotEmail(email);
    } else if (from.includes('nextdoor.com')) {
      return this.parseNextdoorEmail(email);
    }

    // Unknown source
    console.warn('[EmailParser] Unknown email source:', from);
    return null;
  }

  /**
   * Parse Thumbtack lead notification
   * Format: "New lead from [Name] for [Service] in [Location]"
   */
  private parseThumbtackEmail(email: ParsedEmail): ParsedLead {
    const nameMatch = email.subject.match(/from (.+?) for/i);
    const serviceMatch = email.subject.match(/for (.+?) in/i);
    const locationMatch = email.subject.match(/in (.+?)$/i);

    // Extract contact info from body (email or phone)
    const emailMatch = email.body.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const phoneMatch = email.body.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

    const name = nameMatch ? nameMatch[1].trim() : 'Unknown User';
    const service = serviceMatch ? serviceMatch[1].trim() : '';
    const location = locationMatch ? locationMatch[1].trim() : null;
    const contactInfo = emailMatch ? emailMatch[0] : (phoneMatch ? phoneMatch[0] : '');

    return {
      name,
      contactInfo,
      source: 'thumbtack',
      sourceUrl: null,
      contentSnippet: email.body.substring(0, 500),
      location,
      confidenceScore: 75, // Thumbtack leads are pre-qualified
      interestTags: service ? [service.toLowerCase()] : [],
    };
  }

  /**
   * Parse Home Depot Pro Referral notification
   */
  private parseHomeDepotEmail(email: ParsedEmail): ParsedLead {
    // Home Depot format varies, use generic parsing
    const nameMatch = email.body.match(/Name:\s*(.+)/i);
    const emailMatch = email.body.match(/Email:\s*(.+)/i);
    const phoneMatch = email.body.match(/Phone:\s*(.+)/i);
    const locationMatch = email.body.match(/(City|Location):\s*(.+)/i);

    return {
      name: nameMatch ? nameMatch[1].trim() : 'Unknown User',
      contactInfo: emailMatch ? emailMatch[1].trim() : (phoneMatch ? phoneMatch[1].trim() : ''),
      source: 'homedepot',
      sourceUrl: null,
      contentSnippet: email.body.substring(0, 500),
      location: locationMatch ? locationMatch[2].trim() : null,
      confidenceScore: 80, // Home Depot referrals are high quality
      interestTags: ['homedepot', 'referral'],
    };
  }

  /**
   * Parse Nextdoor notification
   */
  private parseNextdoorEmail(email: ParsedEmail): ParsedLead {
    // Nextdoor sends post notifications
    const authorMatch = email.body.match(/Posted by (.+)/i);
    const neighborhoodMatch = email.body.match(/in (.+?) neighborhood/i);

    return {
      name: authorMatch ? authorMatch[1].trim() : 'Nextdoor User',
      contactInfo: email.from,
      source: 'nextdoor',
      sourceUrl: null,
      contentSnippet: email.body.substring(0, 500),
      location: neighborhoodMatch ? neighborhoodMatch[1].trim() : null,
      confidenceScore: 60, // Public posts vary in quality
      interestTags: ['nextdoor', 'local'],
    };
  }
}

export const emailParserService = new EmailParserService();
