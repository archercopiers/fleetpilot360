const menu=document.querySelector('.menu-btn');const nav=document.querySelector('.main-nav');menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false')}));document.getElementById('year').textContent=new Date().getFullYear();const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

const requestedInterest = new URLSearchParams(location.search).get('interest');
const interestField = document.querySelector('#quote-form select[name="interest"]');
if (interestField && Array.from(interestField.options).some(option => option.value === requestedInterest)) {
  interestField.value = requestedInterest;
}

const trackerNames = new Map([
  ['small-equipment', 'Small Equipment GPS Tracker'],
  ['obd-ii', 'Plug-In OBD-II GPS Tracker']
]);
const trackerName = trackerNames.get(new URLSearchParams(location.search).get('tracker'));
const quoteMessage = document.querySelector('#quote-form textarea[name="message"]');
if (trackerName && quoteMessage && !quoteMessage.value) {
  quoteMessage.value = 'Please send me pricing for the ' + trackerName + '.';
}
