const fs = require('fs');
const html = fs.readFileSync('../landing/index.html', 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
let css = styleMatch ? styleMatch[1] : '';

// Scope CSS
css = css.replace(/body\s*\{/g, '.landing-page-wrapper {');
css = css.replace(/html\s*\{/g, '.landing-page-root {');

fs.mkdirSync('./src/components/landing', { recursive: true });
fs.writeFileSync('./src/components/landing/LandingPage.css', css);

let bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
let bodyHtml = bodyMatch ? bodyMatch[1] : '';

// Convert HTML to JSX
bodyHtml = bodyHtml.replace(/class=/g, 'className=');
bodyHtml = bodyHtml.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
bodyHtml = bodyHtml.replace(/stroke-width=/g, 'strokeWidth=');
bodyHtml = bodyHtml.replace(/stroke-linecap=/g, 'strokeLinecap=');
bodyHtml = bodyHtml.replace(/stroke-linejoin=/g, 'strokeLinejoin=');
bodyHtml = bodyHtml.replace(/<br>/g, '<br/>');

// Replace style strings with style objects
bodyHtml = bodyHtml.replace(/style="display:flex;justify-content:center"/g, "style={{display:'flex', justifyContent:'center'}}");
bodyHtml = bodyHtml.replace(/style="border-color:rgba\(0,229,255,0.2\)"/g, "style={{borderColor:'rgba(0,229,255,0.2)'}}");
bodyHtml = bodyHtml.replace(/style="background:rgba\(0,229,255,0.1\);color:var\(--cyan\)"/g, "style={{background:'rgba(0,229,255,0.1)', color:'var(--cyan)'}}");
bodyHtml = bodyHtml.replace(/style="border-color:rgba\(196,181,253,0.2\)"/g, "style={{borderColor:'rgba(196,181,253,0.2)'}}");
bodyHtml = bodyHtml.replace(/style="background:rgba\(196,181,253,0.1\);color:var\(--lavender\)"/g, "style={{background:'rgba(196,181,253,0.1)', color:'var(--lavender)'}}");
bodyHtml = bodyHtml.replace(/style="border-color:rgba\(255,179,0,0.2\)"/g, "style={{borderColor:'rgba(255,179,0,0.2)'}}");
bodyHtml = bodyHtml.replace(/style="background:rgba\(255,179,0,0.1\);color:var\(--amber\)"/g, "style={{background:'rgba(255,179,0,0.1)', color:'var(--amber)'}}");
bodyHtml = bodyHtml.replace(/style="border-color:rgba\(0,191,165,0.2\)"/g, "style={{borderColor:'rgba(0,191,165,0.2)'}}");
bodyHtml = bodyHtml.replace(/style="background:rgba\(0,191,165,0.1\);color:var\(--teal\)"/g, "style={{background:'rgba(0,191,165,0.1)', color:'var(--teal)'}}");

bodyHtml = bodyHtml.replace(/style="background:var\(--cyan\);top:20%;left:20%"/g, "style={{background:'var(--cyan)', top:'20%', left:'20%'}}");
bodyHtml = bodyHtml.replace(/style="background:var\(--amber\);top:30%;right:20%"/g, "style={{background:'var(--amber)', top:'30%', right:'20%'}}");
bodyHtml = bodyHtml.replace(/style="background:var\(--purple\);bottom:20%;left:30%"/g, "style={{background:'var(--purple)', bottom:'20%', left:'30%'}}");

bodyHtml = bodyHtml.replace(/style="background:linear-gradient\(135deg,var\(--cyan\),var\(--teal\)\);-webkit-background-clip:text;-webkit-text-fill-color:transparent"/g, "style={{background:'linear-gradient(135deg,var(--cyan),var(--teal))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}");
bodyHtml = bodyHtml.replace(/style="background:linear-gradient\(135deg,var\(--purple\),var\(--lavender\)\);-webkit-background-clip:text;-webkit-text-fill-color:transparent"/g, "style={{background:'linear-gradient(135deg,var(--purple),var(--lavender))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}");
bodyHtml = bodyHtml.replace(/style="background:linear-gradient\(135deg,var\(--amber\),var\(--coral\)\);-webkit-background-clip:text;-webkit-text-fill-color:transparent"/g, "style={{background:'linear-gradient(135deg,var(--amber),var(--coral))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}");
bodyHtml = bodyHtml.replace(/style="grid-template-columns:repeat\(3,1fr\)"/g, "style={{gridTemplateColumns:'repeat(3,1fr)'}}");
bodyHtml = bodyHtml.replace(/style="background:linear-gradient\(135deg,var\(--purple\),var\(--cyan\)\)"/g, "style={{background:'linear-gradient(135deg,var(--purple),var(--cyan))'}}");
bodyHtml = bodyHtml.replace(/style="background:linear-gradient\(135deg,var\(--amber\),var\(--teal\)\)"/g, "style={{background:'linear-gradient(135deg,var(--amber),var(--teal))'}}");
bodyHtml = bodyHtml.replace(/style="position:relative"/g, "style={{position:'relative'}}");
bodyHtml = bodyHtml.replace(/style="font-size:17px;padding:16px 40px"/g, "style={{fontSize:'17px', padding:'16px 40px'}}");

// Replace manual href for CTA with prop
bodyHtml = bodyHtml.replace(/href="#launch"/g, 'onClick={(e) => { e.preventDefault(); onLaunch(); }} href="#"');

let jsxSource = `import React, { useEffect, useRef } from 'react';
import './LandingPage.css';

export default function LandingPage({ onLaunch }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const revealEls = containerRef.current.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { 
        if (e.isIntersecting) { 
          e.target.classList.add('visible'); 
          observer.unobserve(e.target); 
        } 
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));

    const links = containerRef.current.querySelectorAll('a[href^="#"]');
    links.forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if(href === '#' || href === '#launch') return;
        e.preventDefault();
        const target = containerRef.current.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      containerRef.current.querySelectorAll('.orb').forEach((orb, i) => {
        const speed = (i + 1) * 0.4;
        orb.style.transform = \`translate(\${x * speed}px, \${y * speed}px)\`;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="landing-page-wrapper" ref={containerRef}>
      ${bodyHtml}
    </div>
  );
}
`;

fs.writeFileSync('./src/components/landing/LandingPage.jsx', jsxSource);
console.log('Conversion Complete');
