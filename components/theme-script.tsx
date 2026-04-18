const THEME_KEY = "opportunity-radar:theme";

const SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("dark"); else root.classList.remove("dark");
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
