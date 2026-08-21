// Quick diagnostic for register endpoint
const ts = Date.now();
const email = `diag_${ts}@test.com`;

const res = await fetch('http://localhost:4000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email, password: 'pass1234' })
});

const data = await res.json();
console.log('Register response:', JSON.stringify(data));

const setCookie = res.headers.get('set-cookie');
console.log('Cookie set:', setCookie ? 'yes' : 'no');

// Try login
const res2 = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'pass1234' })
});
const data2 = await res2.json();
console.log('Login response:', JSON.stringify(data2));
