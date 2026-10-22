import type { RenderCardOptions } from "../renderer/svg.js";
import type { ScoreUserProfileOptions } from "../scoring/score-user.js";
import type { RenderFileOptions } from "./file-system.js";

export interface LocalRenderOptions extends RenderCardOptions, ScoreUserProfileOptions, RenderFileOptions {}
