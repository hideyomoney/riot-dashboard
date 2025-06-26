function initializeHeader() {
  // Only show the Matchup Info button if not on matchup.html
  const matchupBtn = document.getElementById('matchupInfoBtn');
  if (window.location.pathname.endsWith('matchup.html')) {
    matchupBtn.style.display = 'none';
  } else {
    matchupBtn.style.display = 'inline-block';
    matchupBtn.onclick = ()=> window.location.href = '/client/matchup.html';
  }

  const loginBtn = document.getElementById('loginBtn'),
        logoutBtn = document.getElementById('logoutBtn'),
        userInfo  = document.getElementById('userInfo'),
        userEmail = localStorage.getItem('userEmail'),
        token     = localStorage.getItem('jwtToken');

  if (token && userEmail) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'inline';
    document.getElementById('userEmailDisplay').textContent = userEmail;
    logoutBtn.onclick = ()=> {
      localStorage.clear();
      window.location.reload();
    };
  } else {
    loginBtn.style.display = 'inline';
    userInfo.style.display = 'none';
    loginBtn.onclick = ()=> window.location.href = '/login.html';
  }
}
window.initializeHeader = initializeHeader;
