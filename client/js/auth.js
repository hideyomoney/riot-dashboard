async function handleLogin(e) {
  e.preventDefault();
  const email = e.target.email.value.trim(),
        pw    = e.target.password.value;
  if (pw.length < 8) return showError('loginError','Password ≥8 chars');
  const res = await fetch('/api/login',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({email,pw})
  });
  const data = await res.json();
  if (!res.ok) return showError('loginError', data.error);
  localStorage.setItem('jwtToken', data.token);
  localStorage.setItem('userEmail', email);
  window.location.href = '/index.html';
}

async function handleSignup(e) {
  e.preventDefault();
  const email = e.target.email.value.trim(),
        pw    = e.target.password.value;
  if (pw.length < 8) return showError('signupError','Password ≥8 chars');
  const res = await fetch('/api/signup',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({email,pw})
  });
  const data = await res.json();
  if (!res.ok) return showError('signupError', data.error);
  localStorage.setItem('jwtToken', data.token);
  localStorage.setItem('userEmail', email);
  window.location.href = '/index.html';
}

function showError(id,msg) {
  document.getElementById(id).textContent = msg;
}

document.addEventListener('DOMContentLoaded', ()=>{
  const lf = document.getElementById('loginForm'),
        sf = document.getElementById('signupForm');
  if (lf) lf.addEventListener('submit',handleLogin);
  if (sf) sf.addEventListener('submit',handleSignup);
});
