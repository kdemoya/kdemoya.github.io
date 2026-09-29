(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const requiredIds = [
    "copy-prompt",
    "copy-prompt-label",
    "copy-status",
    "prompt-preview",
    "prompt-text",
    "copy-context",
    "briefing-status",
    "briefing-preview",
    "briefing-text",
  ];
  if (requiredIds.some((id) => !byId(id))) return;
  const copyButton = byId("copy-prompt");
  const copyLabel = byId("copy-prompt-label");
  const originalLabel = copyLabel.textContent;
  const promptPreview = byId("prompt-preview");
  const promptText = byId("prompt-text");
  const briefingPreview = byId("briefing-preview");
  const briefingText = byId("briefing-text");
  const publicSite = "https://kdemoya.github.io/";
  const publicLink = (file, anchor = "") =>
    `${publicSite}${file}${anchor ? `#${anchor}` : ""}`;
  const instructions =
    "Follow the dots. Skip the buzzwords. " +
    "If I share a role description, make the strongest evidence-backed case for Kelvin’s fit. Connect requirements to specific projects and roles, " +
    "and identify what to clarify in an interview. Otherwise, summarize his strongest experience and suggest three useful questions. " +
    "Cite source links. Preserve dates, employer/client relationships, and individual versus team contributions. " +
    "Do not invent skills, outcomes, or metrics, or treat missing information as proof of missing experience.";
  const shortPrompt =
    `Read Kelvin De Moya’s professional profile at:\n${publicLink("context.md")}\n\n` +
    `${instructions}\n\nIf you can’t access the profile, ask me to paste or upload it.`;

  const textOf = (element) => {
    if (!element) return "";
    const copy = element.cloneNode(true);
    copy
      .querySelectorAll('[aria-hidden="true"], .name-period, script, style')
      .forEach((node) => node.remove());
    copy
      .querySelectorAll("br")
      .forEach((node) => node.replaceWith(document.createTextNode(" ")));
    copy.querySelectorAll("h1,h2,h3,h4,h5,p,li,dt,dd").forEach((node) => {
      node.before(document.createTextNode(" "));
      node.after(document.createTextNode(" "));
    });
    return copy.textContent.replace(/\s+/g, " ").trim();
  };
  const markdownLabel = (value) => value.replace(/[\\[\]]/g, "\\$&");
  const linkedHeading = (heading, level) =>
    heading?.id
      ? `${level} [${markdownLabel(textOf(heading))}](${publicLink("", heading.id)})`
      : `${level} ${textOf(heading)}`;

  // Build the optional full briefing from the visible page so it also works offline.
  const buildBriefing = () => {
    const lines = [
      "Read Kelvin De Moya’s professional profile below.",
      "",
      instructions,
      "",
      "---",
      "",
      `# ${textOf(byId("hero-name"))} — Professional context`,
      "",
      "You followed the dots. Welcome to the context behind the K.",
      "",
      textOf(byId("title-trigger")),
      "",
      textOf(byId("contact-availability")),
      "",
      `[Portfolio](${publicLink("")}) · [Full profile](${publicLink("profile.html")}) · [Markdown profile](${publicLink("profile.md")})`,
      "",
      `[Project summaries in the plain profile](${publicLink("profile.html", "selected-work")})`,
      "",
      "## About",
      "",
    ];
    document
      .querySelectorAll(".about-note > p")
      .forEach((paragraph) => lines.push(textOf(paragraph), ""));
    const workingNotes = document.querySelectorAll(
      ".working-notes dt, .working-notes dd",
    );
    if (workingNotes.length) {
      lines.push("### How I work", "");
      workingNotes.forEach((note) =>
        lines.push(
          note.tagName === "DT" ? `**${textOf(note)}**` : textOf(note),
          "",
        ),
      );
    }
    lines.push("## Experience", "");
    document.querySelectorAll(".career-employer").forEach((employer) => {
      lines.push(
        `### ${textOf(employer.querySelector(".career-heading h4"))}`,
        "",
        textOf(employer.querySelector(".career-heading .folio")),
        "",
      );
      employer.querySelectorAll(".career-role").forEach((role) => {
        lines.push(linkedHeading(role.querySelector("h5"), "####"), "");
        role
          .querySelectorAll(":scope > p")
          .forEach((paragraph) => lines.push(textOf(paragraph), ""));
        role
          .querySelectorAll("li")
          .forEach((bullet) => lines.push(`- ${textOf(bullet)}`));
        lines.push("");
      });
    });
    lines.push("## Skills", "");
    document.querySelectorAll(".toolbox .skill-list > div").forEach((group) => {
      lines.push(
        `**${textOf(group.querySelector("dt"))}:** ${textOf(group.querySelector("dd"))}`,
        "",
      );
    });
    lines.push("## Contact", "");
    document
      .querySelectorAll('#contact a[href^="mailto:"], .portrait-links a')
      .forEach((link) => {
        const label = link.querySelector("#contact-action") || link;
        const destination = new URL(link.getAttribute("href"), publicSite).href;
        lines.push(`- [${markdownLabel(textOf(label))}](${destination})`);
      });
    return `${lines.join("\n").trim()}\n`;
  };

  const selectForCopy = (field, details, status, message) => {
    promptPreview.hidden = false;
    promptPreview.open = true;
    details.hidden = false;
    details.open = true;
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    status.textContent = message;
  };
  const copyText = async (text) => {
    if (typeof navigator.clipboard?.writeText !== "function")
      throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
  };
  let feedbackTimer;
  let promptAttempt = 0;
  copyButton.addEventListener("click", async () => {
    window.dispatchEvent(new Event("portfolio:prompt-copy"));
    const attempt = ++promptAttempt;
    clearTimeout(feedbackTimer);
    copyLabel.textContent = originalLabel;
    byId("copy-status").textContent = "";
    try {
      await copyText(shortPrompt);
      if (attempt !== promptAttempt) return;
      copyLabel.textContent = "Copied";
      byId("copy-status").textContent =
        "Prompt copied. Paste it into your agent.";
      feedbackTimer = setTimeout(() => {
        copyLabel.textContent = originalLabel;
      }, 2000);
    } catch {
      if (attempt !== promptAttempt) return;
      selectForCopy(
        promptText,
        promptPreview,
        byId("copy-status"),
        "The prompt is selected. Copy it with ⌘C or Ctrl+C, then paste it into your agent.",
      );
    }
  });
  byId("copy-context").addEventListener("click", async () => {
    const briefing = buildBriefing();
    briefingText.value = briefing;
    briefingPreview.hidden = false;
    byId("briefing-status").textContent = "";
    try {
      await copyText(briefing);
      byId("briefing-status").textContent =
        "Full briefing copied. Paste it into your agent.";
    } catch {
      selectForCopy(
        briefingText,
        briefingPreview,
        byId("briefing-status"),
        "The full briefing is selected. Copy it with ⌘C or Ctrl+C, then paste it into your agent.",
      );
    }
  });

  promptText.value = shortPrompt;
  promptPreview.hidden = false;
  copyButton.disabled = false;
})();
