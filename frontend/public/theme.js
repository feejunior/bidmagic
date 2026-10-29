try {
  var theme = localStorage.getItem('bidmagic-theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (error) {}
