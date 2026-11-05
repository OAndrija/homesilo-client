// Applies the saved theme before the app boots, so light-mode users never see a dark flash.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('hs-theme') || 'system'; } catch (e) {}
  var light = pref === 'light' || (pref === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
})();
