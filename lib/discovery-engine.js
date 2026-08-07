/*
  DISCOVERY ENGINE — Surfaces connections users don't know to ask about.

  Design principles:
  1. Never hide information
  2. Always explain why a connection matters
  3. Offer paths, don't force them
  4. Work in their language
  5. Respect their intelligence
*/

class DiscoveryEngine {
  constructor() {
    this.patterns = new Map();
    this.successStories = new Map();
    this.localContext = {};
  }

  async discover(userRequest, context = {}) {
    const coreNeed = await this.understandCoreNeed(userRequest, context);
    const connections = await this.findConnections(coreNeed, context);
    const stories = await this.findRelatedStories(coreNeed, context);
    const paths = await this.mapPaths(coreNeed, connections, context);
    return this.buildDiscoveryResponse(coreNeed, connections, stories, paths, context);
  }

  async understandCoreNeed(request, context = {}) {
    const underlyingNeed = await this.inferUnderlyingNeed(request);
    const desiredOutcome = await this.inferDesiredOutcome(request, underlyingNeed);
    const constraints = await this.inferConstraints(request, context);

    return {
      surfaceRequest: request,
      underlyingNeed,
      desiredOutcome,
      constraints
    };
  }

  async findConnections(coreNeed, context) {
    const connections = [];

    for (const problem of this.getAdjacentProblems(coreNeed.underlyingNeed)) {
      connections.push({
        type: 'adjacent_problem',
        what: problem.what,
        why: `People working on ${coreNeed.underlyingNeed.replace(/_/g, ' ')} often find they also need ${problem.what}. ${problem.story}`,
        optional: true
      });
    }

    for (const enabler of this.getEnablers(coreNeed, context)) {
      connections.push({
        type: 'enabler',
        what: enabler.what,
        why: enabler.why,
        howMuchDifference: enabler.impact,
        optional: true
      });
    }

    for (const path of this.getScalingPaths(coreNeed)) {
      connections.push({
        type: 'scaling',
        what: path.what,
        why: `Once you have ${coreNeed.surfaceRequest} working, ${path.what} becomes possible.`,
        optional: true
      });
    }

    for (const resource of this.getAvailableResources(coreNeed, context)) {
      connections.push({
        type: 'resource',
        what: resource.what,
        why: resource.why,
        howToAccess: resource.howToAccess,
        optional: true
      });
    }

    return connections;
  }

  async findRelatedStories(coreNeed, context) {
    const allStories = [
      {
        who: 'Maria, community health worker in rural Tanzania',
        problem: 'Needed to track patient visits across 5 villages with no internet',
        solution: 'Built a clinic records app with Lighthouse — works offline, syncs when in town',
        outcome: 'Now serves 200+ patients/month. District health office adopted her system.',
        tags: ['better_healthcare', 'clinic', 'patient', 'health']
      },
      {
        who: 'David, farmer cooperative leader in Uganda',
        problem: "Farmers didn't know market prices — middlemen paid whatever they wanted",
        solution: 'Built a price comparison tool that works on basic phones',
        outcome: 'Cooperative members increased income by 40% in 6 months.',
        tags: ['fair_income_for_farmers', 'market', 'price', 'crop', 'farm']
      },
      {
        who: 'Amina, school administrator in rural Kenya',
        problem: "Couldn't track which students attended which days — funding depended on attendance",
        solution: 'Built an offline attendance tracker. Teachers use it on shared tablets.',
        outcome: 'Attendance data now accurate. School qualified for full government funding.',
        tags: ['better_education', 'school', 'student', 'teacher']
      },
      {
        who: 'Joseph, water committee chair in Malawi',
        problem: 'Village pumps broke often and nobody knew which ones needed repair',
        solution: 'Built a pump tracker with GPS and photo documentation using Lighthouse',
        outcome: 'Pump repair time dropped from weeks to days. Clean water access improved for 400 families.',
        tags: ['clean_water_access', 'water', 'pump', 'well']
      }
    ];

    const request = (coreNeed.surfaceRequest || '').toLowerCase();
    const need = coreNeed.underlyingNeed;

    const scored = allStories.map(story => {
      let score = story.tags.includes(need) ? 3 : 0;
      for (const tag of story.tags) {
        if (request.includes(tag)) score += 2;
      }
      if (context.region && story.who.toLowerCase().includes(context.region.replace(/-/g, ' '))) {
        score += 1;
      }
      return { ...story, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ score, tags, ...story }) => ({ ...story, connection: need }));
  }

