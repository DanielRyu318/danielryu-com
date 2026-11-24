const drawings = {
  external: '<path d="M8 16 16 8M7 8h9v9"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  launch: '<circle cx="15" cy="9" r="4"/><path d="m5 15 5-5m-2 9 5-5m1 6 3-3"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4zM16 9l6 6m0-6-6 6"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  map: '<path d="m2 6 6-3 8 3 6-3v15l-6 3-8-3-6 3zM8 3v15m8-12v15"/>',
  projects: '<rect x="2.5" y="3.5" width="19" height="13.5" rx="2"/><path d="M8 21h8m-4-4v4m-4-9 2-2-2-2m4 5h3"/>',
  experience: '<rect x="2.7" y="7.2" width="18.6" height="13.7" rx="2"/><path d="M8.5 7V5.6c0-1 .8-1.8 1.8-1.8h3.4c1 0 1.8.8 1.8 1.8V7M3 12.2c5.2 2.8 12.8 2.8 18 0m-10 1v2h2v-2"/>',
  hobbies: '<path d="m7 7 1.5-2h7L17 7c2.3.2 3.3 1.4 3.8 3.9l1 5.8c.6 3.2-1.8 4.3-3.8 2.1l-2.8-3H8.8L6 18.8c-2 2.2-4.4 1.1-3.8-2.1l1-5.8C3.7 8.4 4.7 7.2 7 7Z"/><path d="M5.7 11.4h4m-2-2v4"/><circle cx="17.8" cy="10.5" r=".65"/><circle cx="15.7" cy="12.6" r=".65"/>',
  stats: '<path d="M3 20.5h18M5 17V12h3v5m3 0V8h3v9m3 0V4h3v13"/>'
};
export function icon(name) {
  return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + drawings[name] + '</svg>';
}
export function fillIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
}
