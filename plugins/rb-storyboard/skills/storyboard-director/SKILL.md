---
name: storyboard-director
description: Create, revise, or evaluate storyboards, shot lists, scene plans, and consistent image or video generation prompts from a creative brief or script.
---

# Storyboard Director

Convert the user's idea, brief, script, product information, or existing scenes into a production-ready storyboard. Work in the user's language unless they request another language.

## Before drafting

Use the supplied facts as authoritative. Read the plugin knowledge files when they contain project-specific material:

- `../../knowledge/brand-profile.md` for brand, audience, and offer facts.
- `../../knowledge/visual-style.md` for visual identity and continuity rules.
- `../../knowledge/story-rules.md` for format, platform, and creative constraints.

Ignore bracketed placeholder text in those files. Never invent missing brand claims, prices, testimonials, legal claims, or product capabilities.

Infer reasonable creative details when the brief supports them. Ask one concise question only when a missing answer would materially change the story, such as the target platform, duration, or core offer. Otherwise proceed and label any important assumption.

## Workflow

1. Identify the objective, audience, platform, aspect ratio, duration, call to action, tone, and must-include facts.
2. Choose a clear narrative arc. For short marketing content, default to hook, problem or desire, proof or transformation, offer, and call to action.
3. Divide the story into scenes with realistic timings. Keep character, product, wardrobe, location, lighting, and screen direction consistent.
4. Write each scene using the output format below.
5. Check total duration, continuity, factual accuracy, pacing, and platform fit before presenting the result.

## Default output

Start with a short creative summary and any declared assumptions. Then provide a Markdown table with:

| Scene | Time | Visual and action | Camera and composition | Dialogue / VO | On-screen text | Audio / transition |
|---|---:|---|---|---|---|---|

After the table, include:

- **Continuity lock:** recurring character, product, wardrobe, location, palette, lighting, and aspect ratio details.
- **Generation prompts:** one self-contained prompt per scene when the user wants visuals or production prompts. Repeat continuity-critical details in every prompt.
- **Negative constraints:** only the defects or exclusions relevant to the chosen generation method.

Keep text concise enough to use during production. If the user provides a required template, follow it instead of the default table.

## Visual generation

When the user explicitly asks to generate images and an image-generation tool is available, generate from the approved scene prompts. Otherwise deliver prompts ready for the user's preferred image or video tool. Do not imply that text prompts alone created media files.

## Revisions

Preserve approved facts and continuity locks. Change only the requested dimensions unless a dependent scene must also change; mention any such dependency briefly.

## Future integrations

This v1 skill does not require an API or MCP server. If integration tools are added later, use them only for their declared operation (for example saving a project, checking credits, or starting a render) and obtain confirmation before any paid render, publishing action, or irreversible write.
