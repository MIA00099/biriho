"use strict";
(() => {
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {threshold:0.08, rootMargin:"0px 0px 60px 0px"});
  function observeNew() {
    document.querySelectorAll(".section-head,.controls,.product-card,.cta-box,.footer-top").forEach(el => {
      if (el.dataset.motionObserved) return;
      el.dataset.motionObserved = "1";
      el.classList.add("reveal-on-scroll");
      observer.observe(el);
    });
  }
  document.documentElement.classList.add("motion-ready");
  observeNew();
  const grid = document.getElementById("productGrid");
  if (grid) {
    const mutationObserver = new MutationObserver(() => observeNew());
    mutationObserver.observe(grid, {childList:true});
  }
})();
