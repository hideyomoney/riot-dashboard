// ===== auth.js =====
async function handleSignup(event) {
  event.preventDefault();
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errorEl = document.getElementById('signupError');

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Signup failed.';
      return;
    }
    // Successful signup: store token, redirect to dashboard
    localStorage.setItem('jwtToken', data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Signup error:', err);
    errorEl.textContent = 'An unexpected error occurred.';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const usernameOrEmail = document.getElementById('loginUsernameOrEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed.';
      return;
    }
    // Successful login: store token, redirect to dashboard
    localStorage.setItem('jwtToken', data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Login error:', err);
    errorEl.textContent = 'An unexpected error occurred.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});
