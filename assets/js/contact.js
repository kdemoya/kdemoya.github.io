(() => {
  "use strict";

  const contact = document.getElementById("contact");
  const cta = document.getElementById("contact-cta");
  const slot = contact?.querySelector(".contact-slot");
  const stage = document.querySelector(".about-stage");
  const reveal = document.querySelector(".about-reveal");
  const portraitLinks = document.querySelector(".portrait-links");
  if (!contact || !cta || !slot || !stage || !reveal) return;

  const root = document.documentElement;
  const body = document.body;
  const printMedia = matchMedia("print");
  let layoutFrame = 0,
    scrollFrame = 0;
  let threshold = Infinity,
    dockHeight = 0,
    bottomInset = 12;
  let lastGeometry = "";

  function setSize(name, value) {
    const pixels = `${value}px`;
    if (root.style.getPropertyValue(name) !== pixels)
      root.style.setProperty(name, pixels);
  }

  function updateDock() {
    scrollFrame = 0;
    if (printMedia.matches) return;
    const next =
      window.scrollY >= threshold && window.scrollY > 0 ? "true" : "false";
    if (body.dataset.contactDocked !== next) body.dataset.contactDocked = next;
  }

  function measure() {
    layoutFrame = 0;
    if (printMedia.matches) return;
    // The in-flow slot remains the source of geometry even while its link is
    // fixed. Nothing is cloned or reparented, so keyboard focus stays put.
    const bounds = slot.getBoundingClientRect();
    setSize("--contact-left", bounds.left);
    setSize("--contact-width", bounds.width);
    dockHeight = cta.getBoundingClientRect().height;
    setSize("--contact-height", dockHeight);
    setSize("--contact-dock-height", dockHeight);
    const contactHeight = contact.getBoundingClientRect().height;
    setSize("--contact-space", contactHeight);
    const portraitLinksHeight =
      portraitLinks?.getBoundingClientRect().height ?? 0;
    setSize("--portrait-links-space", portraitLinksHeight);

    // scroll-margin-bottom resolves the same safe-area expression as the dock.
    bottomInset = parseFloat(getComputedStyle(cta).scrollMarginBottom) || 12;
    const stageBounds = stage.getBoundingClientRect();
    const revealBounds = reveal.getBoundingClientRect();
    if (getComputedStyle(stage).position === "sticky") {
      // Switch only when the pinned portrait introduction releases. This uses
      // its stable wrapper, not the moving/fixed CTA position.
      threshold = Math.ceil(
        revealBounds.top +
          window.scrollY +
          Math.max(0, revealBounds.height - stageBounds.height),
      );
    } else {
      // In the static layout, let the complete link enter the viewport first.
      threshold = Math.ceil(
        slot.getBoundingClientRect().bottom +
          window.scrollY -
          window.innerHeight +
          bottomInset,
      );
    }
    updateDock();
    const geometry = [
      bounds.left,
      bounds.width,
      dockHeight,
      contactHeight,
      portraitLinksHeight,
    ]
      .map((value) => Math.round(value * 100))
      .join(":");
    if (geometry !== lastGeometry) {
      lastGeometry = geometry;
      // Link wrapping can move the portrait without resizing it. Refresh its
      // cached particle coordinates whenever the surrounding controls change.
      window.dispatchEvent(new Event("portfolio:layout"));
    }
  }

  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(measure);
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateDock);
    },
    { passive: true },
  );
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("pageshow", scheduleLayout);
  window.addEventListener("load", scheduleLayout, { once: true });
  window.visualViewport?.addEventListener("resize", scheduleLayout, {
    passive: true,
  });
  document.fonts?.ready.then(scheduleLayout);
  printMedia.addEventListener("change", scheduleLayout);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleLayout);
    [slot, cta, contact, stage, reveal, body].forEach((element) =>
      observer.observe(element),
    );
    if (portraitLinks) observer.observe(portraitLinks);
  }
  new MutationObserver(scheduleLayout).observe(body, {
    attributes: true,
    attributeFilter: ["data-motion", "data-portrait"],
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (
      !target.getBoundingClientRect ||
      cta.contains(target) ||
      target.closest("#motion")
    )
      return;
    requestAnimationFrame(() => {
      if (body.dataset.contactDocked !== "true" || printMedia.matches) return;
      const bounds = target.getBoundingClientRect();
      const visibleBottom = window.innerHeight - dockHeight - bottomInset - 12;
      if (bounds.bottom > visibleBottom && bounds.height < visibleBottom) {
        window.scrollBy({
          top: bounds.bottom - visibleBottom,
          behavior: "instant",
        });
      }
    });
  });

  body.dataset.contactReady = "true";
  measure();
})();