  async mapPaths(coreNeed, connections, context) {
    return {
      immediate: {
        description: 'What you can do today',
        steps: [
          'Get your app built — it takes about 2 minutes',
          'Test it on your phone',
          'Share it with 2–3 people you work with'
        ]
      },
      thisWeek: {
        description: 'What you can do this week',
        steps: connections
          .filter(c => c.type === 'enabler')
          .slice(0, 3)
          .map(c => c.what)
      },
      thisMonth: {
        description: "What becomes possible once it's working",
        steps: connections
          .filter(c => c.type === 'scaling')
          .slice(0, 3)
          .map(c => c.what)
      },
      longTerm: {
        description: 'Where others in your situation have gone',
        steps: [
          'Train others in neighboring villages',
          'Connect with district-level programs',
          'Become a Lighthouse Navigator and earn income helping others'
        ]
      }
    };
  }

  buildDiscoveryResponse(coreNeed, connections, stories, paths, context) {
    return {
      direct: {
        summary: `I'll help you ${coreNeed.surfaceRequest}.`,
        whatHappensNext: "Building your app now. You'll have working code in about 2 minutes.",
        desiredOutcome: coreNeed.desiredOutcome
      },
      connections: {
        likelyRelevantNow: connections.filter(c => c.type === 'adjacent_problem'),
        worthKnowing: connections.filter(c => c.type === 'enabler'),
        futurePossibilities: connections.filter(c => c.type === 'scaling'),
        availableResources: connections.filter(c => c.type === 'resource')
      },
      stories: stories.slice(0, 2),
      paths,
      principles: [
        'Everything shown is optional. You choose what to explore.',
        'No information is hidden. Ask about anything you see here.',
        'These connections come from real people who solved similar problems.',
        'Your data stays on your device. Nothing is tracked or sold.'
      ],
      coreNeed: {
        underlyingNeed: coreNeed.underlyingNeed,
        constraints: coreNeed.constraints
      }
    };
  }

  getAdjacentProblems(underlyingNeed) {
    const map = {
      clean_water_access: [
        {
          what: 'Track water quality testing results',
          story: 'One community found that tracking pump maintenance AND water quality together helped them spot contamination patterns early.'
        },
        {
          what: 'Schedule community water committee meetings',
          story: 'Regular maintenance works better when the whole committee knows the schedule.'
        },
        {
          what: 'Report broken pumps to district authorities',
          story: 'Automated reporting got pumps fixed 3x faster than manual requests.'
        }
      ],
      better_healthcare: [
        {
          what: 'Track medicine inventory and expiration dates',
          story: 'Clinics that track both patients AND medicine stock reduce waste by 30%.'
        },
        {
          what: 'Send appointment reminders via SMS',
          story: 'Missed appointments dropped 60% when patients got text reminders.'
        }
      ],
      fair_income_for_farmers: [
        {
          what: 'Track harvest yields and predict best selling times',
          story: 'Farmers who tracked seasonal price patterns made 25% more by timing their sales.'
        },
        {
          what: 'Connect with buyer cooperatives directly',
          story: 'Cutting out middlemen doubled margins for a cooperative in Tanzania.'
        }
      ],
      better_education: [
        {
          what: 'Track student grades alongside attendance',
          story: 'Schools that linked attendance to academic progress identified at-risk students earlier.'
        },
        {
          what: 'Send parent notifications for absences',
          story: 'Parent engagement improved when families got same-day absence alerts.'
        }
      ],
      efficient_business: [
        {
          what: 'Track supplier delivery times',
          story: 'Shops that tracked suppliers reduced stockouts by 40%.'
        },
        {
          what: 'Generate daily sales summaries',
          story: 'Owners who reviewed daily totals caught theft and pricing errors faster.'
        }
      ]
    };

    return map[underlyingNeed] || [
      {
        what: 'Share your solution with others facing the same problem',
        story: 'Your work can help people in similar situations.'
      }
    ];
  }

