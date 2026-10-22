/** Local 128 × 128 vector emblems: no fonts, remote images or animation. */
const emblems: Record<string, string> = {
  "workshop-architect": `
    <rect x="29" y="24" width="66" height="82" rx="7" class="emblem-paper"/>
    <path d="M41 40h42M41 51h20M43 89l21-38 21 38M51 76h26"/>
    <circle cx="64" cy="51" r="5" class="emblem-fill"/>`,
  "engine-room-crafter": `
    <path d="m53 24 22 0 3 13 12 7 13-4 11 20-10 9v14l10 9-11 19-13-4-12 7-3 13H53l-3-13-12-7-13 4-11-19 10-9V69L14 60l11-20 13 4 12-7Z" transform="translate(13 2) scale(.8)" class="emblem-fill"/>
    <circle cx="64" cy="62" r="23" class="emblem-cutout"/>
    <path d="m53 64 8 8 15-18"/>`,
  "workshop-artisan": `
    <path d="m42 34 15-10 25 25-10 15-12-6-25 34-11-9 30-32Z" class="emblem-fill"/>
    <path d="m83 74 16 17M79 97h27M24 106h80"/>
    <circle cx="95" cy="35" r="5"/>`,
  "snapshot-crafter": `
    <path d="M23 45h21l8-13h27l8 13h18v53H23Z" class="emblem-paper"/>
    <circle cx="64" cy="71" r="21" class="emblem-fill"/>
    <circle cx="64" cy="71" r="10" class="emblem-cutout"/>
    <path d="M88 55h7M31 107h66"/>`,
  "toolbox-keeper": `
    <rect x="24" y="48" width="80" height="52" rx="8" class="emblem-fill"/>
    <path d="M48 48V32h32v16M24 68h80"/>
    <rect x="57" y="61" width="14" height="16" rx="3" class="emblem-cutout"/>
    <path d="M39 87h20" class="emblem-light"/>`,
  "showcase-architect": `
    <path d="m23 47 41-24 41 24M30 47h68v56H30Z" class="emblem-paper"/>
    <path d="M43 58v32M64 58v32M85 58v32M23 104h82"/>
    <path d="M44 32h40L64 20Z" class="emblem-fill"/>`,
  "kit-maker": `
    <path d="m25 47 39-22 39 22-39 23ZM25 47v43l39 22 39-22V47M64 70v42" class="emblem-paper"/>
    <path d="m45 36 39 23v22l-12 7V66L33 43" class="emblem-fill"/>
    <path d="m83 29 10-11m7 20h11"/>`,
  "showcase-maker": `
    <rect x="31" y="67" width="66" height="35" rx="4" class="emblem-fill"/>
    <path d="M22 105h84M43 67V51h42v16"/>
    <path d="m64 21 7 14 16 2-12 12 3 16-14-8-14 8 3-16-12-12 16-2Z" class="emblem-paper"/>`,
  "pop-up-maker": `
    <path d="M23 51 36 28h56l13 23Z" class="emblem-fill"/>
    <path d="M23 51v10q10 12 20 0 10 12 21 0 10 12 20 0 10 12 21 0V51M30 68v37h68V68"/>
    <path d="M45 80h19v25M77 80h10v13M20 106h88"/>`,
  "project-curator": `
    <path d="m48 28 16-13 16 13"/>
    <rect x="27" y="29" width="74" height="70" rx="5" class="emblem-paper"/>
    <path d="m38 84 20-25 14 14 10-12 9 23Z" class="emblem-fill"/>
    <circle cx="80" cy="47" r="6"/>
    <path d="M40 109h48"/>`,
  "friendly-tour-guide": `
    <circle cx="60" cy="69" r="33" class="emblem-paper"/>
    <path d="m69 47-4 27-25 14 7-27Z" class="emblem-fill"/>
    <path d="M91 50V20l21 9-21 9M60 29v8M60 101v8"/>`,
  "trail-opener": `
    <path d="M30 99h39q28 0 28-20T64 58q-30 0-30-18" stroke-dasharray="5 7"/>
    <path d="M34 52s-17-17-17-27a17 17 0 0 1 34 0c0 10-17 27-17 27Z" class="emblem-fill"/>
    <circle cx="34" cy="26" r="5" class="emblem-cutout"/>
    <path d="m84 24 11 11 19-20M23 99h14"/>`,
  "tutorial-crafter": `
    <path d="M20 35q22-10 44 2 22-12 44-2v62q-22-10-44 2-22-12-44-2Z" class="emblem-paper"/>
    <path d="M64 38v61M31 52h18M31 63h18M31 74h12"/>
    <path d="m78 53 19 13-19 13Z" class="emblem-fill"/>`,
  "first-steps-coach": `
    <path d="M21 102h26V82h25V61h27V40h13"/>
    <path d="m35 55 12-12 12 12M47 43v25"/>
    <rect x="23" y="73" width="12" height="19" rx="6" class="emblem-fill" transform="rotate(-20 29 82)"/>
    <rect x="68" y="29" width="12" height="19" rx="6" class="emblem-fill" transform="rotate(20 74 38)"/>`,
  "user-translator": `
    <path d="M20 29h63v43H48L33 86V72H20Z" class="emblem-paper"/>
    <path d="M88 49h20v43H94l-1 14-17-14H57V80"/>
    <path d="M34 44h35M51 37v7M40 44q4 17 23 21M62 44q-4 17-23 21M75 78l9-21 9 21M79 70h10"/>`,
  "launch-pilot": `
    <path d="m18 62 91-35-32 83-17-33-42-15ZM60 77l49-50" class="emblem-fill"/>
    <path d="M34 88 20 102M48 99l-8 14M25 78l-12 4"/>`,
  "parcel-first": `
    <path d="m39 54 30-17 32 17-32 18ZM39 54v40l30 18 32-18V54M69 72v40" class="emblem-paper"/>
    <path d="M16 35h49m-12-12 12 12-12 12M16 55h12M22 71h8"/>
    <path d="m55 45 31 18v19l-10 6V69L45 51" class="emblem-fill"/>`,
  "rocket-courier": `
    <path d="M49 79q-3-36 38-57 17 43-11 65Z" class="emblem-fill"/>
    <path d="m48 58-21 9-2 23 24-11M81 74l9 22-19 15-3-25" class="emblem-paper"/>
    <circle cx="72" cy="51" r="10" class="emblem-cutout"/>
    <path d="m42 91-13 17M53 98l-6 13M30 85l-14 7"/>`,
  "version-collector": `
    <path d="M22 32h42l38 38-39 39-41-41Z" class="emblem-fill"/>
    <path d="M32 21h41l38 39M44 12h38l35 35"/>
    <circle cx="41" cy="51" r="6" class="emblem-cutout"/>
    <path d="m62 72 8 8 15-16" class="emblem-light"/>`,
  "indie-distributor": `
    <path d="M64 43v24M31 82V67h66v15"/>
    <path d="m48 22 16-9 16 9v20l-16 9-16-9Z" class="emblem-fill"/>
    <rect x="18" y="82" width="26" height="23" rx="5" class="emblem-paper"/>
    <rect x="51" y="82" width="26" height="23" rx="5" class="emblem-paper"/>
    <rect x="84" y="82" width="26" height="23" rx="5" class="emblem-paper"/>`,
  "long-running-workshop": `
    <path d="M22 69V39h59v64H22ZM22 39l30-19 29 19M33 103V78h19v25" class="emblem-paper"/>
    <circle cx="87" cy="78" r="28" class="emblem-fill"/>
    <path d="M87 60v20l13 7" class="emblem-light"/>`,
  "neighborhood-workshop": `
    <path d="m20 58 44-34 44 34M29 52v53h70V52" class="emblem-paper"/>
    <path d="M49 105V78h30v27M13 105h102"/>
    <path d="M49 51a15 15 0 0 0 20 19l15 15 8-8-15-15a15 15 0 0 0-19-20l9 9-9 9Z" class="emblem-fill"/>`,
  "regulars-route": `
    <path d="M30 49a38 38 0 0 1 67-8l8 13M105 34v20H85M98 79a38 38 0 0 1-67 8l-8-13M23 94V74h20"/>
    <circle cx="64" cy="64" r="16" class="emblem-fill"/>
    <path d="m57 64 5 5 10-11" class="emblem-light"/>`,
  "ongoing-workshop": `
    <rect x="27" y="27" width="74" height="78" rx="8" class="emblem-paper"/>
    <path d="M27 48h74M44 18v18M84 18v18M41 65h10M41 80h10M41 94h10"/>
    <circle cx="78" cy="79" r="18" class="emblem-fill"/>
    <path d="M78 68v12l8 4" class="emblem-light"/>`,
  "quiet-lighthouse": `
    <path d="m43 103 8-58h26l8 58ZM46 45V28h36v17M43 28l21-14 21 14" class="emblem-fill"/>
    <path d="M49 70h30M46 89h36M35 104h58M34 37l-19-8m19 16-19 8M94 37l19-8m-19 16 19 8"/>
    <path d="M57 34h14" class="emblem-light"/>`,
  "village-steward": `
    <path d="m13 69 22-17 22 17v32H13ZM71 69l22-17 22 17v32H71Z" class="emblem-paper"/>
    <path d="m43 42 21-17 21 17v58H43Z" class="emblem-fill"/>
    <path d="M58 101V81h12v20" class="emblem-light"/>
    <path d="M10 105h108M29 84h10M89 84h10"/>`,
  "open-porch": `
    <path d="m18 45 46-27 46 27ZM27 49v54M101 49v54M18 105h92"/>
    <path d="M48 48h33v57H48Z" class="emblem-paper"/>
    <path d="m48 48 23 10v53l-23-6Z" class="emblem-fill"/>
    <circle cx="64" cy="81" r="2" class="emblem-cutout"/>
    <path d="M29 88h11M88 88h11"/>`,
  "contributor-lounge": `
    <path d="M31 70V47q0-10 10-10h46q10 0 10 10v23" class="emblem-paper"/>
    <path d="M21 68q0-9 9-9t9 9v12h50V68q0-9 9-9t9 9v31H21Z" class="emblem-fill"/>
    <path d="M29 99v11M99 99v11M64 42v33M51 24h26"/>`,
  "opening-host": `
    <path d="M34 105V28h57v77M24 105h77"/>
    <path d="m34 28 36 13v76l-36-12Z" class="emblem-fill"/>
    <circle cx="59" cy="76" r="3" class="emblem-cutout"/>
    <path d="m97 47 3 9 10 3-10 3-3 10-3-10-9-3 9-3ZM103 22v10M98 27h10"/>`,
  "welcome-host": `
    <path d="M35 65V37a6 6 0 0 1 12 0v22-35a6 6 0 0 1 12 0v32-38a6 6 0 0 1 12 0v38-29a6 6 0 0 1 12 0v45l9-14q8-10 15-2L91 90q-8 19-28 19-26 0-32-25l-9-20q-3-10 5-10Z" class="emblem-fill"/>
    <path d="M50 77q18-8 29 6M15 38l-7-7M93 16l6-8"/>
    <path d="M48 87q10 12 25 3" class="emblem-light"/>`,
  "balanced-builder": `
    <path d="m64 20 38 22v44l-38 22-38-22V42Z" class="emblem-paper"/>
    <path d="m64 40 21 12v24L64 88 43 76V52Z" class="emblem-fill"/>
    <path d="M64 20v20M102 42 85 52M102 86 85 76M64 108V88M26 86l17-10M26 42l17 10"/>
    <circle cx="64" cy="64" r="7" class="emblem-cutout"/>`
};

export function renderPersonaEmblem(id: string | undefined, transform = "translate(276 78) scale(.9)"): string {
  const key = id !== undefined && Object.hasOwn(emblems, id) ? id : "balanced-builder";
  return `<g transform="${transform}" data-emblem="${key}" class="persona-emblem" aria-hidden="true">
    <rect x="5" y="5" width="118" height="118" rx="32" class="emblem-halo"/>
    ${emblems[key]}
  </g>`;
}

export function renderEmblemStyles(): string {
  return `
    .persona-emblem{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
    .emblem-halo{fill:var(--accent);fill-opacity:.07;stroke:none;}
    .emblem-paper{fill:var(--surface);}
    .emblem-fill{fill:var(--accent);}
    .emblem-cutout{fill:var(--surface);stroke:var(--surface);}
    .emblem-light{stroke:var(--surface);}
  `;
}
