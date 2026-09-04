import { prisma } from "../src/lib/prisma.js";

const publishers = [
  { name: "ESPN", url: "https://espn.com", region: "US", rssFeedUrl: "http://www.espn.com/espn/rss/news" },
  { name: "TechCrunch", url: "https://techcrunch.com", region: "US", rssFeedUrl: "https://techcrunch.com/feed/" },
  { name: "BBC News", url: "https://bbc.co.uk/news", region: "UK", rssFeedUrl: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
  { name: "The Guardian", url: "https://theguardian.com", region: "UK", rssFeedUrl: "https://www.theguardian.com/uk/rss" },
];

const headlines: Record<string, string[]> = {
  "ESPN": [
    "NBA Finals Game 7 Results",
    "Warriors Clinch Playoff Spot After Overtime Thriller",
    "NFL Trade Deadline: Five Moves That Shook the League",
    "College Football Rankings Shake Up After Upset Weekend",
    "MLB Season Preview: Teams to Watch This Year",
    "Tennis Star Announces Surprise Retirement",
    "Olympic Committee Confirms 2028 Host City Venues",
    "Rookie Quarterback Breaks Franchise Passing Record",
    "Champions League Draw Sets Up Blockbuster Quarterfinals",
    "Boxing Heavyweight Title Fight Ends in Controversial Decision",
    "Formula 1 Season Finale Comes Down to Final Lap",
    "Golf Major Postponed Due to Severe Weather",
  ],
  "TechCrunch": [
    "Startup Raises $50M Series B for AI Infrastructure",
    "Major Cloud Provider Announces New Data Center Region",
    "Chip Maker Unveils Next-Gen Processor Architecture",
    "Social Platform Rolls Out Redesigned Feed Algorithm",
    "Venture Capital Funding Slows in Third Quarter",
    "Open Source Project Hits One Million Contributors",
    "Regulator Opens Antitrust Probe Into App Store Fees",
    "Robotics Company Demos Warehouse Automation System",
    "Browser Vendor Patches Critical Zero-Day Vulnerability",
    "Streaming Service Tests New Subscription Tier",
    "Electric Vehicle Startup Delays Production Timeline",
    "Quantum Computing Startup Announces Breakthrough Result",
  ],
  "BBC News": [
    "Chancellor Unveils Budget Amid Economic Pressures",
    "Rail Strikes Set to Disrupt Commuter Services",
    "NHS Announces Funding Boost for Emergency Care",
    "Parliament Debates New Immigration Legislation",
    "Flooding Warnings Issued Across Southern Counties",
    "Bank of England Holds Interest Rates Steady",
    "Council Elections Results Show Shift in Local Politics",
    "Museum Unveils Major New Historical Exhibition",
  ],
  "The Guardian": [
    "Climate Report Warns of Accelerating Sea Level Rise",
    "Housing Crisis Deepens as Rents Hit Record Highs",
    "University Funding Cuts Spark Staff Walkouts",
    "Investigation Reveals Gaps in Food Safety Inspections",
    "Arts Council Announces New Grants for Regional Theatres",
    "Energy Prices Set to Rise Again This Winter",
    "Report Finds Widening Gap in Regional Healthcare Access",
    "Local Elections Turnout Hits Decade Low",
  ],
};

async function main() {
  for (const pub of publishers) {
    const publisher = await prisma.publisher.upsert({
      where: { url: pub.url },
      update: { rssFeedUrl: pub.rssFeedUrl },
      create: pub,
    });

    const titles = headlines[pub.name] ?? [];
    console.log(`seeding ${titles.length} articles for ${pub.name}...`);

    for (let i = 0; i < titles.length; i++) {
      const publishedAt = new Date(Date.now() - i * 1000 * 60 * 60 * 6);

      await prisma.article.upsert({
        where: { url: `${pub.url}/articles/${i + 1}` },
        update: {},
        create: {
          title: titles[i],
          summary: null,
          url: `${pub.url}/articles/${i + 1}`,
          thumbnailUrl: null,
          region: pub.region,
          publishedAt,
          publisherId: publisher.id,
        },
      });
    }
  }

  console.log("seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });