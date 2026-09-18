/* CRUST Bakery — language toggle and section reveals. No dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  /* ---- Arabic / English ---------------------------------------------- */

  var swappable = Array.prototype.slice.call(document.querySelectorAll("[data-en]"));
  var arabic = swappable.map(function (el) { return el.innerHTML; });
  var english = swappable.map(function (el) { return el.getAttribute("data-en"); });

  function store(lang) {
    try { localStorage.setItem("crust-lang", lang); } catch (err) { /* private mode */ }
  }

  function restore() {
    try { return localStorage.getItem("crust-lang"); } catch (err) { return null; }
  }

  function apply(lang) {
    var en = lang === "en";
    swappable.forEach(function (el, i) {
      el.innerHTML = en ? english[i] : arabic[i];
    });
    root.lang = en ? "en" : "ar";
    root.dir = en ? "ltr" : "rtl";
  }

  var toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.lang === "en" ? "ar" : "en";
      apply(next);
      store(next);
    });
  }

  if (restore() === "en") { apply("en"); }

  /* ---- Reveal on scroll ---------------------------------------------- */

  var targets = document.querySelectorAll(".reveal");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (still || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add("is-in"); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) { return; }
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
}());
