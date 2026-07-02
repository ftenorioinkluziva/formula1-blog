export interface NewsArticleSeedItem {
  title: string
  excerpt: string
  category: string
  readTime: string
  publishedDate: string
  comments: number | null
  author: string
  body: string[]
  isFeatured: boolean
}

export const newsArticlesSeed: NewsArticleSeedItem[] = [
  {
    title: "New Regulations Set to Shake Up the 2026 Grid",
    excerpt:
      "The sweeping technical changes promise to level the playing field, with ground-effect aerodynamics and sustainable fuel mandates creating opportunities for every constructor.",
    category: "Raio-X Técnico",
    readTime: "6 min read",
    publishedDate: "Feb 20, 2026",
    comments: 142,
    author: "Marco Vitelli",
    body: [
      "The FIA's overhaul for the 2026 season represents the most radical restructuring of Formula 1's technical regulations in over a decade. Engineers across the paddock have been working around the clock since the draft rules were published, with chief designers describing the new framework as 'a blank canvas and a nightmare rolled into one.'",
      "Central to the changes is a return to active aerodynamics, where front and rear wing elements can adjust their angle of attack at speed. This system is intended to reduce dirty air and enable closer racing, though teams are already divided on whether it will deliver the promised spectacle. Red Bull's technical director described the moveable aerodynamics as 'the most complex mechanical challenge we've faced since the KERS era.'",
      "The power unit story is equally dramatic. The new 1.6-litre V6 hybrid units retain a broadly similar architecture to the current generation but now require a 50% share of sustainable fuel — a mandate pushed by Formula 1's own sustainability commitments. Power outputs are expected to exceed 1,000 bhp for the first time, with the electrical deployment window fundamentally changing overtaking mechanics.",
      "Perhaps the most consequential regulation for the competitive order is the revised cost cap, which tightens further for 2026 and introduces stricter penalties for infractions. Midfield teams see this as their opportunity to close the gap to the top three constructors, while the big-budget operations are under greater scrutiny than ever before.",
    ],
    isFeatured: true,
  },
  {
    title: "Verstappen Extends Championship Lead with Dominant Win",
    excerpt:
      "Max Verstappen converted pole position into a commanding victory, leaving his rivals to fight over the remaining points.",
    category: "O Debate na Pista",
    readTime: "4 min",
    publishedDate: "Feb 19, 2026",
    comments: null,
    author: "Sofia Renard",
    body: [
      "For the fifth time this season, Max Verstappen crossed the finish line first with a margin that made the result feel inevitable long before the chequered flag appeared. Starting from pole, the Dutchman built a comfortable buffer in the opening stint and never looked back, executing his strategy with the clinical precision that has defined his championship campaigns.",
      "Behind him, the battle for the minor podium positions raged for the entirety of the race distance. Charles Leclerc made a bold undercut attempt at the pit window, bringing Ferrari back into contention for second, only to be undercut in return by Lando Norris, who benefited from an extra lap of tyre life on his second set of mediums.",
      "The championship standings paint an increasingly difficult picture for Verstappen's rivals. With six rounds completed and a points advantage that stretches beyond a race win's worth, the conversation has already shifted to who might realistically challenge Red Bull at the remaining circuits on the calendar.",
    ],
    isFeatured: false,
  },
  {
    title: "Silver Arrows Unveil Revolutionary Sidepod Design",
    excerpt:
      "Mercedes brought a major aerodynamic package to the circuit that rewrites their entire cooling and airflow philosophy.",
    category: "Raio-X Técnico",
    readTime: "3 min",
    publishedDate: "Feb 18, 2026",
    comments: null,
    author: "Kai Bronsted",
    body: [
      "Spotted under the afternoon sun during Thursday's track walk, Mercedes' updated sidepod geometry is unlike anything currently running in the field. The inlet has been dramatically narrowed, feeding into a sculpted undercut that extends further forward than the current regulations were assumed to allow — an interpretation the team's aerodynamicists will no doubt defend robustly if protested.",
      "The concept shifts a significant portion of the car's cooling load to a revised underbody channel that works in conjunction with the floor. Engineers in the paddock were divided on whether the gains in downforce would outweigh the thermal management risks, particularly in high-ambient-temperature venues later in the season.",
      "Mercedes' technical chief confirmed the update represents months of wind tunnel correlation work and that the team is 'confident in the direction.' Practice long-run data will be the first real-world test of those claims.",
    ],
    isFeatured: false,
  },
  {
    title: "Rookie Sensation Scores First Podium in Only Third Race",
    excerpt:
      "The 20-year-old defied experienced rivals and a safety car restart to claim a stunning third place on only his third Formula 1 start.",
    category: "O Debate na Pista",
    readTime: "5 min",
    publishedDate: "Feb 17, 2026",
    comments: null,
    author: "Sofia Renard",
    body: [
      "Nobody told him it was supposed to be hard. In just his third Formula 1 start, the rookie drove with composure that belied his experience, managing tyres, traffic and a pivotal late-race safety car restart to stand on the podium for the first time. Veterans in the pitlane struggled to recall a debut season this assured.",
      "The key moment came at the restart with twelve laps remaining. Starting fourth, he out-braked his more experienced rivals into Turn 1, defended the inside line through the compression and emerged in third with enough clean air to hold the position to the flag. It was a move that would have been audacious from an established race winner.",
      "His race engineer described the final stint as 'textbook tyre management.' The team had feared degradation would become a factor given the younger compound choice, but the data told a different story: lap times remained remarkably consistent while rivals on nominally fresher rubber behind him struggled to close.",
    ],
    isFeatured: false,
  },
  {
    title: "Behind the Scenes: How Teams Prepare for Street Circuits",
    excerpt:
      "From simulator hours to bespoke suspension setups, the preparation for Monaco and Baku bears little resemblance to a typical race weekend.",
    category: "Giro pelo Paddock",
    readTime: "8 min",
    publishedDate: "Feb 16, 2026",
    comments: null,
    author: "Marco Vitelli",
    body: [
      "In the weeks before a street circuit race, the atmosphere inside a Formula 1 factory changes perceptibly. The usual hum of aerodynamic development gives way to a more anxious focus on mechanical grip, ride height, and — critically — the millimetric judgements that separate a barrier from clean air in the armco-lined canyons of Monaco or Baku.",
      "The simulator programme intensifies dramatically. Drivers spend upwards of four hours per day in the motion rig, learning barrier positions that are unforgiving of error at racing speeds. Unlike permanent circuits, there is essentially no run-off; the consequence of a mistake is immediate and race-ending.",
      "Suspension philosophy changes entirely. The soft, compliant setups favoured on high-speed purpose-built tracks are replaced with the stiffest configurations in the team's toolkit, prioritising predictability and precision over comfort. Steering racks are often swapped to a quicker ratio, and brake bias is adjusted to favour the front axle for the tight chicanes that characterise both circuits.",
      "Perhaps most importantly, crew training intensifies. Street circuits offer fewer safe pit lane entry paths, meaning the margin for a botched pit stop — one that requires the car to circle again — is both operationally costly and potentially dangerous. Teams run full-speed pitstop practice daily leading into the event.",
    ],
    isFeatured: false,
  },
  {
    title: "FIA Announces Calendar Changes for the Second Half of the Season",
    excerpt:
      "Two rounds have been rescheduled and one new venue added, as the governing body responds to logistical and political pressures.",
    category: "O Debate na Pista",
    readTime: "2 min",
    publishedDate: "Feb 15, 2026",
    comments: null,
    author: "Kai Bronsted",
    body: [
      "The FIA World Motor Sport Council has ratified a revised calendar for the second half of the 2026 season, confirming changes that had been rumoured since mid-January. The most significant alteration sees one European round moved two weeks later to avoid a clash with another major international sporting event, a move that required renegotiating broadcast and hospitality contracts.",
      "A new street circuit venue has been added as a replacement for a grand prix that was unable to fulfil its contractual obligations due to local infrastructure delays. The incoming circuit has received provisional homologation and will undergo a final inspection before the FIA issues full approval.",
      "Teams have expressed measured concern about the revised freight logistics, with the updated calendar compressing several back-to-back zones in the Americas and Asia. The logistics working group will meet before the summer break to assess contingency plans.",
    ],
    isFeatured: false,
  },
  {
    title: "Tyre Strategy Masterclass: Breaking Down Last Weekend's Race",
    excerpt:
      "A detailed look at how the top four finishers played their strategy and why the one-stop gamble paid off spectacularly.",
    category: "Raio-X Técnico",
    readTime: "7 min",
    publishedDate: "Feb 14, 2026",
    comments: null,
    author: "Marco Vitelli",
    body: [
      "On paper, the Pirelli data suggested a two-stop race. The medium compound had shown acceptable wear in practice, but the soft — which several teams targeted for a fast opening stint — degraded faster than the tyre manufacturer's models predicted. That divergence between expectation and reality was the inflection point around which the entire strategic narrative rotated.",
      "The race winner's team made their call on lap 18, a full eight laps earlier than their models had pencilled in. The insight came from live telemetry showing a step-change increase in thermal degradation that the pre-race compound models had not captured. Moving early onto the hard opened a pit window that caught the field out of position and gifted the race lead at a critical moment.",
      "Two other top-five finishers attempted the one-stop gamble on the contrarian hard-medium combination, aiming to run the hard compound through the opening stint and switch to the softer medium for an aggressive final phase. The strategy demanded impeccable thermal management in sector two — a sector that punishes understeer with rapid left-front degradation — and both drivers delivered.",
      "Pirelli's trackside engineer noted post-race that the actual degradation curves were approximately 15% steeper than the pre-event model predictions, a variance the tyre manufacturer attributed to track surface abrasiveness following resurfacing over the winter. Teams will factor this correction into their models for similar circuits later in the calendar.",
    ],
    isFeatured: false,
  },
]
