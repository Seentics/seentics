/**
 * Whether scheduled jobs may call the model. Off unless AI_BACKGROUND=true: by default the model is
 * only called when someone asks — opens the dashboard, a recording, a heatmap, or the assistant —
 * so a site nobody looks at costs nothing. The jobs still run; they word what they write from
 * templates instead (the digest, alert causes, impact readings), and skip what only a model adds
 * (pre-written insights and session summaries).
 */
export const aiInBackground = (): boolean => process.env.AI_BACKGROUND === "true";
