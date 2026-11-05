import { trackerProducts } from './tracker-products.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://www.fleetpilot360.com';
const solutions = [
  ['gps-tracking','GPS tracking','Match the tracker to what moves','Choose GPS tracking for service vehicles, trailers and equipment. Compare power sources, location updates and geofence needs with our Harlingen team.',[
    ['Service vehicles','When a customer calls for an arrival time, dispatch can check the vehicle’s last reported location and route. Ask about plug-in options for light-duty vehicles and hardwired options for permanent installations.'],
    ['Trailers','A trailer can spend days disconnected from a tractor. Tell us how long it sits, whether it parks under cover and how often you need a location update. Those details help us evaluate solar or battery-powered options.'],
    ['Heavy and small equipment','For a loader or a compact machine, start with the available mounting space, power supply and hours of operation. Decide whether you need movement notifications, yard boundaries or route history.']]],
  ['ai-dash-cams','AI dash cams','Give drivers a warning and supervisors the context','Explore the AD Plus 2.0 fleet dash camera, driver alerts and event review. Ask FleetPilot360 about camera pricing for your South Texas fleet.',[
    ['AD Plus 2.0','The camera can alert drivers to events such as lane departure or a forward collision risk. A fleet manager can review flagged events and use them in a coaching conversation.'],
    ['Choose the views you need','Decide whether your team needs road footage, cab visibility or both. We can review camera placement, event settings and access to footage with you before you choose a configuration.'],
    ['Plan a camera quote','Tell us how many vehicles you run and which events matter most. Ask to see how a supervisor opens a flagged event and reviews the clip.']]],
  ['eld','ELD solutions','Plan the driver’s day and the back-office review','Discuss electronic logs, driver inspections and mileage reporting for your truck fleet. FleetPilot360 can help evaluate the hardware and service configuration.',[
    ['In the cab','Start with the driver workflow. Review how a driver signs in, selects a vehicle and checks duty status before dispatch.'],
    ['At the end of a shift','Discuss how inspection notes reach the office and who follows up on a reported defect. Bring a sample of the reports your team uses today.'],
    ['Before choosing a device','Share the vehicle model years, operating region and requirements. Confirm compatibility and the registration of the exact ELD model and version before deployment.']]],
  ['fleet-management','Fleet management','Connect the decisions your fleet makes every day','Compare fleet maintenance, idle-time and driver performance tools for South Texas vehicles. Build a package around the reports your team actually uses.',[
    ['Service planning','Choose which vehicles need time-based or mileage-based reminders and who should receive them. Confirm which mileage inputs are available for each vehicle.'],
    ['Idle time and utilization','Review a typical week with dispatch. Separate vehicles waiting at a job site from vehicles that could be reassigned.'],
    ['Start with one report','Bring a question your team answers manually each week. We can discuss how location history, alerts or a scheduled report would support that decision.']]]
];

const cities = [
  ['harlingen','Harlingen','Talk through your fleet with our Harlingen team','FleetPilot360 sales and fleet technology support in Harlingen, Texas. Discuss GPS, cameras and ELD options with our team on N 77 Sunshine Strip.',[
    ['Sales and product selection','Call our Harlingen office at 956-440-9800. If you want to bring a vehicle or discuss a demonstration, arrange a time with the team first.'],
    ['Prepare for a fleet review','Bring your vehicle count, model years and one dispatch or safety issue you want to solve. We can use those details to narrow down a hardware and service package.']]],
  ['mcallen','McAllen','GPS and cameras for McAllen service routes','Explore GPS tracking and dash cameras for McAllen service fleets. Request pricing and discuss equipment compatibility and service scheduling with FleetPilot360.',[
    ['A dispatch question to start with','When two technicians could take the next call, which vehicle is closest and available? Ask about live location and route history for your service vans.'],
    ['Plan around working hours','Share the number of vehicles that return to the yard each evening and which stay with technicians. Our Harlingen team can discuss equipment options and coordinate service availability for your McAllen location.']]],
  ['brownsville','Brownsville','Track trucks and trailers across handoffs','Discuss truck GPS, trailer visibility and camera options for Brownsville fleets. Get a FleetPilot360 quote based on powered vehicles and detached assets.',[
    ['When trucks and trailers separate','A tractor location alone may leave dispatch wondering where the trailer was dropped. Identify which assets need their own tracker and how often a parked unit must report.'],
    ['Quote the assets separately','Send the counts for trucks and trailers, typical dwell time and whether parking areas have sunlight. Ask the Harlingen team about available equipment and scheduling at your Brownsville site.']]]
];

