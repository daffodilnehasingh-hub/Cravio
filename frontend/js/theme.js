// Shared Cravio theme: applies the saved theme on every page and wires the
// dark/light toggle, including pages that have no toggle button of their own.
(function () {
  var saved = "light";
  try { saved = localStorage.getItem("cravio-theme") || "light"; } catch (e) {}
  document.documentElement.dataset.theme = saved;

  function iconFor(theme) {
    var name = theme === "dark" ? "sun" : "moon";
    if (typeof cravioIcon === "function") return cravioIcon(name);
    return '<span data-icon="' + name + '"></span>';
  }

  function wire() {
    var btn = document.getElementById("themeToggle") || document.querySelector(".theme-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-button theme-toggle";
      btn.id = "themeToggle";
      btn.setAttribute("aria-label", "Toggle colour theme");
      btn.title = "Toggle theme";
      var host = document.querySelector(".header-actions") || document.querySelector("header nav") || document.querySelector("header");
      if (!host) return;
      host.appendChild(btn);
    }
    btn.innerHTML = iconFor(document.documentElement.dataset.theme);
    btn.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("cravio-theme", next); } catch (e) {}
      btn.innerHTML = iconFor(next);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
