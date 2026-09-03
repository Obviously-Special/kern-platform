import type { PageType } from '@kern/contracts';

/**
 * Site page map — the customer-specific configuration layer (doc 3 §6.1:
 * "Context mapping / page adapters", "Knowledge pack").
 *
 * This is CONFIGURATION, not code: per real customer this becomes a
 * tenant-scoped config object. It bridges generic intelligence and
 * reliable customer-specific behavior — facts the model cannot see on
 * the page (client-rendered flows, prices behind steps, business rules).
 */
export interface SiteFact {
  heading: string;
  pageTypes: PageType[];
  text: string;
}

export interface SitePageMap {
  siteId: string;
  baseUrl: string;
  /** Routes the crawler indexes. */
  routes: string[];
  /** Curated business facts not extractable from static HTML. */
  facts: SiteFact[];
}

export const demoSiteMap: SitePageMap = {
  siteId: 'demo-bergblick',
  baseUrl: process.env.KERN_DEMO_SITE_URL ?? 'http://localhost:3000',
  routes: ['/', '/services', '/pricing', '/booking', '/account', '/help'],
  facts: [
    {
      heading: 'Insurance options',
      pageTypes: ['booking'],
      text: 'Base liability cover is included in every price. Activity protection: CHF 15 per person — adds cancellation and accident cover. Full cover: CHF 29 per person — additionally includes equipment damage and rescue costs. An insurance option must be selected before continuing.',
    },
    {
      heading: 'Weekend surcharge',
      pageTypes: ['booking', 'pricing'],
      text: 'Saturday and Sunday departures carry a 15% peak-season surcharge, shown at the review step.',
    },
    {
      heading: 'Group size rules',
      pageTypes: ['booking'],
      text: 'Eiger Panorama Hike, E-Mountain Bike Tour and Intro to Rock Climbing require at least 2 participants. Tandem Paragliding: 1 guest per pilot.',
    },
    {
      heading: 'Cancellation policy',
      pageTypes: ['booking', 'help'],
      text: 'Free cancellation up to 72 hours before the start time. 50% refund between 72 and 24 hours. No refund within 24 hours. Full cover insurance refunds 100% at any time.',
    },
    {
      heading: 'Booking cut-off',
      pageTypes: ['booking', 'help'],
      text: 'Online bookings close at 18:00 the evening before the start date. For last-minute availability call +41 33 555 18 20 from 8:00.',
    },
    {
      heading: 'Equipment rental',
      pageTypes: ['booking'],
      text: 'Equipment rental costs CHF 40 per person — bike, helmet or climbing gear depending on the experience.',
    },
    {
      heading: 'Collection point arrangement',
      pageTypes: ['booking'],
      text: 'Collection point arrangement is free: we arrange the meeting point for your group, including hotel collection where available.',
    },
    {
      heading: 'Booking process',
      pageTypes: ['booking'],
      text: 'The booking flow has 6 steps: 1. Choose your experience, 2. Date & group, 3. Extras, 4. Insurance, 5. Your details, 6. Review & confirm. An insurance option must be selected at step 4 before continuing.',
    },
    {
      heading: 'Contact information',
      pageTypes: [], // site-wide
      text: 'Phone: +41 33 555 18 20 (from 8:00). Email: hello@bergblick.example. Address: Dorfstrasse 12, 3818 Grindelwald. The base is open daily from 8:00 to 18:00.',
    },
  ],
};
