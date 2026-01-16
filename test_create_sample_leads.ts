// Create sample leads for testing the dashboard
import { storage } from './server/storage';

async function createSampleLeads() {
  console.log('\n=== Creating Sample Leads for Dashboard Testing ===\n');

  const sampleLeads = [
    {
      name: 'Sarah Miller',
      contactInfo: 'sarah.m@example.com',
      source: 'web_search' as const,
      sourceUrl: 'https://reddit.com/r/homeimprovement/sample1',
      contentSnippet: 'Looking for a contractor to remodel my kitchen in Capitol Hill. Need new cabinets, countertops, and flooring. Budget is around $50k.',
      interestTags: ['kitchen', 'remodel', 'cabinets', 'countertops'],
      status: 'new' as const,
      confidenceScore: 85,
      location: 'Capitol Hill, Seattle',
      draftResponse: 'Hi Sarah! We specialize in kitchen remodels in the Seattle area and would love to help with your project. We have extensive experience with cabinet installations and countertop work. Would you be available for a free consultation this week?'
    },
    {
      name: 'John Davidson',
      contactInfo: 'john.d@gmail.com',
      source: 'nextdoor' as const,
      sourceUrl: 'https://nextdoor.com/p/sample2',
      contentSnippet: 'Need someone to build a deck in my backyard. Looking for quotes from local contractors in Bellevue area.',
      interestTags: ['deck', 'outdoor', 'construction'],
      status: 'contacted' as const,
      confidenceScore: 78,
      location: 'Bellevue, WA',
      draftResponse: 'Hi John, thanks for considering us for your deck project. We have built many decks in the Bellevue area and would be happy to provide a detailed quote.',
      contactedAt: new Date()
    },
    {
      name: 'Emily Chen',
      contactInfo: '(206) 555-0123',
      source: 'thumbtack' as const,
      contentSnippet: 'Bathroom renovation needed. Master bath complete remodel including shower, vanity, and tile work.',
      interestTags: ['bathroom', 'remodel', 'tile', 'plumbing'],
      status: 'qualified' as const,
      confidenceScore: 92,
      location: 'Redmond, WA',
      draftResponse: 'Emily, we appreciate your interest in our services. Our team has completed over 50 bathroom remodels in the past year. Let\'s schedule a site visit to discuss your vision.'
    },
    {
      name: 'Michael Torres',
      contactInfo: 'michael.torres@outlook.com',
      source: 'social_media' as const,
      sourceUrl: 'https://facebook.com/groups/seattle-homeowners/sample',
      contentSnippet: 'Anyone know a good general contractor? Need to finish my basement - framing, electrical, drywall, the works.',
      interestTags: ['basement', 'finish', 'framing', 'electrical'],
      status: 'new' as const,
      confidenceScore: 70,
      location: 'Kirkland, WA',
      draftResponse: 'Michael, basement finishing is one of our specialties. We handle everything from permits to final touches. Would you like to discuss your project?'
    },
    {
      name: 'Jessica Park',
      contactInfo: 'jpark@example.com',
      source: 'referral' as const,
      contentSnippet: 'Referred by Tom Anderson. Need kitchen and bathroom remodel for my rental property.',
      interestTags: ['kitchen', 'bathroom', 'rental', 'investment'],
      status: 'converted' as const,
      confidenceScore: 95,
      location: 'Seattle, WA',
      notes: 'High-value client with multiple properties. Interested in future projects. Converted to quote.'
    },
    {
      name: 'Robert Kim',
      contactInfo: 'robert.kim@yahoo.com',
      source: 'homedepot' as const,
      contentSnippet: 'Looking for flooring installation throughout the house. Hardwood and tile.',
      interestTags: ['flooring', 'hardwood', 'tile'],
      status: 'archived' as const,
      confidenceScore: 60,
      location: 'Tacoma, WA',
      notes: 'Budget too low for our services.'
    },
    {
      name: 'Amanda Rodriguez',
      contactInfo: 'amanda.r@gmail.com',
      source: 'web_search' as const,
      sourceUrl: 'https://reddit.com/r/seattle/sample3',
      contentSnippet: 'Major home renovation project. Looking to update kitchen, bathrooms, and add a primary suite addition. Timeline is flexible.',
      interestTags: ['renovation', 'kitchen', 'bathroom', 'addition'],
      status: 'qualified' as const,
      confidenceScore: 88,
      location: 'Mercer Island, WA',
      draftResponse: 'Amanda, your project sounds exciting! We have extensive experience with whole-home renovations and additions. Let\'s set up a meeting to discuss the scope and timeline.',
      contactedAt: new Date()
    },
    {
      name: 'David Lee',
      contactInfo: '(425) 555-0199',
      source: 'nextdoor' as const,
      contentSnippet: 'Need to replace old windows throughout the house. Energy efficiency is important.',
      interestTags: ['windows', 'energy-efficiency', 'replacement'],
      status: 'contacted' as const,
      confidenceScore: 72,
      location: 'Sammamish, WA',
      draftResponse: 'David, we work with top window manufacturers and can help you find the most energy-efficient options for your home.',
      contactedAt: new Date(Date.now() - 86400000) // 1 day ago
    }
  ];

  try {
    let created = 0;
    for (const leadData of sampleLeads) {
      const lead = await storage.leads.createLead(leadData);
      console.log(`✅ Created lead: ${lead.name} (${lead.status}) - Confidence: ${lead.confidenceScore}%`);
      created++;
    }

    console.log(`\n✨ Successfully created ${created} sample leads!\n`);
    console.log('You can now view them at: http://localhost:3000/leads\n');

  } catch (error: any) {
    console.error('❌ Error creating sample leads:', error.message);
  }
}

// Run the script
createSampleLeads().catch(console.error);
