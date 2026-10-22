import type { SignalDimension } from "./types.js";

export interface PersonaDefinition {
  readonly id: string;
  readonly highest: SignalDimension;
  readonly lowest: SignalDimension;
  readonly title: string;
  readonly lines: readonly [string, string];
  readonly description: string;
  readonly positiveDescription: string;
}

export const personaDefinitions = [
  {
    id: "workshop-architect",
    highest: "maintainability",
    lowest: "completeness",
    title: "Workshop Architect",
    lines: ["Workshop", "Architect"],
    description:
      "The blueprint stays sharp. The front sign could use a little more shape.",
    positiveDescription:
      "A clear sign out front, with most of the attention going to the well-kept workbench."
  },
  {
    id: "engine-room-crafter",
    highest: "maintainability",
    lowest: "usability",
    title: "Engine Room Crafter",
    lines: ["Engine Room", "Crafter"],
    description:
      "Care in the engine room. A few more signs would help first-time passengers.",
    positiveDescription:
      "Passengers have their directions. The engine room is where the extra care goes."
  },
  {
    id: "workshop-artisan",
    highest: "maintainability",
    lowest: "shipping",
    title: "Workshop Artisan",
    lines: ["Workshop", "Artisan"],
    description:
      "At home at the workbench. The release counter is the next stop.",
    positiveDescription:
      "Releases leave the shop, but the workbench still gets the most attention."
  },
  {
    id: "snapshot-crafter",
    highest: "maintainability",
    lowest: "consistency",
    title: "Snapshot Crafter",
    lines: ["Snapshot", "Crafter"],
    description:
      "Care in each frame. The story between snapshots is still coming into focus.",
    positiveDescription:
      "A story worth following, with extra care in every frame."
  },
  {
    id: "toolbox-keeper",
    highest: "maintainability",
    lowest: "stewardship",
    title: "Toolbox Keeper",
    lines: ["Toolbox", "Keeper"],
    description:
      "Every tool has a place. The welcome note is still tucked in the drawer.",
    positiveDescription:
      "The welcome note is up, and every tool has its place."
  },
  {
    id: "showcase-architect",
    highest: "completeness",
    lowest: "maintainability",
    title: "Showcase Architect",
    lines: ["Showcase", "Architect"],
    description:
      "The showroom is ready for visitors. The behind-the-scenes bench is still taking shape.",
    positiveDescription:
      "The back bench is stocked. The showroom gets the finishing touches."
  },
  {
    id: "kit-maker",
    highest: "completeness",
    lowest: "usability",
    title: "Kit Maker",
    lines: ["Kit", "Maker"],
    description:
      "The kit is thoughtfully packed. A quicker way in would make it even more inviting.",
    positiveDescription:
      "The instructions are in the box. The kit itself gets the spotlight."
  },
  {
    id: "showcase-maker",
    highest: "completeness",
    lowest: "shipping",
    title: "Showcase Maker",
    lines: ["Showcase", "Maker"],
    description:
      "The showroom shines from the street. Its delivery sign is waiting for a date.",
    positiveDescription:
      "Editions leave the shelf, with a showroom that makes them worth a closer look."
  },
  {
    id: "pop-up-maker",
    highest: "completeness",
    lowest: "consistency",
    title: "Pop-up Maker",
    lines: ["Pop-up", "Maker"],
    description:
      "The pop-up makes a memorable entrance. Its story between visits is still unfolding.",
    positiveDescription:
      "A story with chapters, and an entrance that makes each one stand out."
  },
  {
    id: "project-curator",
    highest: "completeness",
    lowest: "stewardship",
    title: "Project Curator",
    lines: ["Project", "Curator"],
    description:
      "The collection is thoughtfully arranged. The guest book is ready for more names.",
    positiveDescription:
      "Room for helpers, with every exhibit given its own introduction."
  },
  {
    id: "friendly-tour-guide",
    highest: "usability",
    lowest: "maintainability",
    title: "Friendly Tour Guide",
    lines: ["Friendly Tour", "Guide"],
    description:
      "The tour is a warm welcome. The backstage bench would make it easier to keep going.",
    positiveDescription:
      "A cared-for workshop, best explored with its welcoming guide."
  },
  {
    id: "trail-opener",
    highest: "usability",
    lowest: "completeness",
    title: "Trail Opener",
    lines: ["Trail", "Opener"],
    description:
      "The path is easy to follow. A clearer trailhead sign would complete the map.",
    positiveDescription:
      "A clear trailhead, with the most attention paid to every step along the path."
  },
  {
    id: "tutorial-crafter",
    highest: "usability",
    lowest: "shipping",
    title: "Tutorial Crafter",
    lines: ["Tutorial", "Crafter"],
    description:
      "Each lesson lands clearly. The course shelf has room for finished editions.",
    positiveDescription:
      "The editions are on the shelf. The step-by-step tour is the star."
  },
  {
    id: "first-steps-coach",
    highest: "usability",
    lowest: "consistency",
    title: "First Steps Coach",
    lines: ["First Steps", "Coach"],
    description:
      "The first steps feel supported. The path is gathering a longer story.",
    positiveDescription:
      "A path with a story, and a warm welcome at the first step."
  },
  {
    id: "user-translator",
    highest: "usability",
    lowest: "stewardship",
    title: "User Translator",
    lines: ["User", "Translator"],
    description:
      "The guide speaks plainly. The suggestion box is waiting for more voices.",
    positiveDescription:
      "The door is open to helpers. Clear explanations are the house specialty."
  },
  {
    id: "launch-pilot",
    highest: "shipping",
    lowest: "maintainability",
    title: "Launch Pilot",
    lines: ["Launch", "Pilot"],
    description:
      "The launch is on course. A steadier ground crew would help future flights.",
    positiveDescription:
      "The ground tools are packed. The launchpad takes center stage."
  },
  {
    id: "parcel-first",
    highest: "shipping",
    lowest: "completeness",
    title: "Parcel First",
    lines: ["Parcel", "First"],
    description:
      "The parcel arrives ready to open. A clearer label would help the next recipient.",
    positiveDescription:
      "The label is clear. Getting another edition out the door is the favorite part."
  },
  {
    id: "rocket-courier",
    highest: "shipping",
    lowest: "usability",
    title: "Rocket Courier",
    lines: ["Rocket", "Courier"],
    description:
      "The version has landed. Unpacking instructions are the next delivery.",
    positiveDescription:
      "Instructions included. The delivery still makes the entrance."
  },
  {
    id: "version-collector",
    highest: "shipping",
    lowest: "consistency",
    title: "Version Collector",
    lines: ["Version", "Collector"],
    description:
      "Versions go on the shelf. The story between editions is still finding its pages.",
    positiveDescription:
      "A project story told through its editions, with each release on the shelf."
  },
  {
    id: "indie-distributor",
    highest: "shipping",
    lowest: "stewardship",
    title: "Indie Distributor",
    lines: ["Indie", "Distributor"],
    description:
      "The shop ships its own way. A visitor book would make the counter feel more open.",
    positiveDescription:
      "An open counter for helpers, with releases front and center."
  },
  {
    id: "long-running-workshop",
    highest: "consistency",
    lowest: "maintainability",
    title: "Long-running Workshop",
    lines: ["Long-running", "Workshop"],
    description:
      "The workshop has a long memory. The workbench is ready for a little spring polish.",
    positiveDescription:
      "Tools in their places, with a project story that reaches back and carries on."
  },
  {
    id: "neighborhood-workshop",
    highest: "consistency",
    lowest: "completeness",
    title: "Neighborhood Workshop",
    lines: ["Neighborhood", "Workshop"],
    description:
      "A workshop with a story. A clearer front window would help new neighbors find their way.",
    positiveDescription:
      "A clear sign in the window, with a project story behind the door."
  },
  {
    id: "regulars-route",
    highest: "consistency",
    lowest: "usability",
    title: "Regular's Route",
    lines: ["Regular's", "Route"],
    description:
      "The route feels familiar. A clearer map would help more newcomers take the turn.",
    positiveDescription:
      "Directions for newcomers, and a route with a story to tell."
  },
  {
    id: "ongoing-workshop",
    highest: "consistency",
    lowest: "shipping",
    title: "Ongoing Workshop",
    lines: ["Ongoing", "Workshop"],
    description:
      "The workshop keeps its story going. The shelf of finished editions is still growing.",
    positiveDescription:
      "Editions on the shelf, with more of the story still being written."
  },
  {
    id: "quiet-lighthouse",
    highest: "consistency",
    lowest: "stewardship",
    title: "Quiet Lighthouse",
    lines: ["Quiet", "Lighthouse"],
    description:
      "The light keeps a steady watch. A welcome sign would bring more helpers up the path.",
    positiveDescription:
      "A welcome sign on the path, with a light that connects the past and present."
  },
  {
    id: "village-steward",
    highest: "stewardship",
    lowest: "maintainability",
    title: "Village Steward",
    lines: ["Village", "Steward"],
    description:
      "A welcome mat for helpers. The workshop bench is still finding its tools.",
    positiveDescription:
      "The workbench is stocked. Making room for helpers is the house specialty."
  },
  {
    id: "open-porch",
    highest: "stewardship",
    lowest: "completeness",
    title: "Open Porch",
    lines: ["Open", "Porch"],
    description:
      "The porch is open to everyone. A clearer house sign would help first-time visitors.",
    positiveDescription:
      "The house sign is clear. The welcome mat is what catches the eye."
  },
  {
    id: "contributor-lounge",
    highest: "stewardship",
    lowest: "usability",
    title: "Contributor Lounge",
    lines: ["Contributor", "Lounge"],
    description:
      "The lounge makes room for every guest. A quicker route to the good seat is still welcome.",
    positiveDescription:
      "Directions are at the door. The best seat is saved for someone joining in."
  },
  {
    id: "opening-host",
    highest: "stewardship",
    lowest: "shipping",
    title: "Opening Host",
    lines: ["Opening", "Host"],
    description:
      "The host knows how to roll out the welcome. The finished-edition shelf is still waiting by the door.",
    positiveDescription:
      "Editions on the shelf, with an invitation for people to help shape the next one."
  },
  {
    id: "welcome-host",
    highest: "stewardship",
    lowest: "consistency",
    title: "Welcome Host",
    lines: ["Welcome", "Host"],
    description:
      "The welcome feels personal. The guest book is ready for more chapters.",
    positiveDescription:
      "A project story to explore, with a welcome ready for the next person."
  }
] as const satisfies readonly PersonaDefinition[];

export const balancedPersona = {
  id: "balanced-builder",
  title: "Balanced Builder",
  description: "A little care in every corner of the workshop."
} as const;

export const balancedPersonaLines = ["Balanced", "Builder"] as const;
