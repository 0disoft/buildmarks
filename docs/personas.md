# Personas

Buildmarks adds a playful profile-card title to the existing six area scores. The scores and their formulas stay the same. A profile with a spread below 10 points gets the **Balanced Builder** title. Otherwise, the title follows the relative shape of the scored areas.

Persona selection ignores unavailable and not-applicable areas. A profile needs at least two scored areas; otherwise, the generated result has no persona. Ties use the stable order in `signalDimensions`.

The selected areas stay internal. Cards and reports show only the persona title and description. When the lower selected score is 60 or higher, the card uses the celebratory description. A lower score uses the gently worded portrait. No card labels a strongest or weakest area.

The JSON result adds a `persona` object. The existing `signalType` stays for compatibility.

```json
{
  "signalType": "Builder",
  "persona": {
    "id": "balanced-builder",
    "title": "Balanced Builder",
    "description": "A little care in every corner of the workshop."
  }
}
```

Personas use public project artifacts and the existing six cover artworks. The catalog does not promise separate artwork for every title.

| Title | Description |
| --- | --- |
| Contributor Lounge | The lounge makes room for every guest. A quicker route to the good seat is still welcome. |
| Engine Room Crafter | Care in the engine room. A few more signs would help first-time passengers. |
| First Steps Coach | The first steps feel supported. The path is gathering a longer story. |
| Friendly Tour Guide | The tour is a warm welcome. The backstage bench would make it easier to keep going. |
| Indie Distributor | The shop ships its own way. A visitor book would make the counter feel more open. |
| Kit Maker | The kit is thoughtfully packed. A quicker way in would make it even more inviting. |
| Launch Pilot | The launch is on course. A steadier ground crew would help future flights. |
| Long-running Workshop | The workshop has a long memory. The workbench is ready for a little spring polish. |
| Neighborhood Workshop | A workshop with a story. A clearer front window would help new neighbors find their way. |
| Ongoing Workshop | The workshop keeps its story going. The shelf of finished editions is still growing. |
| Open Porch | The porch is open to everyone. A clearer house sign would help first-time visitors. |
| Opening Host | The host knows how to roll out the welcome. The finished-edition shelf is still waiting by the door. |
| Parcel First | The parcel arrives ready to open. A clearer label would help the next recipient. |
| Pop-up Maker | The pop-up makes a memorable entrance. Its story between visits is still unfolding. |
| Project Curator | The collection is thoughtfully arranged. The guest book is ready for more names. |
| Quiet Lighthouse | The light keeps a steady watch. A welcome sign would bring more helpers up the path. |
| Regular's Route | The route feels familiar. A clearer map would help more newcomers take the turn. |
| Rocket Courier | The version has landed. Unpacking instructions are the next delivery. |
| Showcase Architect | The showroom is ready for visitors. The behind-the-scenes bench is still taking shape. |
| Showcase Maker | The showroom shines from the street. Its delivery sign is waiting for a date. |
| Snapshot Crafter | Care in each frame. The story between snapshots is still coming into focus. |
| Toolbox Keeper | Every tool has a place. The welcome note is still tucked in the drawer. |
| Trail Opener | The path is easy to follow. A clearer trailhead sign would complete the map. |
| Tutorial Crafter | Each lesson lands clearly. The course shelf has room for finished editions. |
| User Translator | The guide speaks plainly. The suggestion box is waiting for more voices. |
| Version Collector | Versions go on the shelf. The story between editions is still finding its pages. |
| Village Steward | A welcome mat for helpers. The workshop bench is still finding its tools. |
| Welcome Host | The welcome feels personal. The guest book is ready for more chapters. |
| Workshop Architect | The blueprint stays sharp. The front sign could use a little more shape. |
| Workshop Artisan | At home at the workbench. The release counter is the next stop. |
