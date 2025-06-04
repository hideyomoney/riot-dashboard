// Redirect to login if not authenticated
(function() {
  const token = localStorage.getItem('jwtToken');
  if (!token) {
    window.location.href = 'login.html';
  }
})();
