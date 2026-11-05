const devices = [
  ['small-equipment', 'Small Equipment GPS Tracker', 'Hardwired · 8–60V DC', 'Locate powered equipment between jobs and set a geofence around the yard to monitor movement.'],
  ['obd-ii', 'Plug-In OBD-II GPS Tracker', 'Plug-in · Compatible light-duty vehicles', 'Track a service van or pickup through its OBD-II port. Ask us to check compatibility for your make, model and year.']
];

export const trackerProducts = `<section class="tracker-catalog" id="gps-trackers" aria-labelledby="trackers-heading">
<h2 id="trackers-heading">GPS trackers for vehicles and equipment</h2>
<div class="tracker-grid">${devices.map(([id, name, fit, copy]) => `<article>
<img src="/assets/media/${id}.webp" alt="Product illustration of the ${name}" width="496" height="496" loading="lazy">
<div><h3>${name}</h3><strong>${fit}</strong><p>${copy}</p>
<a href="/?interest=GPS%20tracking&amp;tracker=${id}#contact">Get pricing for this tracker →</a></div></article>`).join('')}</div>
<small>Product illustrations. Appearance may vary by configuration.</small></section>`;
