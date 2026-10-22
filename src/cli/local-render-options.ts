import type { RenderCardOptions } from "../renderer/svg.js";
import type { ScoreUserProfileOptions } from "../scoring/score-user.js";

export interface LocalRenderOptions extends RenderCardOptions, ScoreUserProfileOptions {}