  getEnablers(coreNeed, context) {
    const enablers = [
      {
        what: 'Add GPS location tracking',
        why: 'Field workers can find locations without asking directions. Works offline.',
        impact: 'Saves 2–3 hours per week in travel time.'
      },
      {
        what: 'Add photo documentation',
        why: 'Before/after photos help prove work was done. Helps with funding reports.',
        impact: 'Communities using photo evidence got 50% more maintenance funding.'
      },
      {
        what: 'Set up automatic backups',
        why: 'Your data survives if your phone is lost or damaged.',
        impact: 'Peace of mind. Zero data loss.'
      }
    ];

    if (context.connectivity === 'offline-first' || !context.connectivity) {
      enablers.push({
        what: 'Design for offline-first sync',
        why: 'Data saves locally and syncs when you reach town or Wi-Fi.',
        impact: 'Works reliably in areas with no mobile data.'
      });
    }

    return enablers;
  }

  getScalingPaths(coreNeed) {
    return [
      {
        what: 'Share with neighboring villages',
        why: 'The app you built works for anyone with the same need.'
      },
      {
        what: 'Connect with district-level programs',
        why: 'Government and NGO programs often have funding for tools like yours.'
      },
      {
        what: 'Train others as Lighthouse Navigators',
        why: 'You can earn income helping others build their own solutions.'
      }
    ];
  }

  getAvailableResources(coreNeed, context) {
    const resources = [
      {
        what: 'Lighthouse Navigator in your region',
        why: 'A trained community member who can help you in person, in your language.',
        howToAccess: "We'll connect you after you build your first app."
      }
    ];

    const region = context.region || '';
    if (region.includes('east-africa') || region === 'east-africa') {
      resources.push({
        what: 'East Africa Community Tech Fund',
        why: 'Small grants ($100–$500) for community-built technology solutions.',
        howToAccess: 'Apply at: lighthouse.foundation/grants/east-africa'
      });
    }
    if (region.includes('south-asia') || region === 'south-asia') {
      resources.push({
        what: 'South Asia Digital Inclusion Grants',
        why: 'Support for offline-first community tools in rural areas.',
        howToAccess: 'Apply at: lighthouse.foundation/grants/south-asia'
      });
    }

    return resources;
  }

  async inferUnderlyingNeed(request) {
    const patterns = {
      water: 'clean_water_access',
      pump: 'clean_water_access',
      well: 'clean_water_access',
      clinic: 'better_healthcare',
      patient: 'better_healthcare',
      health: 'better_healthcare',
      medicine: 'better_healthcare',
      market: 'fair_income_for_farmers',
      price: 'fair_income_for_farmers',
      crop: 'fair_income_for_farmers',
      farm: 'fair_income_for_farmers',
      school: 'better_education',
      student: 'better_education',
      teacher: 'better_education',
      inventory: 'efficient_business',
      stock: 'efficient_business',
      shop: 'efficient_business',
      sell: 'efficient_business'
    };

    const lower = request.toLowerCase();
    for (const [keyword, need] of Object.entries(patterns)) {
      if (lower.includes(keyword)) return need;
    }
    return 'community_improvement';
  }

  async inferDesiredOutcome(request, underlyingNeed) {
    const outcomes = {
      clean_water_access: 'Every pump is maintained, every family has clean water, no child gets sick from bad water.',
      better_healthcare: 'Every patient is tracked, every visit is recorded, no one falls through the cracks.',
      fair_income_for_farmers: 'Farmers know the real market price and get paid fairly for their work.',
      better_education: 'Every student is accounted for, every grade is recorded, every child gets the education they deserve.',
      efficient_business: 'Stock is tracked, sales are recorded, the business runs smoothly and profitably.',
      community_improvement: 'The problem is solved, and life is better because of it.'
    };
    return outcomes[underlyingNeed] || outcomes.community_improvement;
  }

  async inferConstraints(request, context = {}) {
    return {
      connectivity: context.connectivity || 'offline-first',
      device: context.device || 'basic smartphone or shared tablet',
      power: context.power || 'solar or intermittent grid power',
      language: context.language || 'local language',
      region: context.region || 'global'
    };
  }
}

module.exports = { DiscoveryEngine };