const esc = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const links = (rows,base) => rows.map(([slug,label]) => `<a href="/${base}/${slug}">${label}</a>`).join(' ');
const areaLinks = links(cities,'service-areas');
const solutionLinks = links(solutions,'solutions');
const business = {'@context':'https://schema.org','@type':'LocalBusiness','@id':origin+'/#business',name:'FleetPilot360',url:origin+'/',telephone:'+19564409800',address:{'@type':'PostalAddress',streetAddress:'725 N 77 Sunshine Strip',addressLocality:'Harlingen',addressRegion:'TX',postalCode:'78550',addressCountry:'US'},areaServed:cities.map(c=>({'@type':'City',name:c[1]+', Texas'}))};
export const homeSearchHead = `<link rel="canonical" href="${origin}/"><meta property="og:title" content="FleetPilot360 | South Texas Fleet Solutions"><meta property="og:type" content="website"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/assets/video/poster-horizontal.jpg"><script type="application/ld+json">${JSON.stringify(business)}</script>`;
const mediaScenes = {
  'gps-tracking': ['gps-tracking','Service trucks traveling on a rural road','Vehicle and trailer tracking'],
  'ai-dash-cams': ['ai-dash-cams','Illustrative dash camera installation in a service van','Camera placement and the AD Plus 2.0'],
  eld: ['eld','Driver reviewing a mounted tablet in a parked truck','Driver status and vehicle inspections'],
  'fleet-management': ['fleet-management','Technician and supervisor inspecting a service van','Maintenance and dispatch'],
  harlingen: ['harlingen','Service vehicles parked at a South Texas yard','Planning a fleet rollout'],
  mcallen: ['mcallen','Technician loading a service van','Coordinating service calls'],
  brownsville: ['brownsville','Detached trailers parked in a logistics yard','Tracking trucks and trailers'],
  'service-areas': ['harlingen','Utility vehicles outside a service yard','FleetPilot360 overview']
};
export async function buildSearchPages() {
  const paths=['/','/privacy','/terms'];
  async function page(path,title,h1,description,body,category,cta,interest) {
    paths.push(path);
    const parent=category==='Service areas'?'/service-areas':'/#solutions';
    const target=interest?'/?interest='+encodeURIComponent(interest)+'#contact':'/#contact';
    const crumb={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[['Home','/'],[h1,path]].map(([name,p],i)=>({'@type':'ListItem',position:i+1,name,item:origin+p}))};
    const slug = path.split('/').pop();
    const [scene, alt, caption] = mediaScenes[slug];
    const photo = '/assets/media/'+scene+'.webp';
    const regional = path === '/service-areas';
    const clip = regional ? '/assets/video/fleetpilot360-horizontal.mp4' : '/assets/media/'+scene+'.mp4';
    const film = slug === 'ai-dash-cams' ? '<section class="page-film" id="event-review"><h2>From lane departure to event review</h2><video controls playsinline preload="none" poster="/assets/media/lane-review.webp" width="768" height="432" aria-label="AD Plus 2.0 lane departure demonstration"><source src="/assets/media/lane-review.mp4" type="video/mp4"></video><p>AD Plus 2.0 · 15-second illustrative demo. A driver receives a lane departure alert and a supervisor reviews the event for coaching.</p><a href="/?interest=AI%20dash%20cams#contact">Get dash cam pricing →</a></section>' : `<section class="page-film"><h2>${caption}</h2><video controls playsinline preload="none" poster="${regional?'/assets/video/poster-horizontal.jpg':photo}" width="768" height="432" aria-label="${caption}"><source src="${clip}" type="video/mp4"><a href="${clip}">Watch video</a></video><p>${regional?'24-second platform overview':'8-second illustrated overview · Silent'}</p></section>`;
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | FleetPilot360</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${origin}${path}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${path}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${origin}/assets/video/poster-horizontal.jpg"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/detail.css"><script type="application/ld+json">${JSON.stringify(crumb)}</script></head><body class="detail"><header><div class="shell"><a href="/" class="brand"><img src="/assets/favicon.svg" width="36" height="36" alt=""> FleetPilot<span>360</span></a><nav aria-label="Main"><a href="/#solutions">Solutions</a><a href="/service-areas">Service areas</a><a href="tel:+19564409800">956-440-9800</a></nav></div></header><main><section class="detail-hero"><div class="shell"><a class="trail" href="${path==='/service-areas'?'/':parent}">← ${path==='/service-areas'?'FleetPilot360':category}</a><h1>${esc(h1)}</h1><p>${esc(description)}</p><a class="button" href="${target}">${cta}</a></div><img class="page-photo" src="${photo}" alt="${alt}" width="764" height="336"></section><div class="shell detail-body">${body}${film}<aside><h2>Explore FleetPilot360</h2><nav>${solutionLinks} ${areaLinks}</nav></aside></div></main><footer><div class="shell">FleetPilot360 · 725 N 77 Sunshine Strip, Harlingen, TX 78550 <a href="/privacy">Privacy</a> <a href="/terms">Terms</a></div></footer><script src="/assets/campaign-links.js" defer></script></body></html>`;
    await mkdir('dist'+path.slice(0,path.lastIndexOf('/')+1),{recursive:true});
    await writeFile('dist'+path+'.html',html);
  }
  const blocks=rows=>rows.map(([heading,copy])=>`<section><h2>${heading}</h2><p>${copy}</p></section>`).join('');
  const interests=['GPS tracking','AI dash cams','ELD compliance','Complete fleet platform'];
  for(const [i,[slug,name,heading,desc,sections]] of solutions.entries()){
    const visual=slug==='gps-tracking'?trackerProducts:slug==='ai-dash-cams'?'<figure><img src="/assets/ad-plus-concept.webp" alt="Illustration of the AD Plus 2.0 dash camera and windshield mount" width="840" height="820"><figcaption>AD Plus 2.0 · Product illustration</figcaption></figure>':'';
    await page('/solutions/'+slug,name+' for South Texas fleets',name+' for fleets',desc,visual+'<h2>'+heading+'</h2>'+blocks(sections),'Solutions',slug==='ai-dash-cams'?'Get dash cam pricing':'Request fleet pricing',interests[i]);
  }
  for(const [slug,name,heading,desc,sections] of cities) await page('/service-areas/'+slug,'Fleet GPS and dash cameras in '+name+', TX','Fleet solutions in '+name+', Texas',desc,'<h2>'+heading+'</h2>'+blocks(sections),'Service areas','Ask about sales and service');
  await page('/service-areas','South Texas sales and service areas','South Texas sales and service areas','Based in Harlingen, FleetPilot360 helps Rio Grande Valley businesses evaluate vehicle GPS, cameras and equipment tracking. Choose your city to plan a fleet review.',cities.map(([slug,name,heading])=>`<section><h2><a href="/service-areas/${slug}">${name}</a></h2><p>${heading}.</p></section>`).join(''),'Service areas','Contact the Harlingen team');
  await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+origin+p+'</loc></url>').join('')+'</urlset>');
  await writeFile('dist/robots.txt','User-agent: *\nDisallow: /api/\nSitemap: '+origin+'/sitemap.xml\n');
}
